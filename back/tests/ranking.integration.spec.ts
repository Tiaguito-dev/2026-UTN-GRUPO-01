import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { VERIFICATION_EMAIL } from "../src/auth/domain/email-verification.js";
import { AUTH_CONFIG } from "../src/auth/auth.config.js";
import { configureAuthHttp } from "../src/auth/presentation/http-security.js";
import { csrfHeaders, testAuthConfig } from "./auth-test.config.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];

describe.skipIf(!databaseUrl)("Rankings de comisiones y profesores HTTP/PostgreSQL aislado", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let baseUrl: string;
  let cookie: string;
  const users: string[] = [];
  const voters: string[] = [];
  let materiaId: string;
  let cursadaId: string;
  const comisiones: string[] = [];
  const profesores: string[] = [];
  const config = testAuthConfig();
  const get = (path: string, withSession = true) => fetch(`${baseUrl}${path}`, withSession ? { headers: { Cookie: cookie } } : {});

  // The ranking is global: walk every page so rows from other suites never hide ours.
  async function todos(path: string) {
    const items: { comision?: { id: string }; profesor?: { id: string } }[] = [];
    for (let page = 1; ; page++) {
      const response = await get(`${path}?page=${page}&pageSize=50`);
      expect(response.status).toBe(200);
      const body = await response.json() as { items: typeof items; total: number };
      items.push(...body.items);
      if (items.length >= body.total) return { items, raw: JSON.stringify(body) };
    }
  }

  async function voto(comisionId: string, voter: number, puntuacion: number, profesorId: string | null = null, deletedAt: Date | null = null) {
    const comision = await prisma.comision.findUniqueOrThrow({ where: { id: comisionId } });
    // The snapshot CHECK requires name and role whenever the vote names a professor.
    const docente = profesorId ? await prisma.comisionProfesor.findUniqueOrThrow({ where: { comisionId_profesorId: { comisionId, profesorId } }, include: { profesor: true } }) : null;
    await prisma.feedback.create({ data: { autorId: voters[voter]!, comisionId, profesorId, texto: "Experiencia", puntuacion, anonimo: false,
      comisionNombre: `${comision.carrera}-${comision.numero}`, materiaId, materiaNombre: "Ranking", cursadaId, anio: 2026, deletedAt,
      profesorNombre: docente?.profesor.nombreCompleto ?? null, profesorCargo: docente?.cargo ?? null } });
  }

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
    await prisma.$connect();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(AUTH_CONFIG).useValue(config)
      .overrideProvider(VERIFICATION_EMAIL).useValue({ send: async () => {} }).compile();
    app = moduleRef.createNestApplication();
    app.useLogger(false);
    configureAuthHttp(app, config);
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();

    const email = `ranking-${randomUUID()}@alu.frlp.utn.edu.ar`;
    const password = "isolated ranking password";
    const registered = await fetch(`${baseUrl}/auth/register`, { method: "POST", headers: csrfHeaders,
      body: JSON.stringify({ aceptaTerminos: true, versionTerminos: "terminos-2026-11-17", email, password, displayName: "Lectora de ranking" }) });
    const { id } = await registered.json() as { id: string };
    users.push(id);
    await prisma.user.update({ where: { id }, data: { emailVerifiedAt: new Date() } });
    const logged = await fetch(`${baseUrl}/auth/login`, { method: "POST", headers: csrfHeaders,
      body: JSON.stringify({ email, password }) });
    cookie = logged.headers.get("set-cookie")!.split(";")[0]!;

    for (let index = 0; index < 4; index++) {
      const user = await prisma.user.create({ data: { email: `ranking-voter-${randomUUID()}@alu.frlp.utn.edu.ar`,
        displayName: "Votante privado", passwordHash: "fixture-no-login", emailVerifiedAt: new Date() } });
      users.push(user.id);
      voters.push(user.id);
    }
    materiaId = (await prisma.materia.create({ data: { nombre: `Ranking ${randomUUID()}`, modalidad: "PRIMERO" } })).id;
    cursadaId = (await prisma.cursada.create({ data: { materiaId, anio: 2026, cuatrimestre: "PRIMERO" } })).id;
    for (const numero of [91, 92]) comisiones.push((await prisma.comision.create({ data: { cursadaId, carrera: "S", numero } })).id);
    for (const nombre of ["Ana Ranking", "Beto Ranking"]) profesores.push((await prisma.profesor.create({ data: { nombreCompleto: nombre } })).id);
    await prisma.comisionProfesor.createMany({ data: [
      { comisionId: comisiones[0]!, profesorId: profesores[0]!, cargo: "TITULAR" },
      { comisionId: comisiones[1]!, profesorId: profesores[0]!, cargo: "ADJUNTO" },
      { comisionId: comisiones[1]!, profesorId: profesores[1]!, cargo: "JTP" },
    ] });
    // S-91: 5 y 5 a Ana. S-92: 2, 2 y 2 a Ana, 4 a Beto. Un 1 retirado que no debe contar.
    await voto(comisiones[0]!, 0, 5, profesores[0]!);
    await voto(comisiones[0]!, 1, 5, profesores[0]!);
    await voto(comisiones[1]!, 0, 2, profesores[0]!);
    await voto(comisiones[1]!, 1, 2, profesores[0]!);
    await voto(comisiones[1]!, 2, 2, profesores[0]!);
    await voto(comisiones[1]!, 3, 4, profesores[1]!);
    await voto(comisiones[0]!, 2, 1, null, new Date());
  }, 30_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.feedback.deleteMany({ where: { comisionId: { in: comisiones } } });
      await prisma.comisionProfesor.deleteMany({ where: { comisionId: { in: comisiones } } });
      await prisma.comision.deleteMany({ where: { id: { in: comisiones } } });
      await prisma.profesor.deleteMany({ where: { id: { in: profesores } } });
      await prisma.cursada.deleteMany({ where: { id: cursadaId } });
      await prisma.materia.deleteMany({ where: { id: materiaId } });
      await prisma.refreshCredential.deleteMany({ where: { session: { userId: { in: users } } } });
      await prisma.session.deleteMany({ where: { userId: { in: users } } });
      await prisma.emailVerificationCredential.deleteMany({ where: { userId: { in: users } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  it("ordena comisiones por promedio sin contar comentarios retirados ni exponer autores", async () => {
    const { items, raw } = await todos("/rankings/comisiones");
    const nuestras = items.filter(item => comisiones.includes(item.comision!.id));
    expect(nuestras).toMatchObject([
      { comision: { id: comisiones[0], nombre: "S-91" }, valoracion: { promedio: 5, cantidad: 2 } },
      { comision: { id: comisiones[1], nombre: "S-92" }, valoracion: { promedio: 2.5, cantidad: 4 } },
    ]);
    for (const id of voters) expect(raw).not.toContain(id);
    expect(raw).not.toContain("Votante privado");
  });

  it("junta las valoraciones de cada profesor por comisión con promedio ponderado", async () => {
    const { items } = await todos("/rankings/profesores");
    const nuestros = items.filter(item => profesores.includes(item.profesor!.id));
    expect(nuestros).toMatchObject([
      { profesor: { id: profesores[1], nombreCompleto: "Beto Ranking" }, valoracion: { promedio: 4, cantidad: 1 } },
      // (5 + 5 + 2 + 2 + 2) / 5 = 3.2; un promedio de promedios daría 3.5.
      { profesor: { id: profesores[0], nombreCompleto: "Ana Ranking" }, valoracion: { promedio: 3.2, cantidad: 5 }, comisiones: [
        { comision: { id: comisiones[0] }, cargo: "TITULAR", valoracion: { promedio: 5, cantidad: 2 } },
        { comision: { id: comisiones[1] }, cargo: "ADJUNTO", valoracion: { promedio: 2, cantidad: 3 } },
      ] },
    ]);
  });

  it("filtra por cursada, busca profesores sin votos, devuelve el perfil y sus comentarios", async () => {
    const porCursada = await (await get(`/rankings/comisiones?cursadaId=${cursadaId}`)).json() as { items: { posicion: number; comision: { id: string } }[] };
    expect(porCursada.items.map(item => [item.posicion, item.comision.id])).toEqual([[1, comisiones[0]], [2, comisiones[1]]]);
    const sinVotos = (await prisma.profesor.create({ data: { nombreCompleto: "Carla Ránking Sinvotos" } })).id;
    profesores.push(sinVotos);
    const busqueda = await (await get("/rankings/profesores?q=ranking%20sinvotos")).json() as { items: { posicion: number | null; profesor: { id: string } }[] };
    expect(busqueda.items).toEqual([expect.objectContaining({ posicion: null, profesor: expect.objectContaining({ id: sinVotos }) })]);
    expect(await (await get(`/rankings/profesores/${profesores[0]}`)).json()).toMatchObject({ valoracion: { promedio: 3.2, cantidad: 5 } });
    expect((await get(`/rankings/profesores/${randomUUID()}`)).status).toBe(404);
    const comentarios = await (await get(`/feedback?profesorId=${profesores[1]}`)).json() as { items: { profesor: { id: string } }[]; total: number };
    expect(comentarios.total).toBe(1);
    expect(comentarios.items[0]!.profesor.id).toBe(profesores[1]);
  });

  it("aplica el mínimo de votos, exige sesión y rechaza parámetros inválidos", async () => {
    const filtrado = await get("/rankings/profesores?minValoraciones=2&pageSize=50");
    const ids = ((await filtrado.json()) as { items: { profesor: { id: string } }[] }).items.map(item => item.profesor.id);
    expect(ids).not.toContain(profesores[1]);
    expect((await get("/rankings/comisiones", false)).status).toBe(401);
    expect((await get("/rankings/comisiones?pageSize=500")).status).toBe(400);
  });
});
