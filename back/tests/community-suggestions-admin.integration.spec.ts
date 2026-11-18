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
describe.skipIf(!databaseUrl)("HU-C03 bandeja privada en PostgreSQL y HTTP", () => {
  let app: INestApplication; let prisma: PrismaClient; let base: string;
  const ids: string[] = []; const config = testAuthConfig(); const tokens = new JoseAccessTokenService(config);
  type Actor = { id: string; cookie: string };
  let user: Actor; let admin: Actor; let otherAdmin: Actor;
  async function fixture(role: "USER" | "ADMIN"): Promise<Actor> {
    const now = new Date(Math.floor(Date.now() / 1000) * 1000);
    const account = await prisma.user.create({ data: { email: `inbox-${randomUUID()}@example.test`, displayName: role === "USER" ? "Estudiante real" : "Administración", passwordHash: "fixture-unused", role, emailVerifiedAt: now } }); ids.push(account.id);
    const session = await prisma.session.create({ data: { id: randomUUID(), userId: account.id, createdAt: now, lastActivityAt: now, expiresAt: new Date(now.getTime() + 86400_000) } });
    const token = await tokens.issue({ userId: account.id, sessionId: session.id, issuedAt: now.getTime() / 1000, expiresAt: now.getTime() / 1000 + 900 });
    return { id: account.id, cookie: `${config.cookieName}=${token}` };
  }
  const call = (path: string, actor?: Actor, method = "GET", body?: unknown, headers = csrfHeaders) => fetch(`${base}/comunidad/sugerencias${path}`, {
    method, headers: { ...headers, Cookie: actor?.cookie ?? "" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const create = async (text = "Idea privada") => {
    const body = { solicitudId: randomUUID(), categoria: "OTROS", contenido: text };
    const response = await call("", user, "POST", body); expect(response.status).toBe(201);
    return { receipt: await response.json() as { id: string; createdAt: string }, body };
  };
  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) }); await prisma.$connect();
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prisma).overrideProvider(AUTH_CONFIG).useValue(config).compile();
    app = module.createNestApplication(); app.useLogger(false); configureAuthHttp(app, config); await app.listen(0, "127.0.0.1"); base = await app.getUrl();
    user = await fixture("USER"); admin = await fixture("ADMIN"); otherAdmin = await fixture("ADMIN");
  }, 20_000);
  afterAll(async () => {
    if (prisma && ids.length) {
      await prisma.sugerencia.deleteMany({ where: { usuarioId: { in: ids } } });
      await prisma.session.deleteMany({ where: { userId: { in: ids } } }); await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    if (app) await app.close(); if (prisma) await prisma.$disconnect();
  });

  it("rechaza cada operación sin sesión y con USER, sin exponer contenido", async () => {
    const { receipt } = await create("Contenido que nunca ve un visitante");
    for (const actor of [undefined, user]) for (const [path, method, body] of [
      ["", "GET", undefined], [`/${receipt.id}/me-gusta`, "PUT", { meGusta: true }], [`/${receipt.id}`, "DELETE", undefined],
    ] as const) {
      const response = await call(path, actor, method, body);
      expect(response.status).toBe(actor ? 403 : 401);
      expect(await response.text()).not.toContain("Contenido que nunca ve un visitante");
    }
    expect(await prisma.sugerencia.findUnique({ where: { id: receipt.id } })).toMatchObject({ meGusta: false, deletedAt: null });
  });
  it("usa datos reales, orden estable descendente y total paginado sin claves privadas", async () => {
    await prisma.sugerencia.deleteMany({ where: { usuarioId: user.id } });
    const first = await create("Primera idea"); const second = await create("Segunda idea"); const third = await create("Tercera idea");
    await prisma.sugerencia.update({ where: { id: first.receipt.id }, data: { createdAt: new Date("2026-01-01") } });
    await prisma.sugerencia.updateMany({ where: { id: { in: [second.receipt.id, third.receipt.id] } }, data: { createdAt: new Date("2026-02-01") } });
    const response = await call("?page=1&pageSize=2", admin); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    const data = await response.json(); expect(data).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(data.items.map((item: { id: string }) => item.id)).toEqual([second.receipt.id, third.receipt.id].sort().reverse());
    expect(Object.keys(data.items[0]).sort()).toEqual(["autor", "categoria", "contenido", "createdAt", "id", "meGusta"]);
    expect(data.items[0].autor).toEqual({ displayName: "Estudiante real" });
    expect((await (await call("?page=2&pageSize=2", admin)).json()).items[0].id).toBe(first.receipt.id);
  });
  it("Me gusta es una asignación compartida persistente, repetible y filtrable", async () => {
    const { receipt } = await create();
    for (const value of [true, true, false, true]) {
      const response = await call(`/${receipt.id}/me-gusta`, admin, "PUT", { meGusta: value }); expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ id: receipt.id, meGusta: value });
      expect(await prisma.sugerencia.findUnique({ where: { id: receipt.id } })).toMatchObject({ meGusta: value });
    }
    const filtered = await (await call("?soloMeGusta=true", otherAdmin)).json();
    expect(filtered.items.map((item: { id: string }) => item.id)).toEqual([receipt.id]);
    await call(`/${receipt.id}/me-gusta`, otherAdmin, "PUT", { meGusta: false });
    expect(await (await call("?soloMeGusta=true", admin)).json()).toMatchObject({ items: [], total: 0 });
  });
  it.each(["", "true", 1, null])("rechaza Me gusta no booleano: %j", async meGusta => {
    const { receipt } = await create();
    expect((await call(`/${receipt.id}/me-gusta`, admin, "PUT", { meGusta })).status).toBe(400);
  });
  it("rechaza omisión y campos extra sin cambiar la sugerencia", async () => {
    const { receipt } = await create();
    for (const body of [{}, { meGusta: true, autor: user.id }]) expect((await call(`/${receipt.id}/me-gusta`, admin, "PUT", body)).status).toBe(400);
    expect(await prisma.sugerencia.findUnique({ where: { id: receipt.id } })).toMatchObject({ meGusta: false });
  });
  it.each(["?page=0", "?pageSize=101", "?soloMeGusta=1", "?soloMeGusta=true&soloMeGusta=false", "?autor=x"])("rechaza filtros inválidos: %s", async query => {
    expect((await call(query, admin)).status).toBe(400);
  });
  it("elimina de ambas vistas y conserva el recibo idempotente sin resucitar", async () => {
    const { receipt, body } = await create("No debe resucitar");
    await call(`/${receipt.id}/me-gusta`, admin, "PUT", { meGusta: true });
    const response = await call(`/${receipt.id}`, admin, "DELETE"); expect(response.status).toBe(204); expect(await response.text()).toBe("");
    const deleted = await prisma.sugerencia.findUniqueOrThrow({ where: { id: receipt.id } }); expect(deleted.deletedAt).toBeInstanceOf(Date);
    for (const filter of ["false", "true"]) {
      const data = await (await call(`?soloMeGusta=${filter}`, otherAdmin)).json();
      expect(data.items.map((item: { id: string }) => item.id)).not.toContain(receipt.id);
    }
    const retry = await call("", user, "POST", body); expect(retry.status).toBe(201); expect(await retry.json()).toEqual(receipt);
    expect((await prisma.sugerencia.findUniqueOrThrow({ where: { id: receipt.id } })).deletedAt).toEqual(deleted.deletedAt);
    expect((await call(`/${receipt.id}/me-gusta`, admin, "PUT", { meGusta: false })).status).toBe(404);
    expect((await call(`/${receipt.id}`, admin, "DELETE")).status).toBe(404);
    expect((await call("", user, "POST", { ...body, contenido: "Otro contenido" })).status).toBe(409);
  });
  it("rechaza ID inválido y no encontrado", async () => {
    for (const method of ["PUT", "DELETE"]) for (const id of ["invalid", randomUUID()]) {
      expect((await call(`/${id}${method === "PUT" ? "/me-gusta" : ""}`, admin, method, method === "PUT" ? { meGusta: true } : undefined)).status).toBe(id === "invalid" ? 400 : 404);
    }
  });
  it("exige CSRF y Origin válido para ambas escrituras", async () => {
    const { receipt } = await create();
    for (const method of ["PUT", "DELETE"]) for (const headers of [{ ...csrfHeaders, "X-CSRF-Protection": "" }, { ...csrfHeaders, Origin: "https://otro.example" }]) {
      expect((await call(`/${receipt.id}${method === "PUT" ? "/me-gusta" : ""}`, admin, method, method === "PUT" ? { meGusta: true } : undefined, headers)).status).toBe(403);
    }
    expect(await prisma.sugerencia.findUnique({ where: { id: receipt.id } })).toMatchObject({ meGusta: false, deletedAt: null });
  });
  it("no expone errores internos de persistencia", async () => {
    const spy = vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(new Error("secret PostgreSQL password"));
    try { const response = await call("", admin); expect(response.status).toBe(500); expect(await response.text()).not.toMatch(/secret|password|PostgreSQL/); }
    finally { spy.mockRestore(); }
  });
});
