import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../src/generated/prisma/client.js";
import type { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { PrismaFeedbackRepository } from "../src/reviews/infrastructure/prisma-feedback.repository.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];

// All real migrations are replayed into a throwaway schema, including local enum types.
// Neither fixtures nor decisions are written to public; PostgreSQL constraints remain in use.
describe.skipIf(!databaseUrl)("T1: decisiones y concurrencia PostgreSQL en esquema aislado", () => {
  let sql: Client;
  let prisma: PrismaClient;
  let repository: PrismaFeedbackRepository;
  let schema: string;
  beforeAll(async () => {
    schema = `moderation_repo_${randomUUID().replaceAll("-", "")}`;
    sql = new Client({ connectionString: databaseUrl });
    await sql.connect();
    await sql.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"`);
    const migrations = new URL("../prisma/migrations/", import.meta.url);
    const directories = (await readdir(migrations, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
    for (const directory of directories) {
      await sql.query(await readFile(new URL(`${directory}/migration.sql`, migrations), "utf8"));
    }
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl, options: `-c search_path=${schema},public` }, { schema }) });
    await prisma.$connect();
    repository = new PrismaFeedbackRepository(prisma as unknown as PrismaService);
  }, 30_000);
  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (sql) {
      await sql.query(`DROP SCHEMA "${schema}" CASCADE`);
      await sql.end();
    }
  });
  async function fixture() {
    const owner = await prisma.user.create({ data: { email: `owner-${randomUUID()}@alu.frlp.utn.edu.ar`, displayName: "Identidad privada", passwordHash: "fixture-no-login" } });
    const admin = await prisma.user.create({ data: { email: `admin-${randomUUID()}@alu.frlp.utn.edu.ar`, displayName: "Moderación", passwordHash: "fixture-no-login", role: "ADMIN" } });
    const materia = await prisma.materia.create({ data: { nombre: `Materia ${randomUUID()}`, modalidad: "PRIMERO" } });
    const cursada = await prisma.cursada.create({ data: { materiaId: materia.id, anio: 2026, cuatrimestre: "PRIMERO" } });
    const commission = await prisma.comision.create({ data: { cursadaId: cursada.id, carrera: "S", numero: 31 } });
    const feedback = await prisma.feedback.create({ data: { autorId: owner.id, comisionId: commission.id,
      texto: "Experiencia sin moderar", anonimo: true, puntuacion: 4, comisionNombre: "S-31",
      materiaId: materia.id, materiaNombre: materia.nombre, cursadaId: commission.cursadaId, anio: 2026 } });
    return { feedback, owner: { id: owner.id, role: "USER" as const }, admin: { id: admin.id, role: "ADMIN" as const } };
  }

  it("persiste aprobación motivada y snapshots/auditoría correlacionados sin alterar texto ni identidad", async () => {
    const f = await fixture();
    expect(f.feedback.estadoModeracion).toBe("PENDIENTE");
    const result = await repository.transitionModeration(f.feedback.id, f.admin, { accion: "APROBACION", versionEsperada: 1, motivo: "  Revisión completada  " });
    expect(result).toMatchObject({ estadoModeracion: "APROBADO", versionModeracion: 2 });
    const row = await prisma.feedback.findUniqueOrThrow({ where: { id: f.feedback.id }, include: { historial: true } });
    expect(row).toMatchObject({ texto: f.feedback.texto, autorId: f.owner.id, anonimo: true, puntuacion: 4, deletedAt: null });
    expect(row.historial).toHaveLength(1);
    expect(row.historial[0]).toMatchObject({ accion: "APROBACION", estadoModeracion: "APROBADO", versionModeracion: 2, motivoModeracion: "Revisión completada", texto: f.feedback.texto });
    expect(await prisma.administracionHistorial.findUnique({ where: { id: row.historial[0]!.id } })).toMatchObject({ actorId: f.admin.id, entidadId: f.feedback.id, accion: "APROBACION" });
    expect(result).not.toHaveProperty("autorId");
  });

  it("dos decisiones concurrentes sobre la misma versión producen un solo evento y un conflicto", async () => {
    const f = await fixture();
    const results = await Promise.allSettled([
      repository.transitionModeration(f.feedback.id, f.admin, { accion: "APROBACION", versionEsperada: 1, motivo: "Publicable" }),
      repository.transitionModeration(f.feedback.id, f.admin, { accion: "RECHAZO", versionEsperada: 1, motivo: "Infracción" }),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(result => result.status === "rejected");
    expect(rejected).toMatchObject({ status: "rejected", reason: { httpStatus: 409 } });
    expect((await prisma.feedback.findUniqueOrThrow({ where: { id: f.feedback.id } })).versionModeracion).toBe(2);
    expect(await prisma.feedbackHistorial.count({ where: { feedbackId: f.feedback.id } })).toBe(1);
    expect(await prisma.administracionHistorial.count({ where: { entidad: "feedback", entidadId: f.feedback.id } })).toBe(1);
  });

  it("fallo real del ledger revierte también estado, versión y snapshot anidado", async () => {
    const f = await fixture();
    // The decision passes domain authorization, then fails the real audit actor foreign key.
    await expect(repository.transitionModeration(f.feedback.id, { id: randomUUID(), role: "ADMIN" }, {
      accion: "RECHAZO", versionEsperada: 1, motivo: "Revisión administrativa",
    })).rejects.toMatchObject({ code: "P2003" });
    expect(await prisma.feedback.findUniqueOrThrow({ where: { id: f.feedback.id } })).toMatchObject({ estadoModeracion: "PENDIENTE", versionModeracion: 1, motivoRechazo: null });
    expect(await prisma.feedbackHistorial.count({ where: { feedbackId: f.feedback.id } })).toBe(0);
    expect(await prisma.administracionHistorial.count({ where: { entidadId: f.feedback.id } })).toBe(0);
  });

  it("ocultar/restituir ADMIN mantiene causas de autor/reportes y no rechaza contenido", async () => {
    const f = await fixture();
    await prisma.feedback.update({ where: { id: f.feedback.id }, data: { estadoModeracion: "APROBADO", ocultoAutor: true, ocultoReportes: true } });
    const hidden = await repository.transitionModeration(f.feedback.id, f.admin, { accion: "OCULTAMIENTO_ADMIN", versionEsperada: 1, motivo: "Revisión urgente" });
    expect(hidden).toMatchObject({ estadoModeracion: "APROBADO", ocultoAutor: true, ocultoAdministracion: true, ocultoReportes: true });
    const restored = await repository.transitionModeration(f.feedback.id, f.admin, { accion: "RESTITUCION_ADMIN", versionEsperada: 2, motivo: "Causa administrativa levantada" });
    expect(restored).toMatchObject({ estadoModeracion: "APROBADO", ocultoAutor: true, ocultoAdministracion: false, ocultoReportes: true, versionModeracion: 3 });
    await expect(repository.transitionModeration(f.feedback.id, f.owner, { accion: "RESTITUCION_AUTOR", versionEsperada: 3 })).rejects.toMatchObject({ httpStatus: 409 });
    expect(await prisma.feedbackHistorial.count({ where: { feedbackId: f.feedback.id } })).toBe(2);
  });

  it("no-op voluntario no duplica historial y la versión vieja sigue devolviendo conflicto", async () => {
    const f = await fixture();
    await prisma.feedback.update({ where: { id: f.feedback.id }, data: { estadoModeracion: "APROBADO" } });
    await repository.transitionModeration(f.feedback.id, f.owner, { accion: "OCULTAMIENTO_AUTOR", versionEsperada: 1 });
    await expect(repository.transitionModeration(f.feedback.id, f.owner, { accion: "OCULTAMIENTO_AUTOR", versionEsperada: 1 })).rejects.toMatchObject({ httpStatus: 409 });
    expect(await repository.transitionModeration(f.feedback.id, f.owner, { accion: "OCULTAMIENTO_AUTOR", versionEsperada: 2 })).toMatchObject({ versionModeracion: 2, ocultoAutor: true });
    expect(await prisma.feedbackHistorial.count({ where: { feedbackId: f.feedback.id } })).toBe(1);
    expect(await prisma.administracionHistorial.count({ where: { entidadId: f.feedback.id } })).toBe(1);
  });

  it("rechazo exige corrección persistida frente al último snapshot y reenvía siempre a humano", async () => {
    const f = await fixture();
    await repository.transitionModeration(f.feedback.id, f.admin, { accion: "RECHAZO", versionEsperada: 1, motivo: "Corregir contenido" });
    await expect(repository.transitionModeration(f.feedback.id, f.owner, { accion: "SOLICITUD_REVISION", versionEsperada: 2 })).rejects.toMatchObject({ httpStatus: 409 });
    // Fixture simulates the future T3 editor; this test does not introduce an edit endpoint.
    await prisma.feedback.update({ where: { id: f.feedback.id }, data: { texto: "Contenido corregido", versionModeracion: 3 } });
    expect(await repository.transitionModeration(f.feedback.id, f.owner, { accion: "SOLICITUD_REVISION", versionEsperada: 3 })).toMatchObject({ estadoModeracion: "PENDIENTE", requiereRevisionHumana: true, versionModeracion: 4 });
    expect((await prisma.feedbackHistorial.findFirstOrThrow({ where: { feedbackId: f.feedback.id, accion: "SOLICITUD_REVISION" } })).texto).toBe("Contenido corregido");
  });

  it("el último rechazo es el de mayor versión aun si fecha empata y el UUID anterior ordena primero", async () => {
    const f = await fixture();
    const createdAt = new Date("2026-11-17T01:00:00.000Z");
    const currentText = "Texto del segundo rechazo";
    await prisma.feedback.update({ where: { id: f.feedback.id }, data: {
      estadoModeracion: "RECHAZADO", versionModeracion: 3, requiereRevisionHumana: true,
      motivoRechazo: "Corregir segundo contenido", texto: currentText,
    } });
    const snapshot = { feedbackId: f.feedback.id, accion: "RECHAZO" as const, anonimo: true,
      puntuacion: 4, estadoModeracion: "RECHAZADO" as const, requiereRevisionHumana: true,
      motivoRechazo: "Corregir contenido", createdAt };
    await prisma.feedbackHistorial.createMany({ data: [
      { ...snapshot, id: "ffffffff-ffff-4fff-8fff-ffffffffffff", versionModeracion: 2, texto: "Texto del primer rechazo" },
      { ...snapshot, id: "00000000-0000-4000-8000-000000000001", versionModeracion: 3, texto: currentText },
    ] });
    await expect(repository.transitionModeration(f.feedback.id, f.owner, { accion: "SOLICITUD_REVISION", versionEsperada: 3 })).rejects.toMatchObject({ httpStatus: 409 });
    expect(await prisma.feedbackHistorial.count({ where: { feedbackId: f.feedback.id } })).toBe(2);
    await prisma.feedback.update({ where: { id: f.feedback.id }, data: { texto: "Texto realmente corregido", versionModeracion: 4 } });
    expect(await repository.transitionModeration(f.feedback.id, f.owner, { accion: "SOLICITUD_REVISION", versionEsperada: 4 })).toMatchObject({ estadoModeracion: "PENDIENTE", requiereRevisionHumana: true, versionModeracion: 5 });
  });

  it("autoría, rol y autorrevisión se validan sin crear eventos", async () => {
    const f = await fixture();
    await expect(repository.transitionModeration(f.feedback.id, f.owner, { accion: "APROBACION", versionEsperada: 1, motivo: "Autoaprobación" })).rejects.toMatchObject({ httpStatus: 403 });
    await expect(repository.transitionModeration(f.feedback.id, { id: f.owner.id, role: "ADMIN" }, { accion: "APROBACION", versionEsperada: 1, motivo: "Autoaprobación" })).rejects.toMatchObject({ httpStatus: 403 });
    await expect(repository.transitionModeration(f.feedback.id, f.admin, { accion: "SOLICITUD_REVISION", versionEsperada: 1 })).rejects.toMatchObject({ httpStatus: 403 });
    expect(await prisma.feedbackHistorial.count({ where: { feedbackId: f.feedback.id } })).toBe(0);
  });

  it("una baja permanece inaccesible para transiciones aun al administrador", async () => {
    const f = await fixture();
    const deletedAt = new Date();
    await prisma.feedback.update({ where: { id: f.feedback.id }, data: { deletedAt } });
    await expect(repository.transitionModeration(f.feedback.id, f.admin, { accion: "APROBACION", versionEsperada: 1, motivo: "No debe aplicar" })).rejects.toMatchObject({ httpStatus: 404 });
    expect(await prisma.feedback.findUniqueOrThrow({ where: { id: f.feedback.id } })).toMatchObject({ deletedAt, estadoModeracion: "PENDIENTE", versionModeracion: 1 });
    expect(await prisma.feedbackHistorial.count({ where: { feedbackId: f.feedback.id } })).toBe(0);
  });
});
