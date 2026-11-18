import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { AUTH_CONFIG } from "../src/auth/auth.config.js";
import { JoseAccessTokenService } from "../src/auth/infrastructure/jose-access-token.js";
import { configureAuthHttp } from "../src/auth/presentation/http-security.js";
import { csrfHeaders, testAuthConfig } from "./auth-test.config.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];

describe.skipIf(!databaseUrl)("HU-C01 consulta HTTP con persistencia y sesiones reales", () => {
  let app: INestApplication; let prisma: PrismaClient; let baseUrl: string;
  const ids: string[] = [];
  const config = testAuthConfig();
  const tokens = new JoseAccessTokenService(config);
  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
    await prisma.$connect();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(config).compile();
    app = module.createNestApplication(); app.useLogger(false); configureAuthHttp(app, config);
    await app.listen(0, "127.0.0.1"); baseUrl = await app.getUrl();
  }, 20_000);
  afterAll(async () => {
    if (prisma && ids.length) {
      await prisma.session.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });
  async function fixture(role: "USER" | "ADMIN") {
    const now = new Date(Math.floor(Date.now() / 1000) * 1000);
    const user = await prisma.user.create({ data: { email: `community-${randomUUID()}@example.test`, displayName: "Consulta comunidad",
      passwordHash: "unused-cookie-fixture", role, emailVerifiedAt: now } }); ids.push(user.id);
    const session = await prisma.session.create({ data: { id: randomUUID(), userId: user.id, createdAt: now, lastActivityAt: now,
      expiresAt: new Date(now.getTime() + 86400_000) } });
    const access = await tokens.issue({ userId: user.id, sessionId: session.id, issuedAt: now.getTime() / 1000, expiresAt: now.getTime() / 1000 + 900 });
    return { user, session, cookie: `${config.cookieName}=${access}` };
  }
  const get = (cookie = "") => fetch(`${baseUrl}/comunidad/normas`, { headers: { Cookie: cookie } });

  it("rechaza lectura sin sesión y con credencial inválida", async () => {
    expect((await get()).status).toBe(401);
    expect((await get(`${config.cookieName}=invalid`)).status).toBe(401);
  });

  it.each(["USER", "ADMIN"] as const)("%s consulta el documento vigente sin alterarlo y sin aceptar normas nuevamente", async role => {
    const session = await fixture(role);
    const before = await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } });
    const response = await get(session.cookie);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ id: before.id, titulo: before.titulo, introduccion: before.introduccion, normas: before.normas, cierre: before.cierre, createdAt: before.createdAt.toISOString(), updatedAt: before.updatedAt.toISOString() });
    expect(await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } })).toEqual(before);
    expect(await prisma.aceptacionNormas.count({ where: { usuarioId: session.user.id } })).toBe(0);
  });

  it("lee la versión persistida en cada consulta y conserva el orden modificado", async () => {
    const session = await fixture("USER");
    const before = await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } });
    try {
      await prisma.normasConvivencia.update({ where: { id: "vigentes" }, data: { titulo: "Título de prueba persistido", normas: ["Segunda ahora primera", "Primera ahora segunda"] } });
      const response = await get(session.cookie);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ titulo: "Título de prueba persistido", normas: ["Segunda ahora primera", "Primera ahora segunda"] });
    } finally {
      await prisma.normasConvivencia.update({ where: { id: "vigentes" }, data: before });
    }
  });

  it.each(["USER", "ADMIN"] as const)("%s no dispone de escrituras ajenas al PUT administrativo de HU-C04", async role => {
    const session = await fixture(role);
    const before = await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } });
    // HU-C04 habilita solo PUT para ADMIN; las demás escrituras continúan ausentes.
    for (const method of ["POST", "PATCH", "DELETE"]) {
      const response = await fetch(`${baseUrl}/comunidad/normas`, { method, headers: { ...csrfHeaders, Cookie: session.cookie }, body: JSON.stringify({ titulo: "No autorizado" }) });
      expect(response.status).toBe(404);
    }
    if (role === "USER") {
      expect((await fetch(`${baseUrl}/comunidad/normas`, { method: "PUT", headers: { ...csrfHeaders, Cookie: session.cookie }, body: JSON.stringify({ titulo: "No autorizado" }) })).status).toBe(403);
    }
    expect(await prisma.normasConvivencia.findUniqueOrThrow({ where: { id: "vigentes" } })).toEqual(before);
  });

  it("mantiene rechazo de una sesión revocada", async () => {
    const session = await fixture("ADMIN");
    await prisma.session.update({ where: { id: session.session.id }, data: { revokedAt: new Date() } });
    expect((await get(session.cookie)).status).toBe(401);
  });

  it("responde 404 si falta el documento y no reejecuta el seed durante la lectura", async () => {
    const session = await fixture("USER");
    const lookup = vi.spyOn(prisma.normasConvivencia, "findUnique").mockResolvedValueOnce(null);
    try {
      const response = await get(session.cookie);
      expect(response.status).toBe(404);
      expect((await response.json()).message).toMatch(/normas.*disponibles/i);
    } finally { lookup.mockRestore(); }
    expect(await prisma.normasConvivencia.count()).toBe(1);
  });

  it("una falla del repositorio responde 500 sin exponer detalles de infraestructura", async () => {
    const session = await fixture("USER");
    const lookup = vi.spyOn(prisma.normasConvivencia, "findUnique").mockRejectedValueOnce(new Error("secret-db-password Prisma P1001"));
    try {
      const response = await get(session.cookie);
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toMatchObject({ statusCode: 500, message: "Internal server error" });
      expect(JSON.stringify(body)).not.toMatch(/secret-db-password|Prisma|P1001/);
    } finally { lookup.mockRestore(); }
  });
});
