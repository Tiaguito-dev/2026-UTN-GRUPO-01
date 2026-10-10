import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { ProvisionAdmin } from "../src/auth/application/provision-admin.js";
import { Argon2PasswordHasher } from "../src/auth/infrastructure/argon2-password-hasher.js";
import { PrismaUserRepository } from "../src/users/infrastructure/prisma-user.repository.js";
import { AdminProvisionConflictError } from "../src/auth/domain/errors.js";
import { EmailAlreadyRegisteredError } from "../src/users/domain/errors.js";
import { AUTH_CONFIG } from "../src/auth/auth.config.js";
import { configureAuthHttp } from "../src/auth/presentation/http-security.js";
import { testAuthConfig, csrfHeaders } from "./auth-test.config.js";

// Nunca usar DATABASE_URL como fallback: esta suite exige una base de pruebas explícita.
const testDatabaseUrl = process.env["TEST_DATABASE_URL"];
const createdIds = new Set<string>();

describe.skipIf(!testDatabaseUrl)("Autenticación HTTP y persistencia PostgreSQL real", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let repository: PrismaUserRepository;
  let provision: ProvisionAdmin;
  let baseUrl: string;
  const password = " contraseña real verificable ";
  const hasher = new Argon2PasswordHasher();

  const uniqueEmail = () => `auth-test-${randomUUID()}@alu.frlp.utn.edu.ar`;
  const post = (body: unknown) => fetch(`${baseUrl}/auth/register`, { method: "POST", headers: csrfHeaders, body: JSON.stringify(body) });

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
    await prisma.$connect();
    repository = new PrismaUserRepository(prisma as PrismaService);
    provision = new ProvisionAdmin(repository, hasher);
    const config = testAuthConfig();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_CONFIG).useValue(config)
      .overrideProvider(PrismaService).useValue(prisma).compile();
    app = moduleRef.createNestApplication();
    app.useLogger(false);
    configureAuthHttp(app, config);
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  }, 20_000);

  afterAll(async () => {
    // Solo elimina UUID obtenidos por esta suite; no trunca tablas ni toca cuentas existentes.
    if (prisma && createdIds.size > 0) await prisma.user.deleteMany({ where: { id: { in: [...createdIds] } } });
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  it.each(["12345678", "😀".repeat(8)])("registro admite ocho caracteres y rechaza siete con persistencia real", async (accepted) => {
    const email = uniqueEmail();
    const rejected = await post({ email, displayName: "Límite", password: Array.from(accepted).slice(0, 7).join("") });
    expect(rejected.status).toBe(400);
    expect(await prisma.user.count({ where: { email } })).toBe(0);
    const registered = await post({ email, displayName: "Límite", password: accepted });
    const body = await registered.json(); if (typeof body.id === "string") createdIds.add(body.id);
    expect(registered.status).toBe(201);
    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    await expect(hasher.verify(stored.passwordHash, accepted)).resolves.toBe(true);
  });

  it("POST persiste USER, normaliza email, almacena hash verificable y devuelve únicamente datos públicos", async () => {
    const email = uniqueEmail();
    const response = await post({ email: ` ${email.toUpperCase()} `, displayName: " Persona ", password });
    const body = await response.json();
    if (typeof body.id === "string") createdIds.add(body.id);
    expect(response.status).toBe(201);
    expect(Object.keys(body).sort()).toEqual(["createdAt", "displayName", "email", "id", "role"]);
    expect(body).toMatchObject({ email, displayName: "Persona", role: "USER" });
    expect(Number.isNaN(Date.parse(body.createdAt))).toBe(false);
    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.role).toBe("USER");
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    await expect(hasher.verify(stored.passwordHash, password)).resolves.toBe(true);
    expect(JSON.stringify(body)).not.toContain(stored.passwordHash);
    expect(JSON.stringify(body)).not.toContain(password);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each([
    { email: "not-an-email", displayName: "Persona", password },
    { email: "valid@example.com", displayName: "", password },
    { email: "valid@example.com", displayName: "Persona", password: "short" },
    { email: "valid@example.com", displayName: "Persona", password, role: "ADMIN" },
    { email: "valid@example.com", displayName: "Persona", password, role: "USER" },
    { email: "valid@example.com", displayName: "Persona", password, extra: true },
    { email: "estudiante@gmail.com", displayName: "Persona", password },
  ])("devuelve 400 seguro ante entrada inválida: %#", async (input) => {
    const response = await post(input);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body).toMatchObject({ statusCode: 400, error: expect.any(String), message: expect.any(String) });
    expect(JSON.stringify(body)).not.toContain(input.password);
    expect(JSON.stringify(body)).not.toContain("passwordHash");
  });

  it("el JSON malformado no refleja fragmentos sensibles del body en el error", async () => {
    const secret = "private-password-do-not-echo";
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: "POST", headers: csrfHeaders, body: secret,
    });
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body).toMatchObject({ statusCode: 400, error: "Bad Request", message: expect.any(String) });
    expect(JSON.stringify(body)).not.toContain("private");
    expect(JSON.stringify(body)).not.toMatch(/SyntaxError|Unexpected token|position|password/);
  });

  it("registros concurrentes producen un único USER y 409 sin detalles internos", async () => {
    const email = uniqueEmail();
    const input = { email, displayName: "Concurrente", password };
    const responses = await Promise.all([post(input), post({ ...input, email: email.toUpperCase() })]);
    const bodies = await Promise.all(responses.map((response) => response.json()));
    for (const body of bodies) if (typeof body.id === "string") createdIds.add(body.id);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await prisma.user.count({ where: { email } })).toBe(1);
    const conflict = bodies[responses.findIndex((response) => response.status === 409)];
    expect(conflict).toMatchObject({ statusCode: 409, error: expect.any(String), message: expect.any(String) });
    expect(JSON.stringify(conflict)).not.toMatch(/Prisma|P2002|passwordHash/);
  });

  it("la restricción UNIQUE impide duplicados directos fuera del caso de uso", async () => {
    const email = uniqueEmail();
    const input = { email, displayName: "Directo", passwordHash: await hasher.hash(password), role: "USER" as const };
    const first = await prisma.user.create({ data: input });
    createdIds.add(first.id);
    await expect(prisma.user.create({ data: input })).rejects.toMatchObject({ code: "P2002" });
    await expect(repository.create(input)).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    expect(await prisma.user.count({ where: { email } })).toBe(1);
  });

  it("el adaptador normaliza todas las consultas y creaciones", async () => {
    const email = uniqueEmail();
    const first = await repository.create({ email: ` ${email.toUpperCase()} `, displayName: "Normalizado", passwordHash: await hasher.hash(password), role: "USER" });
    createdIds.add(first.id);
    expect(first.email).toBe(email);
    expect((await repository.findByEmail(` ${email.toUpperCase()} `))?.id).toBe(first.id);
  });

  it("provisión concurrente es repetible y no cambia el ADMIN existente", async () => {
    const email = uniqueEmail();
    const input = { email, displayName: "Administrador", password };
    const results = await Promise.all([provision.execute(input), provision.execute(input)]);
    for (const result of results) createdIds.add(result.user.id);
    expect(results.map((result) => result.status).sort()).toEqual(["already-exists", "created"]);
    expect(await prisma.user.count({ where: { email } })).toBe(1);
    const before = await prisma.user.findUniqueOrThrow({ where: { email } });
    const again = await provision.execute({ ...input, displayName: "No reemplazar", password: "Otra contraseña completamente diferente" });
    expect(again.status).toBe("already-exists");
    const after = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(after).toEqual(before);
    expect(after.role).toBe("ADMIN");
    await expect(hasher.verify(after.passwordHash, password)).resolves.toBe(true);
    expect(again.user).not.toHaveProperty("passwordHash");
  });

  it("provisión aborta sin promover ni modificar un USER persistido", async () => {
    const email = uniqueEmail();
    const response = await post({ email, displayName: "Usuario", password });
    const user = await response.json();
    if (typeof user.id === "string") createdIds.add(user.id);
    expect(response.status).toBe(201);
    const before = await prisma.user.findUniqueOrThrow({ where: { email } });
    await expect(provision.execute({ email, displayName: "Administrador", password })).rejects.toBeInstanceOf(AdminProvisionConflictError);
    expect(await prisma.user.findUniqueOrThrow({ where: { email } })).toEqual(before);
  });
});
