import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Test } from "@nestjs/testing";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";
import { AppModule } from "../../src/app.module.js";
import { PrismaClient, type Prisma } from "../../src/generated/prisma/client.js";
import { PrismaService } from "../../src/infrastructure/prisma/prisma.service.js";
import { AUTH_CONFIG } from "../../src/auth/auth.config.js";
import { VERIFICATION_EMAIL } from "../../src/auth/domain/email-verification.js";
import { JoseAccessTokenService } from "../../src/auth/infrastructure/jose-access-token.js";
import { configureAuthHttp } from "../../src/auth/presentation/http-security.js";
import { csrfHeaders, testAuthConfig } from "../auth-test.config.js";

/** Schema-owned PostgreSQL and signed real sessions; no login hashing or shared public fixtures. */
export async function moderationHarness(databaseUrl: string) {
  const schema = `t2_${randomUUID().replaceAll("-", "")}`;
  const sql = new Client({ connectionString: databaseUrl });
  await sql.connect();
  await sql.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"`);
  const migrations = new URL("../../prisma/migrations/", import.meta.url);
  const directories = (await readdir(migrations, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  for (const directory of directories) await sql.query(await readFile(new URL(`${directory}/migration.sql`, migrations), "utf8"));
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl, options: `-c search_path=${schema},public` }, { schema }) });
  await prisma.$connect();
  const config = testAuthConfig();
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService).useValue(prisma)
    .overrideProvider(AUTH_CONFIG).useValue(config)
    .overrideProvider(VERIFICATION_EMAIL).useValue({ send: async () => {} }).compile();
  const app = module.createNestApplication();
  app.useLogger(false);
  configureAuthHttp(app, config);
  await app.listen(0, "127.0.0.1");
  const url = await app.getUrl();
  return {
    prisma, sql, url,
    async account(role: "USER" | "ADMIN" = "USER") {
      const user = await prisma.user.create({ data: { email: `t2-${randomUUID()}@alu.frlp.utn.edu.ar`, displayName: "Identidad privada T2", role,
        passwordHash: "fixture-no-login", emailVerifiedAt: new Date() } });
      // JWT iat has second precision and authentication forbids credentials older than session.
      const issuedAt = Math.floor(Date.now() / 1000);
      const now = new Date(issuedAt * 1000);
      const session = await prisma.session.create({ data: { id: randomUUID(), userId: user.id, createdAt: now, lastActivityAt: now,
        expiresAt: new Date(now.getTime() + 86_400_000) } });
      const token = await new JoseAccessTokenService(config).issue({ userId: user.id, sessionId: session.id, issuedAt, expiresAt: issuedAt + config.accessTtlSeconds });
      return { id: user.id, role, cookie: `${config.cookieName}=${token}` };
    },
    async context() {
      const materia = await prisma.materia.create({ data: { nombre: `T2 ${randomUUID()}`, modalidad: "PRIMERO", carreras: { create: { carrera: "S", anioCarrera: "1" } } } });
      const cursada = await prisma.cursada.create({ data: { materiaId: materia.id, anio: 2026, cuatrimestre: "PRIMERO" } });
      const comision = await prisma.comision.create({ data: { cursadaId: cursada.id, carrera: "S", numero: 31 } });
      return { materia, cursada, comision };
    },
    async feedback(context: { materia: { id: string; nombre: string }; cursada: { id: string }; comision: { id: string } }, autorId: string, overrides: Partial<Prisma.FeedbackUncheckedCreateInput> = {}) {
      const texto = overrides.texto ?? "Experiencia pública revisada";
      const puntuacion = overrides.puntuacion === undefined ? 4 : overrides.puntuacion;
      const createdAt = overrides.createdAt ?? new Date();
      // Tests establish a publication directly; production POST also publishes immediately.
      return prisma.feedback.create({ data: { autorId, comisionId: context.comision.id, texto, puntuacion, anonimo: true,
        estadoModeracion: "APROBADO", comisionNombre: "S-31", materiaId: context.materia.id, materiaNombre: context.materia.nombre,
        cursadaId: context.cursada.id, anio: 2026, modalidad: "PRIMERO", createdAt,
        historial: { create: { accion: "CREACION", texto, puntuacion, anonimo: true, createdAt } }, ...overrides } });
    },
    request(path: string, cookie: string, method = "GET", body?: unknown) {
      return fetch(`${url}${path}`, { method, headers: { Cookie: cookie, ...(method === "GET" ? {} : csrfHeaders) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    },
    async reset() {
      // All names resolve to the owned random schema, which contains the complete migrations.
      await sql.query('TRUNCATE "Feedback", "AdministracionHistorial", "User", "Materia", "Profesor" CASCADE');
    },
    async close() {
      await app.close();
      await prisma.$disconnect();
      await sql.query(`DROP SCHEMA "${schema}" CASCADE`);
      await sql.end();
    },
  };
}

export type ModerationHarness = Awaited<ReturnType<typeof moderationHarness>>;
