import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { moderationHarness, type ModerationHarness } from "./support/moderation-harness.js";
import { PrismaFeedbackRepository } from "../src/reviews/infrastructure/prisma-feedback.repository.js";
import { lockMateriaVote, syncMateriaVote } from "../src/reviews/infrastructure/prisma-feedback-rating.js";
import type { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
describe.skipIf(!databaseUrl)("T2: estadísticas visibles y proyección única PostgreSQL", () => {
  let h: ModerationHarness;
  let repo: PrismaFeedbackRepository;
  let owner: Awaited<ReturnType<ModerationHarness["account"]>>;
  let reader: typeof owner;
  let admin: typeof owner;
  beforeAll(async () => { h = await moderationHarness(databaseUrl!); repo = new PrismaFeedbackRepository(h.prisma as unknown as PrismaService); }, 30_000);
  beforeEach(async () => { await h.reset(); owner = await h.account(); reader = await h.account(); admin = await h.account("ADMIN"); });
  afterAll(async () => { if (h) await h.close(); });
  const moderator = () => ({ id: admin.id, role: "ADMIN" as const });
  async function rating(materiaId: string, userId = owner.id) {
    return h.prisma.valoracionMateria.findUnique({ where: { usuarioId_materiaId: { usuarioId: userId, materiaId } } });
  }
  async function summary(materiaId: string) {
    const response = await h.request(`/materias/${materiaId}`, reader.cookie);
    expect(response.status).toBe(200);
    return (await response.json()).valoracion;
  }
  async function secondCommission(context: Awaited<ReturnType<ModerationHarness["context"]>>, numero = 32) {
    const comision = await h.prisma.comision.create({ data: { cursadaId: context.cursada.id, carrera: "S", numero } });
    return { ...context, comision };
  }

  it("POST publica y contribuye inmediatamente al promedio", async () => {
    const context = await h.context();
    const response = await h.request(`/comisiones/${context.comision.id}/feedback`, owner.cookie, "POST", {
      texto: "Nueva experiencia para revisión", anonimo: true, puntuacion: 5,
    });
    expect(response.status).toBe(201);
    const created = await response.json();
    expect(await h.prisma.feedback.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ estadoModeracion: "APROBADO", versionModeracion: 1 });
    expect(await rating(context.materia.id)).toMatchObject({ puntuacion: 5, deletedAt: null });
    expect(await summary(context.materia.id)).toEqual({ promedio: 5, cantidad: 1 });
    const snapshot = await h.prisma.feedbackHistorial.findFirstOrThrow({ where: { feedbackId: created.id } });
    expect(snapshot).toMatchObject({ estadoModeracion: "APROBADO", versionModeracion: 1, puntuacion: 5 });
    expect(await rating(context.materia.id)).toMatchObject({ puntuacion: 5, deletedAt: null });
    expect(await summary(context.materia.id)).toEqual({ promedio: 5, cantidad: 1 });
  });

  it("ocultamientos independientes quitan contribución y levantar solo una causa no publica", async () => {
    const context = await h.context();
    const feedback = await h.feedback(context, owner.id, { estadoModeracion: "PENDIENTE", puntuacion: 4 });
    await repo.transitionModeration(feedback.id, moderator(), { accion: "APROBACION", versionEsperada: 1, motivo: "Publicable" });
    await repo.transitionModeration(feedback.id, { id: owner.id, role: "USER" }, { accion: "OCULTAMIENTO_AUTOR", versionEsperada: 2 });
    expect((await rating(context.materia.id))?.deletedAt).toBeInstanceOf(Date);
    expect(await summary(context.materia.id)).toEqual({ promedio: null, cantidad: 0 });
    await repo.transitionModeration(feedback.id, moderator(), { accion: "OCULTAMIENTO_ADMIN", versionEsperada: 3, motivo: "Revisar" });
    await repo.transitionModeration(feedback.id, moderator(), { accion: "RESTITUCION_ADMIN", versionEsperada: 4, motivo: "Causa administrativa cerrada" });
    expect(await summary(context.materia.id)).toEqual({ promedio: null, cantidad: 0 });
    expect((await rating(context.materia.id))?.deletedAt).toBeInstanceOf(Date);
    await repo.transitionModeration(feedback.id, { id: owner.id, role: "USER" }, { accion: "RESTITUCION_AUTOR", versionEsperada: 5 });
    expect(await summary(context.materia.id)).toEqual({ promedio: 4, cantidad: 1 });
    // T5 will own the triggering action. Here only its persisted cause and T2 sync are exercised.
    await h.prisma.$transaction(async tx => {
      await lockMateriaVote(tx, owner.id, context.materia.id);
      await tx.feedback.update({ where: { id: feedback.id }, data: { ocultoReportes: true } });
      await syncMateriaVote(tx, owner.id, context.materia.id, new Date());
    });
    expect(await summary(context.materia.id)).toEqual({ promedio: null, cantidad: 0 });
    expect((await rating(context.materia.id))?.deletedAt).toBeInstanceOf(Date);
    await repo.transitionModeration(feedback.id, moderator(), { accion: "OCULTAMIENTO_ADMIN", versionEsperada: 6, motivo: "Revisión adicional" });
    await repo.transitionModeration(feedback.id, moderator(), { accion: "RESTITUCION_ADMIN", versionEsperada: 7, motivo: "Causa administrativa cerrada" });
    expect(await summary(context.materia.id)).toEqual({ promedio: null, cantidad: 0 });
    expect((await rating(context.materia.id))?.deletedAt).toBeInstanceOf(Date);
    await h.prisma.$transaction(async tx => {
      await lockMateriaVote(tx, owner.id, context.materia.id);
      await tx.feedback.update({ where: { id: feedback.id }, data: { ocultoReportes: false } });
      await syncMateriaVote(tx, owner.id, context.materia.id, new Date());
    });
    expect(await summary(context.materia.id)).toEqual({ promedio: 4, cantidad: 1 });
  });

  it("aprobar contenido antiguo no reemplaza al voto de contenido más reciente; ocultar selecciona respaldo", async () => {
    const context = await h.context();
    const other = await secondCommission(context);
    const old = await h.feedback(context, owner.id, { estadoModeracion: "PENDIENTE", puntuacion: 1, createdAt: new Date("2026-01-01") });
    const recent = await h.feedback(other, owner.id, { estadoModeracion: "PENDIENTE", puntuacion: 5, createdAt: new Date("2026-01-02") });
    await repo.transitionModeration(recent.id, moderator(), { accion: "APROBACION", versionEsperada: 1, motivo: "Publicable reciente" });
    await repo.transitionModeration(old.id, moderator(), { accion: "APROBACION", versionEsperada: 1, motivo: "Publicable anterior" });
    expect(await rating(context.materia.id)).toMatchObject({ puntuacion: 5, deletedAt: null });
    expect(await summary(context.materia.id)).toEqual({ promedio: 5, cantidad: 1 });
    expect(await h.prisma.valoracionMateria.count({ where: { usuarioId: owner.id, materiaId: context.materia.id } })).toBe(1);
    await repo.transitionModeration(recent.id, moderator(), { accion: "OCULTAMIENTO_ADMIN", versionEsperada: 2, motivo: "Revisión de texto reciente" });
    expect(await rating(context.materia.id)).toMatchObject({ puntuacion: 1, deletedAt: null });
    await repo.update(old.id, owner.id, { puntuacion: 2 });
    expect(await h.prisma.feedback.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({ estadoModeracion: "APROBADO", puntuacion: 2, versionModeracion: 3 });
    expect(await summary(context.materia.id)).toEqual({ promedio: 2, cantidad: 1 });
    expect(await rating(context.materia.id)).toMatchObject({ puntuacion: 2, deletedAt: null });
  });

  it("rechazo y baja retiran votos; edición de rechazado no restaura publicación automáticamente", async () => {
    const context = await h.context();
    const feedback = await h.feedback(context, owner.id, { estadoModeracion: "PENDIENTE" });
    await repo.transitionModeration(feedback.id, moderator(), { accion: "APROBACION", versionEsperada: 1, motivo: "Publicable" });
    await repo.transitionModeration(feedback.id, moderator(), { accion: "RECHAZO", versionEsperada: 2, motivo: "Corregir texto" });
    expect((await rating(context.materia.id))?.deletedAt).toBeInstanceOf(Date);
    await repo.update(feedback.id, owner.id, { texto: "Texto corregido" });
    expect(await h.prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } })).toMatchObject({ estadoModeracion: "RECHAZADO", requiereRevisionHumana: true, versionModeracion: 4 });
    expect(await summary(context.materia.id)).toEqual({ promedio: null, cantidad: 0 });
    await repo.transitionModeration(feedback.id, { id: owner.id, role: "USER" }, { accion: "SOLICITUD_REVISION", versionEsperada: 4 });
    await repo.transitionModeration(feedback.id, moderator(), { accion: "APROBACION", versionEsperada: 5, motivo: "Corrección publicable" });
    expect(await summary(context.materia.id)).toEqual({ promedio: 4, cantidad: 1 });
    await repo.remove(feedback.id, owner.id);
    expect((await rating(context.materia.id))?.deletedAt).toBeInstanceOf(Date);
    expect(await summary(context.materia.id)).toEqual({ promedio: null, cantidad: 0 });
    const recreated = await repo.create(context.comision.id, owner.id, { texto: "Otro intento", anonimo: true, puntuacion: 5 });
    expect(await h.prisma.feedback.findUniqueOrThrow({ where: { id: recreated.id } })).toMatchObject({ estadoModeracion: "APROBADO", requiereRevisionHumana: false });
    expect(await summary(context.materia.id)).toEqual({ promedio: 5, cantidad: 1 });
  });

  it("conserva un voto bajo aprobaciones concurrentes de dos comisiones y rollback de auditoría", async () => {
    const context = await h.context();
    const second = await secondCommission(context);
    const a = await h.feedback(context, owner.id, { estadoModeracion: "PENDIENTE", puntuacion: 2, createdAt: new Date("2026-01-01") });
    const b = await h.feedback(second, owner.id, { estadoModeracion: "PENDIENTE", puntuacion: 5, createdAt: new Date("2026-01-02") });
    await Promise.all([
      repo.transitionModeration(a.id, moderator(), { accion: "APROBACION", versionEsperada: 1, motivo: "Aprobado A" }),
      repo.transitionModeration(b.id, moderator(), { accion: "APROBACION", versionEsperada: 1, motivo: "Aprobado B" }),
    ]);
    expect(await rating(context.materia.id)).toMatchObject({ puntuacion: 5, deletedAt: null });
    expect(await h.prisma.valoracionMateria.count({ where: { usuarioId: owner.id, materiaId: context.materia.id } })).toBe(1);
    await expect(repo.transitionModeration(b.id, { id: randomUUID(), role: "ADMIN" }, { accion: "OCULTAMIENTO_ADMIN", versionEsperada: 2, motivo: "Fallará ledger" })).rejects.toMatchObject({ code: "P2003" });
    expect(await rating(context.materia.id)).toMatchObject({ puntuacion: 5, deletedAt: null });
    expect(await h.prisma.feedback.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ ocultoAdministracion: false, versionModeracion: 2 });
    expect(await h.prisma.feedbackHistorial.count({ where: { feedbackId: b.id, accion: "OCULTAMIENTO_ADMIN" } })).toBe(0);
    await Promise.all([
      repo.transitionModeration(b.id, moderator(), { accion: "OCULTAMIENTO_ADMIN", versionEsperada: 2, motivo: "Revisión B" }),
      repo.remove(a.id, owner.id),
    ]);
    expect(await summary(context.materia.id)).toEqual({ promedio: null, cantidad: 0 });
    expect((await rating(context.materia.id))?.deletedAt).toBeInstanceOf(Date);
  });

  it("promedios ignoran proyecciones obsoletas y soportan históricos sin metadatos ni puntuación", async () => {
    const context = await h.context();
    const second = await secondCommission(context);
    await h.feedback(context, owner.id, { puntuacion: 2, createdAt: new Date("2026-01-01"), historial: undefined });
    await h.feedback(second, owner.id, { puntuacion: 5, createdAt: new Date("2026-01-02"), updatedAt: new Date("2026-01-01"), historial: undefined });
    const unrelated = await h.account();
    await h.prisma.valoracionMateria.createMany({ data: [
      { usuarioId: owner.id, materiaId: context.materia.id, puntuacion: 1 },
      { usuarioId: unrelated.id, materiaId: context.materia.id, puntuacion: 1 },
    ] });
    await h.feedback(context, reader.id, { puntuacion: null, historial: undefined });
    expect(await summary(context.materia.id)).toEqual({ promedio: 5, cantidad: 1 });
    const listing = await (await h.request(`/materias?q=${encodeURIComponent(context.materia.nombre)}`, reader.cookie)).json();
    expect(listing.items.find((item: { id: string }) => item.id === context.materia.id).valoracion).toEqual({ promedio: 5, cantidad: 1 });
  });

  it("último evento de contenido prevalece sobre creación y desempata establemente", async () => {
    const context = await h.context();
    const second = await secondCommission(context);
    const oldest = await h.feedback(context, owner.id, { puntuacion: 2, createdAt: new Date("2026-01-01") });
    const recent = await h.feedback(second, owner.id, { puntuacion: 5, createdAt: new Date("2026-01-02") });
    const at = new Date("2026-01-03");
    await h.prisma.feedbackHistorial.createMany({ data: [
      { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", feedbackId: oldest.id, accion: "EDICION", texto: oldest.texto, puntuacion: 2, anonimo: true, createdAt: at },
      { id: "00000000-0000-4000-8000-000000000001", feedbackId: recent.id, accion: "EDICION", texto: recent.texto, puntuacion: 5, anonimo: true, createdAt: at },
    ] });
    expect(await summary(context.materia.id)).toEqual({ promedio: 2, cantidad: 1 });
    // A moderation event later in time must not replace the latest creation/edit event.
    await repo.transitionModeration(recent.id, moderator(), { accion: "OCULTAMIENTO_ADMIN", versionEsperada: 1, motivo: "Temporal" });
    await repo.transitionModeration(recent.id, moderator(), { accion: "RESTITUCION_ADMIN", versionEsperada: 2, motivo: "Finalizado" });
    expect(await rating(context.materia.id)).toMatchObject({ puntuacion: 2, deletedAt: null });
    expect(await summary(context.materia.id)).toEqual({ promedio: 2, cantidad: 1 });
  });

  it("rankings de docente/comisión solo cuentan visibles y no filtran identidad anónima", async () => {
    const context = await h.context();
    const professor = await h.prisma.profesor.create({ data: { nombreCompleto: "Docente T2" } });
    await h.prisma.comisionProfesor.create({ data: { comisionId: context.comision.id, profesorId: professor.id, cargo: "TITULAR" } });
    const target = { profesorId: professor.id, profesorNombre: professor.nombreCompleto, profesorCargo: "TITULAR" as const };
    await h.feedback(context, owner.id, { puntuacion: 4, ...target });
    await h.feedback(context, reader.id, { puntuacion: 1, ocultoReportes: true, ...target });
    await h.feedback(context, admin.id, { puntuacion: 1, estadoModeracion: "PENDIENTE", ...target });
    const commissions = await (await h.request(`/rankings/comisiones?materiaId=${context.materia.id}`, reader.cookie)).json();
    expect(commissions.items).toHaveLength(1);
    expect(commissions.items[0].valoracion).toEqual({ promedio: 4, cantidad: 1 });
    const professors = await (await h.request(`/rankings/profesores/${professor.id}`, reader.cookie)).json();
    expect(professors.valoracion).toEqual({ promedio: 4, cantidad: 1 });
    expect(JSON.stringify({ commissions, professors })).not.toMatch(/autorId|Identidad privada|ocultoReportes/);
  });

  it("migración T2 reconcilia proyecciones históricas sin cambiar experiencias y es idempotente", async () => {
    const context = await h.context();
    const second = await secondCommission(context);
    await h.feedback(context, owner.id, { puntuacion: 2, createdAt: new Date("2026-01-01") });
    await h.feedback(second, owner.id, { puntuacion: 5, createdAt: new Date("2026-01-02") });
    await h.feedback(context, reader.id, { puntuacion: 4, estadoModeracion: "PENDIENTE" });
    const createdAt = new Date("2026-01-01");
    await h.prisma.valoracionMateria.createMany({ data: [
      { usuarioId: owner.id, materiaId: context.materia.id, puntuacion: 1, createdAt, deletedAt: new Date("2026-01-02") },
      { usuarioId: reader.id, materiaId: context.materia.id, puntuacion: 4, createdAt },
      { usuarioId: admin.id, materiaId: context.materia.id, puntuacion: 1, createdAt },
    ] });
    const comments = await h.prisma.feedback.findMany({ orderBy: { id: "asc" } });
    const snapshots = await h.prisma.feedbackHistorial.findMany({ orderBy: { id: "asc" } });
    const migration = await readFile(new URL("../prisma/migrations/20261117010000_feedback_valoracion_visible/migration.sql", import.meta.url), "utf8");
    await h.sql.query(migration);
    expect(await rating(context.materia.id)).toMatchObject({ puntuacion: 5, deletedAt: null, createdAt });
    expect((await rating(context.materia.id, reader.id))?.deletedAt).toBeInstanceOf(Date);
    expect((await rating(context.materia.id, admin.id))?.deletedAt).toBeInstanceOf(Date);
    expect(await h.prisma.feedback.findMany({ orderBy: { id: "asc" } })).toEqual(comments);
    expect(await h.prisma.feedbackHistorial.findMany({ orderBy: { id: "asc" } })).toEqual(snapshots);
    const projection = await h.prisma.valoracionMateria.findMany({ orderBy: { usuarioId: "asc" } });
    await h.sql.query(migration);
    expect(await h.prisma.valoracionMateria.findMany({ orderBy: { usuarioId: "asc" } })).toEqual(projection);
    expect(await h.prisma.administracionHistorial.count()).toBe(0);
  });
});
