import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import type { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { PrismaFeedbackReporteRepository } from "../src/reviews/infrastructure/prisma-feedback-reporte.repository.js";
import { moderationHarness, type ModerationHarness } from "./support/moderation-harness.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
type Account = Awaited<ReturnType<ModerationHarness["account"]>>;

describe.skipIf(!databaseUrl)("T5: umbral preventivo HTTP y PostgreSQL reales", () => {
  let h: ModerationHarness;
  let owner: Account;
  let admin: Account;
  let reporters: Account[];
  beforeAll(async () => { h = await moderationHarness(databaseUrl!); }, 30_000);
  beforeEach(async () => {
    await h.reset(); owner = await h.account(); admin = await h.account("ADMIN");
    reporters = await Promise.all(Array.from({ length: 4 }, () => h.account()));
  });
  afterAll(async () => { if (h) await h.close(); });
  const report = (id: string, who = reporters[0]!, body: unknown = { motivo: "SPAM" }) => h.request(`/feedback/${id}/reportes`, who.cookie, "POST", body);
  const current = (id: string) => h.prisma.feedback.findUniqueOrThrow({ where: { id } });
  async function moderate(id: string, accion: string, who = admin, motivo = "Revisión administrativa fundamentada", version?: number) {
    return h.request(`/admin/feedback/${id}/moderacion`, who.cookie, "POST", { accion, versionEsperada: version ?? (await current(id)).versionModeracion, motivo });
  }
  const resolve = (id: string, estado = "DESESTIMADO") => h.request(`/admin/feedback-reportes/${id}/resolucion`, admin.cookie, "POST", { estado, motivo: "Revisión de la evidencia persistida" });
  async function published() {
    const context = await h.context();
    const row = await h.feedback(context, owner.id, { estadoModeracion: "PENDIENTE", texto: "Experiencia de T5 revisada", puntuacion: 5 });
    expect((await moderate(row.id, "APROBACION")).status).toBe(200);
    return { context, feedback: await current(row.id) };
  }
  async function threshold(id: string) {
    const reports = [];
    for (const who of reporters.slice(0, 2)) {
      const response = await report(id, who); expect(response.status).toBe(201); reports.push(await response.json());
    }
    return reports;
  }
  const vote = (materiaId: string) => h.prisma.valoracionMateria.findUnique({ where: { usuarioId_materiaId: { usuarioId: owner.id, materiaId } } });
  async function summary(materiaId: string) {
    const response = await h.request(`/materias/${materiaId}`, reporters[0]!.cookie); expect(response.status).toBe(200);
    return (await response.json()).valoracion;
  }
  async function community(id: string) {
    const row = await current(id);
    const response = await h.request(`/comisiones/${row.comisionId}/feedback`, reporters[0]!.cookie); expect(response.status).toBe(200);
    return (await response.json()).items;
  }

  it("publica por HTTP sin aprobación previa, oculta al segundo denunciante y requiere restitución explícita", async () => {
    const context = await h.context();
    const created = await h.request(`/comisiones/${context.comision.id}/feedback`, owner.cookie, "POST", {
      texto: "Publicación directa y revisión comunitaria", anonimo: true, puntuacion: 5,
    });
    expect(created.status).toBe(201);
    const feedback = await created.json();
    expect(await current(feedback.id)).toMatchObject({ estadoModeracion: "APROBADO", versionModeracion: 1 });
    expect(await community(feedback.id)).toHaveLength(1);
    const first = await report(feedback.id, reporters[0]!); expect(first.status).toBe(201);
    expect(await current(feedback.id)).toMatchObject({ ocultoReportes: false, versionModeracion: 1 });
    expect(await community(feedback.id)).toHaveLength(1);
    const retry = await report(feedback.id, reporters[0]!); expect(retry.status).toBe(200);
    expect(await h.prisma.feedbackReporte.count()).toBe(1);
    expect((await report(feedback.id, reporters[1]!)).status).toBe(201);
    expect(await current(feedback.id)).toMatchObject({ estadoModeracion: "APROBADO", ocultoReportes: true, versionModeracion: 2 });
    expect(await community(feedback.id)).toEqual([]);
    const own = await h.request(`/feedback/${feedback.id}`, owner.cookie); expect(own.status).toBe(200);
    expect(await own.json()).toMatchObject({ id: feedback.id, propio: true, ocultoReportes: true });
    expect((await moderate(feedback.id, "RESTITUCION_REPORTES")).status).toBe(409);
    expect((await resolve((await first.json()).id)).status).toBe(200);
    expect(await community(feedback.id)).toEqual([]);
    expect((await moderate(feedback.id, "RESTITUCION_REPORTES")).status).toBe(200);
    expect(await community(feedback.id)).toHaveLength(1);
    expect(await summary(context.materia.id)).toEqual({ promedio: 5, cantidad: 1 });
    expect(await h.prisma.feedbackHistorial.count({ where: { feedbackId: feedback.id, accion: "APROBACION" } })).toBe(0);
  });

  it("1 denunciante mantiene publicación; el segundo oculta y retira el voto sin rechazar", async () => {
    const { feedback, context } = await published();
    for (const [index, who] of reporters.slice(0, 2).entries()) {
      expect((await report(feedback.id, who)).status).toBe(201);
      const hidden = index === 1;
      expect(await current(feedback.id)).toMatchObject({ estadoModeracion: "APROBADO", ocultoReportes: hidden,
        ocultoAutor: false, ocultoAdministracion: false, versionModeracion: hidden ? 3 : 2, motivoRechazo: null });
      expect((await community(feedback.id)).some((item: { id: string }) => item.id === feedback.id)).toBe(!hidden);
      expect(await summary(context.materia.id)).toEqual(hidden ? { promedio: null, cantidad: 0 } : { promedio: 5, cantidad: 1 });
      expect((await vote(context.materia.id))?.deletedAt !== null).toBe(hidden);
    }
  });

  it("registra snapshot y ledger correlacionados con origen automático y el segundo denunciante real", async () => {
    const { feedback } = await published(); const reports = await threshold(feedback.id);
    const snapshot = await h.prisma.feedbackHistorial.findFirstOrThrow({ where: { feedbackId: feedback.id, accion: "OCULTAMIENTO_REPORTES" } });
    expect(snapshot).toMatchObject({ texto: feedback.texto, puntuacion: 5, anonimo: true, ocultoReportes: true, estadoModeracion: "APROBADO", versionModeracion: 3 });
    const event = await h.prisma.administracionHistorial.findUniqueOrThrow({ where: { id: snapshot.id } });
    expect(event).toMatchObject({ entidad: "feedback", entidadId: feedback.id, actorId: reporters[1]!.id, accion: "OCULTAMIENTO_REPORTES" });
    expect(event.cambios).toEqual(expect.arrayContaining([
      { campo: "ocultoReportes", anterior: "false", nuevo: "true" },
      { campo: "origen", anterior: null, nuevo: "AUTOMATICO" },
    ]));
    expect(await h.prisma.feedbackHistorial.count({ where: { feedbackId: feedback.id, accion: "OCULTAMIENTO_REPORTES" } })).toBe(1);
    expect(reports[1].versionReportada).toBe(2);
    const detail = await (await h.request(`/admin/feedback/${feedback.id}/detalle`, admin.cookie)).json();
    expect(JSON.stringify(detail)).toContain("AUTOMATICO");
  });

  it("reintentos idénticos del segundo denunciante oculto son idempotentes y nunca crean otra versión", async () => {
    const { feedback } = await published(); const reports = await threshold(feedback.id);
    const before = await current(feedback.id);
    const responses = await Promise.all(Array.from({ length: 4 }, () => report(feedback.id, reporters[1]!)));
    expect(responses.map(response => response.status)).toEqual([200, 200, 200, 200]);
    for (const response of responses) expect(await response.json()).toEqual(reports[1]);
    expect((await report(feedback.id, reporters[1]!, { motivo: "OTRO" })).status).toBe(409);
    expect(await current(feedback.id)).toEqual(before);
    expect(await h.prisma.feedbackReporte.count()).toBe(2);
    expect(await h.prisma.feedbackHistorial.count({ where: { accion: "OCULTAMIENTO_REPORTES" } })).toBe(1);
  });

  it("nuevos usuarios no reportan contenido ya oculto ni obtienen recibos ajenos", async () => {
    const { feedback } = await published(); await threshold(feedback.id);
    const response = await report(feedback.id, reporters[3]!); expect(response.status).toBe(404);
    expect(JSON.stringify(await response.json())).not.toContain(feedback.texto);
    expect(await h.prisma.feedbackReporte.count()).toBe(2);
  });

  it("primer y segundo reporte simultáneos se serializan y generan un solo ocultamiento", async () => {
    const { feedback } = await published();
    const responses = await Promise.all(reporters.slice(0, 2).map(who => report(feedback.id, who)));
    expect(responses.map(response => response.status)).toEqual([201, 201]);
    expect(await current(feedback.id)).toMatchObject({ ocultoReportes: true, versionModeracion: 3 });
    expect(await h.prisma.feedbackReporte.count()).toBe(2);
    expect(await h.prisma.feedbackHistorial.count({ where: { accion: "OCULTAMIENTO_REPORTES" } })).toBe(1);
  });

  it("cuatro reportes concurrentes ocultan al segundo y bloquean la interacción posterior", async () => {
    const { feedback } = await published();
    const responses = await Promise.all(reporters.map(who => report(feedback.id, who)));
    expect(responses.map(response => response.status).sort()).toEqual([201, 201, 404, 404]);
    expect(await current(feedback.id)).toMatchObject({ ocultoReportes: true, estadoModeracion: "APROBADO", versionModeracion: 3 });
    expect(await h.prisma.feedbackReporte.count()).toBe(2);
    expect(await h.prisma.feedbackHistorial.count({ where: { accion: "OCULTAMIENTO_REPORTES" } })).toBe(1);
  });

  it("coordina el umbral entre pools Prisma independientes", async () => {
    const { feedback } = await published();
    const schema = (await h.sql.query<{ current_schema: string }>("SELECT current_schema()")).rows[0]!.current_schema;
    const second = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl!, options: `-c search_path=${schema},public` }, { schema }) });
    await second.$connect();
    try {
      const repositories = [new PrismaFeedbackReporteRepository(h.prisma as unknown as PrismaService), new PrismaFeedbackReporteRepository(second as unknown as PrismaService)];
      const results = await Promise.all(repositories.map((repo, index) => repo.create(feedback.id, reporters[index]!.id, { motivo: "SPAM" })));
      expect(results.every(result => result.created)).toBe(true);
      expect(await current(feedback.id)).toMatchObject({ ocultoReportes: true, versionModeracion: 3 });
      expect(await h.prisma.feedbackReporte.count()).toBe(2);
      expect(await h.prisma.feedbackHistorial.count({ where: { accion: "OCULTAMIENTO_REPORTES" } })).toBe(1);
    } finally { await second.$disconnect(); }
  });

  it("varias versiones del mismo denunciante cuentan una sola vez, incluyendo carreras de reintento", async () => {
    const { feedback } = await published(); expect((await report(feedback.id)).status).toBe(201);
    expect((await h.request(`/feedback/${feedback.id}`, owner.cookie, "PATCH", { texto: "Contenido corregido y revisado", versionEsperada: 2 })).status).toBe(200);
    const duplicateVersion = await Promise.all([report(feedback.id), report(feedback.id)]);
    expect(duplicateVersion.map(response => response.status).sort()).toEqual([200, 201]);
    expect(await current(feedback.id)).toMatchObject({ ocultoReportes: false, versionModeracion: 3 });
    const created = await (await report(feedback.id, reporters[1]!)).json();
    const detail = await (await h.request(`/admin/feedback-reportes/${created.id}`, admin.cookie)).json();
    expect(detail).toMatchObject({ cantidadReportesActivos: 3, denunciantesAbiertos: 2 });
    expect(await current(feedback.id)).toMatchObject({ ocultoReportes: true, versionModeracion: 4 });
    expect(await h.prisma.feedbackReporte.findMany({ select: { versionReportada: true } })).toEqual(expect.arrayContaining([{ versionReportada: 2 }, { versionReportada: 3 }]));
    const own = await h.prisma.feedbackReporte.findMany({ where: { feedbackId: feedback.id, denuncianteId: reporters[0]!.id }, orderBy: { versionReportada: "asc" } });
    expect(own).toHaveLength(2);
    expect((await resolve(own[0]!.id)).status).toBe(200);
    const partlyClosed = await (await h.request(`/admin/feedback-reportes/${created.id}`, admin.cookie)).json();
    expect(partlyClosed).toMatchObject({ cantidadReportesActivos: 2, denunciantesAbiertos: 2 });
    expect((await moderate(feedback.id, "RESTITUCION_REPORTES")).status).toBe(409);
    expect((await resolve(own[1]!.id)).status).toBe(200);
    const retryClosedWhileHidden = await report(feedback.id); expect(retryClosedWhileHidden.status).toBe(200);
    expect(await retryClosedWhileHidden.json()).toMatchObject({ id: own[1]!.id, estado: "DESESTIMADO" });
    const closed = await (await h.request(`/admin/feedback-reportes/${created.id}`, admin.cookie)).json();
    expect(closed).toMatchObject({ cantidadReportesActivos: 1, denunciantesAbiertos: 1 });
    expect(await current(feedback.id)).toMatchObject({ ocultoReportes: true, versionModeracion: 4 });
    expect((await moderate(feedback.id, "RESTITUCION_REPORTES")).status).toBe(200);
    expect(await h.prisma.feedbackReporte.count({ where: { estado: "DESESTIMADO" } })).toBe(2);
  });

  it("cerrados no contribuyen; reintentar un cerrado no lo reabre ni lo vuelve a contar", async () => {
    const { feedback } = await published();
    const first = await (await report(feedback.id)).json(); expect((await resolve(first.id)).status).toBe(200);
    const retry = await report(feedback.id); expect(retry.status).toBe(200); expect((await retry.json()).estado).toBe("DESESTIMADO");
    expect((await report(feedback.id, reporters[1]!)).status).toBe(201);
    expect(await current(feedback.id)).toMatchObject({ ocultoReportes: false });
    expect((await report(feedback.id, reporters[2]!)).status).toBe(201);
    expect(await current(feedback.id)).toMatchObject({ ocultoReportes: true });
    expect(await h.prisma.feedbackReporte.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ estado: "DESESTIMADO", denuncianteId: reporters[0]!.id });
  });

  it("cerrar denuncias no restituye; ADMIN debe decidir explícitamente con menos de dos", async () => {
    const { feedback, context } = await published(); const reports = await threshold(feedback.id);
    expect((await moderate(feedback.id, "RESTITUCION_REPORTES")).status).toBe(409);
    expect((await resolve(reports[0].id, "RESUELTO")).status).toBe(200);
    expect(await current(feedback.id)).toMatchObject({ ocultoReportes: true, versionModeracion: 3 });
    expect(await summary(context.materia.id)).toEqual({ promedio: null, cantidad: 0 });
    expect((await moderate(feedback.id, "RESTITUCION_REPORTES")).status).toBe(200);
    expect(await current(feedback.id)).toMatchObject({ ocultoReportes: false, estadoModeracion: "APROBADO", versionModeracion: 4 });
    expect(await summary(context.materia.id)).toEqual({ promedio: 5, cantidad: 1 });
    const event = await h.prisma.administracionHistorial.findFirstOrThrow({ where: { entidadId: feedback.id, accion: "RESTITUCION_REPORTES" } });
    expect(event).toMatchObject({ actorId: admin.id });
    expect(event.cambios).toEqual(expect.arrayContaining([{ campo: "motivo", anterior: null, nuevo: "Revisión administrativa fundamentada" }]));
    expect((await moderate(feedback.id, "RESTITUCION_REPORTES")).status).toBe(200);
    expect(await h.prisma.administracionHistorial.count({ where: { accion: "RESTITUCION_REPORTES", entidadId: feedback.id } })).toBe(1);
  });

  it("mantener pendiente no escribe y el rechazo formal existente conserva la causa preventiva", async () => {
    const { feedback, context } = await published(); await threshold(feedback.id);
    const before = await current(feedback.id);
    expect((await h.request("/admin/feedback-reportes?ocultoReportes=true", admin.cookie)).status).toBe(200);
    expect(await current(feedback.id)).toEqual(before);
    expect((await moderate(feedback.id, "RECHAZO")).status).toBe(200);
    expect(await current(feedback.id)).toMatchObject({ estadoModeracion: "RECHAZADO", ocultoReportes: true, requiereRevisionHumana: true });
    expect(await summary(context.materia.id)).toEqual({ promedio: null, cantidad: 0 });
  });

  it.each(["ocultoAutor", "ocultoAdministracion", "ambas"])("restituir reportes no elimina otra restricción: %s", async cause => {
    const { feedback, context } = await published(); const reports = await threshold(feedback.id);
    if (cause !== "ocultoAdministracion") {
      const row = await current(feedback.id);
      expect((await h.request(`/feedback/${feedback.id}/ocultar`, owner.cookie, "POST", { versionEsperada: row.versionModeracion })).status).toBe(200);
    }
    if (cause !== "ocultoAutor") expect((await moderate(feedback.id, "OCULTAMIENTO_ADMIN")).status).toBe(200);
    expect((await resolve(reports[0].id)).status).toBe(200);
    expect((await moderate(feedback.id, "RESTITUCION_REPORTES")).status).toBe(200);
    expect(await current(feedback.id)).toMatchObject({ ocultoReportes: false, ocultoAutor: cause !== "ocultoAdministracion", ocultoAdministracion: cause !== "ocultoAutor", estadoModeracion: "APROBADO" });
    expect(await summary(context.materia.id)).toEqual({ promedio: null, cantidad: 0 }); expect(await community(feedback.id)).toEqual([]);
    expect((await vote(context.materia.id))?.deletedAt).toBeInstanceOf(Date);
  });

  it("un nuevo ciclo después de restitución vuelve a ocultar sin reabrir reportes anteriores", async () => {
    const { feedback } = await published(); const reports = await threshold(feedback.id);
    for (const item of reports) expect((await resolve(item.id)).status).toBe(200);
    expect((await moderate(feedback.id, "RESTITUCION_REPORTES")).status).toBe(200);
    await threshold(feedback.id);
    expect(await current(feedback.id)).toMatchObject({ ocultoReportes: true, versionModeracion: 5 });
    expect(await h.prisma.feedbackReporte.count({ where: { estado: "DESESTIMADO" } })).toBe(2);
    expect(await h.prisma.feedbackReporte.count({ where: { estado: "ABIERTO" } })).toBe(2);
    expect(await h.prisma.feedbackHistorial.count({ where: { accion: "OCULTAMIENTO_REPORTES" } })).toBe(2);
  });

  it("cierre concurrente con segundo reporte nunca publica y decide el umbral desde el conteo bloqueado", async () => {
    const { feedback } = await published();
    const first = await (await report(feedback.id)).json();
    const responses = await Promise.all([resolve(first.id), report(feedback.id, reporters[1]!)]);
    expect(responses.map(response => response.status)).toEqual([200, 201]);
    const row = await current(feedback.id);
    expect(row.estadoModeracion).toBe("APROBADO");
    expect(await h.prisma.feedbackReporte.count({ where: { estado: "ABIERTO" } })).toBe(1);
    // Either serialization is safe: close first avoids the threshold; report first
    // hides permanently until a separate explicit decision, even after the close.
    expect(await h.prisma.feedbackHistorial.count({ where: { accion: "OCULTAMIENTO_REPORTES" } })).toBe(row.ocultoReportes ? 1 : 0);
  });

  it("restitución concurrente con reporte nuevo conserva el umbral o vuelve a ocultar", async () => {
    const { feedback } = await published(); const reports = await threshold(feedback.id);
    expect((await resolve(reports[0].id)).status).toBe(200);
    const [restored, reported] = await Promise.all([moderate(feedback.id, "RESTITUCION_REPORTES"), report(feedback.id, reporters[3]!)]);
    expect(restored.status).toBe(200); expect([201, 404]).toContain(reported.status);
    const count = await h.prisma.feedbackReporte.count({ where: { estado: "ABIERTO" } }); const row = await current(feedback.id);
    expect(count).toBe(reported.status === 201 ? 2 : 1); expect(row.ocultoReportes).toBe(count >= 2);
    expect((await community(feedback.id)).length).toBe(count >= 2 ? 0 : 1);
  });

  it("dos ADMIN concurrentes restituyen una vez; versión vieja produce 409", async () => {
    const { feedback } = await published(); const reports = await threshold(feedback.id); const another = await h.account("ADMIN");
    expect((await resolve(reports[0].id)).status).toBe(200);
    const version = (await current(feedback.id)).versionModeracion;
    const responses = await Promise.all([moderate(feedback.id, "RESTITUCION_REPORTES", admin, "Decisión uno", version), moderate(feedback.id, "RESTITUCION_REPORTES", another, "Decisión dos", version)]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    expect(await h.prisma.feedbackHistorial.count({ where: { accion: "RESTITUCION_REPORTES" } })).toBe(1);
    expect((await moderate(feedback.id, "RESTITUCION_REPORTES", admin, "Reintento viejo", version)).status).toBe(409);
  });

  it("conserva likes, respuestas e historial pero bloquea nuevas interacciones, feed y rankings", async () => {
    const { feedback, context } = await published();
    expect((await h.request(`/feedback/${feedback.id}/like`, reporters[0]!.cookie, "PUT")).status).toBe(200);
    expect((await h.request(`/feedback/${feedback.id}/respuestas`, reporters[0]!.cookie, "POST", { solicitudId: randomUUID(), texto: "Respuesta conservada", anonimo: true })).status).toBe(201);
    const likes = await h.prisma.feedbackLike.findMany(); const responses = await h.prisma.feedbackRespuesta.findMany();
    const history = await h.prisma.feedbackHistorial.findMany({ where: { feedbackId: feedback.id } });
    const reports = await threshold(feedback.id);
    expect((await h.request(`/feedback/${feedback.id}/like`, reporters[3]!.cookie, "PUT")).status).toBe(404);
    expect((await h.request(`/feedback/${feedback.id}/respuestas`, reporters[3]!.cookie, "POST", { solicitudId: randomUUID(), texto: "No permitida", anonimo: true })).status).toBe(404);
    expect(await h.prisma.feedbackLike.findMany()).toEqual(likes); expect(await h.prisma.feedbackRespuesta.findMany()).toEqual(responses);
    expect(await h.prisma.feedbackHistorial.findMany({ where: { id: { in: history.map(item => item.id) } } })).toHaveLength(history.length);
    expect(await summary(context.materia.id)).toEqual({ promedio: null, cantidad: 0 });
    for (const path of ["/feedback", "/feedback/feed", `/comisiones/${feedback.comisionId}/feedback`]) {
      const response = await h.request(path, reporters[3]!.cookie); expect(response.status).toBe(200);
      expect(JSON.stringify(await response.json())).not.toContain(feedback.id);
    }
    expect((await resolve(reports[0].id)).status).toBe(200);
    expect((await moderate(feedback.id, "RESTITUCION_REPORTES")).status).toBe(200);
    const visibleReplies = await h.request(`/feedback/${feedback.id}/respuestas`, reporters[3]!.cookie); expect(visibleReplies.status).toBe(200);
    expect(JSON.stringify(await visibleReplies.json())).toContain("Respuesta conservada");
    expect(await h.prisma.feedbackLike.findMany()).toEqual(likes); expect(await h.prisma.feedbackRespuesta.findMany()).toEqual(responses);
  });

  it("ranking de comisiones excluye el oculto y recupera su contribución al restituir", async () => {
    const { feedback, context } = await published();
    const path = `/rankings/comisiones?materiaId=${context.materia.id}`;
    const before = await h.request(path, reporters[0]!.cookie); expect(before.status).toBe(200);
    expect(JSON.stringify(await before.json())).toContain(context.comision.id);
    const reports = await threshold(feedback.id);
    const hidden = await h.request(path, reporters[0]!.cookie); expect(hidden.status).toBe(200);
    expect(JSON.stringify(await hidden.json())).not.toContain(context.comision.id);
    expect((await resolve(reports[0].id)).status).toBe(200); expect((await moderate(feedback.id, "RESTITUCION_REPORTES")).status).toBe(200);
    const restored = await h.request(path, reporters[0]!.cookie); expect(restored.status).toBe(200);
    expect(JSON.stringify(await restored.json())).toContain(context.comision.id);
  });

  it("sincronización selecciona una experiencia visible de respaldo del mismo autor/materia", async () => {
    const { feedback, context } = await published();
    const otherCommission = await h.prisma.comision.create({ data: { cursadaId: context.cursada.id, carrera: "S", numero: 32 } });
    const backup = await h.feedback({ ...context, comision: otherCommission }, owner.id, { estadoModeracion: "PENDIENTE", puntuacion: 2, createdAt: new Date("2026-01-01") });
    expect((await moderate(backup.id, "APROBACION")).status).toBe(200);
    expect(await summary(context.materia.id)).toEqual({ promedio: 5, cantidad: 1 });
    const reports = await threshold(feedback.id);
    expect(await vote(context.materia.id)).toMatchObject({ puntuacion: 2, deletedAt: null });
    expect(await summary(context.materia.id)).toEqual({ promedio: 2, cantidad: 1 });
    expect((await resolve(reports[0].id)).status).toBe(200); expect((await moderate(feedback.id, "RESTITUCION_REPORTES")).status).toBe(200);
    expect(await vote(context.materia.id)).toMatchObject({ puntuacion: 5, deletedAt: null });
    expect(await summary(context.materia.id)).toEqual({ promedio: 5, cantidad: 1 });
  });

  it("restitución de reportes no aprueba contenido rechazado ni su posterior corrección", async () => {
    const { feedback, context } = await published(); const reports = await threshold(feedback.id);
    expect((await moderate(feedback.id, "RECHAZO")).status).toBe(200); expect((await resolve(reports[0].id)).status).toBe(200);
    expect((await moderate(feedback.id, "RESTITUCION_REPORTES")).status).toBe(200);
    expect(await current(feedback.id)).toMatchObject({ estadoModeracion: "RECHAZADO", requiereRevisionHumana: true, ocultoReportes: false });
    expect(await summary(context.materia.id)).toEqual({ promedio: null, cantidad: 0 });
    expect((await h.request(`/feedback/${feedback.id}`, owner.cookie, "PATCH", { texto: "Corrección posterior al rechazo", versionEsperada: 5 })).status).toBe(200);
    expect(await current(feedback.id)).toMatchObject({ estadoModeracion: "RECHAZADO", ocultoReportes: false });
  });

  it.each(["ocultoAutor", "ocultoAdministracion", "deletedAt"])("reintento no revela recibos bajo otra restricción %s", async cause => {
    const { feedback } = await published(); await threshold(feedback.id);
    if (cause === "deletedAt") expect((await h.request(`/feedback/${feedback.id}`, owner.cookie, "DELETE")).status).toBe(204);
    else if (cause === "ocultoAutor") expect((await h.request(`/feedback/${feedback.id}/ocultar`, owner.cookie, "POST", { versionEsperada: 3 })).status).toBe(200);
    else expect((await moderate(feedback.id, "OCULTAMIENTO_ADMIN")).status).toBe(200);
    expect((await report(feedback.id, reporters[1]!)).status).toBe(404);
    expect(await h.prisma.feedbackReporte.count()).toBe(2);
  });

  it("autor y ADMIN conservan contenido e historia sin revelar denunciantes al autor/comunidad", async () => {
    const { feedback } = await published(); const reports = await threshold(feedback.id);
    for (const path of [`/feedback/${feedback.id}`, `/feedback/${feedback.id}/historial`, "/feedback/propios"]) {
      const response = await h.request(path, owner.cookie); expect(response.status).toBe(200); const body = JSON.stringify(await response.json());
      expect(body).toContain(feedback.texto);
      for (const who of reporters) expect(body).not.toContain(who.id);
      for (const item of reports) expect(body).not.toContain(item.id);
      expect(body).not.toMatch(/denuncianteId|administradorId/);
    }
    for (const who of [owner, ...reporters]) {
      expect((await h.request(`/admin/feedback-reportes/${reports[0].id}`, who.cookie)).status).toBe(403);
      expect((await h.request("/admin/feedback-reportes?ocultoReportes=true", who.cookie)).status).toBe(403);
    }
    const detail = await (await h.request(`/admin/feedback-reportes/${reports[0].id}`, admin.cookie)).json();
    expect(detail.reporte.denunciante).toMatchObject({ id: reporters[0]!.id }); expect(detail.evidencia.texto).toBe(feedback.texto);
    expect(JSON.stringify(detail)).not.toMatch(/passwordHash|tokenHash|emailVerifiedAt|"email"/);
  });

  it("restitución exige ADMIN vigente, sesión, CSRF, motivo y payload estricto", async () => {
    const { feedback } = await published(); const reports = await threshold(feedback.id); expect((await resolve(reports[0].id)).status).toBe(200);
    const path = `/admin/feedback/${feedback.id}/moderacion`; const body = { accion: "RESTITUCION_REPORTES", versionEsperada: 3, motivo: "Revisado" };
    expect((await h.request(path, "", "POST", body)).status).toBe(401);
    for (const who of [owner, reporters[0]!]) expect((await h.request(path, who.cookie, "POST", body)).status).toBe(403);
    expect((await fetch(`${h.url}${path}`, { method: "POST", headers: { Cookie: admin.cookie, "Content-Type": "application/json" }, body: JSON.stringify(body) })).status).toBe(403);
    for (const invalid of [{ ...body, motivo: " " }, { ...body, actorId: admin.id }, { ...body, ocultoAutor: false }, { ...body, accion: "OCULTAMIENTO_REPORTES" }]) expect((await h.request(path, admin.cookie, "POST", invalid)).status).toBe(400);
    await h.prisma.user.update({ where: { id: admin.id }, data: { disabledAt: new Date() } });
    expect([401, 403]).toContain((await h.request(path, admin.cookie, "POST", body)).status);
    expect(await current(feedback.id)).toMatchObject({ ocultoReportes: true, versionModeracion: 3 });
  });

  it("bandeja filtra experiencias ocultas, cuenta distintos y expone última fecha incluso cerrada", async () => {
    const { feedback } = await published(); const reports = await threshold(feedback.id);
    const otherContext = await h.context(); const another = await h.feedback(otherContext, owner.id);
    expect((await report(another.id, reporters[3]!)).status).toBe(201);
    const stored = await h.prisma.feedbackReporte.findMany({ where: { feedbackId: feedback.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    expect((await resolve(stored[0]!.id)).status).toBe(200);
    const response = await h.request("/admin/feedback-reportes?ocultoReportes=true", admin.cookie); expect(response.status).toBe(200);
    const body = await response.json(); expect(body).toMatchObject({ total: 2, page: 1, pageSize: 9 });
    for (const item of body.items) expect(item).toMatchObject({ feedbackId: feedback.id, denunciantesAbiertos: 1, cantidadReportesActivos: 1,
      ultimoReporteAt: stored[0]!.createdAt.toISOString(), experiencia: { ocultoReportes: true, estadoModeracion: "APROBADO", ocultoAutor: false, ocultoAdministracion: false } });
    expect(new Set(body.items.map((item: { versionReportada: number }) => item.versionReportada))).toEqual(new Set([2]));
    const visible = await (await h.request("/admin/feedback-reportes?ocultoReportes=false", admin.cookie)).json();
    expect(visible.total).toBe(1); expect(visible.items[0].feedbackId).toBe(another.id);
    const detail = await (await h.request(`/admin/feedback-reportes/${reports[0].id}`, admin.cookie)).json();
    expect(detail.ultimoReporteAt).toBe(stored[0]!.createdAt.toISOString());
    expect((await h.request("/admin/feedback-reportes?ocultoReportes=1", admin.cookie)).status).toBe(400);
  });

  it("rollback durante sync revierte reporte, causa, versión, snapshot, ledger y voto", async () => {
    const { feedback, context } = await published();
    expect((await report(feedback.id, reporters[0]!)).status).toBe(201);
    const before = await current(feedback.id); const beforeVote = await vote(context.materia.id);
    const beforeHistory = await h.prisma.feedbackHistorial.findMany({ where: { feedbackId: feedback.id } });
    const beforeLedger = await h.prisma.administracionHistorial.count();
    await h.sql.query('CREATE FUNCTION fail_t5_sync() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION \'T5 sync rollback probe\'; END $$');
    await h.sql.query('CREATE TRIGGER fail_t5_sync BEFORE UPDATE ON "ValoracionMateria" FOR EACH ROW EXECUTE FUNCTION fail_t5_sync()');
    try {
      expect((await report(feedback.id, reporters[1]!)).status).toBe(500);
      expect(await current(feedback.id)).toEqual(before); expect(await vote(context.materia.id)).toEqual(beforeVote);
      expect(await h.prisma.feedbackHistorial.findMany({ where: { feedbackId: feedback.id } })).toEqual(beforeHistory);
      expect(await h.prisma.administracionHistorial.count()).toBe(beforeLedger); expect(await h.prisma.feedbackReporte.count()).toBe(1);
    } finally {
      await h.sql.query('DROP TRIGGER fail_t5_sync ON "ValoracionMateria"'); await h.sql.query('DROP FUNCTION fail_t5_sync()');
    }
    expect((await report(feedback.id, reporters[1]!)).status).toBe(201);
    expect(await current(feedback.id)).toMatchObject({ ocultoReportes: true, versionModeracion: 3 });
  });

  it("rollback del ledger preventivo revierte también el reporte y sincronización", async () => {
    const { feedback, context } = await published();
    expect((await report(feedback.id, reporters[0]!)).status).toBe(201);
    const before = await current(feedback.id); const beforeVote = await vote(context.materia.id);
    await h.sql.query('CREATE FUNCTION fail_t5_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."accion" = \'OCULTAMIENTO_REPORTES\' THEN RAISE EXCEPTION \'T5 ledger rollback probe\'; END IF; RETURN NEW; END $$');
    await h.sql.query('CREATE TRIGGER fail_t5_event BEFORE INSERT ON "AdministracionHistorial" FOR EACH ROW EXECUTE FUNCTION fail_t5_event()');
    try {
      expect((await report(feedback.id, reporters[1]!)).status).toBe(500); expect(await h.prisma.feedbackReporte.count()).toBe(1);
      expect(await current(feedback.id)).toEqual(before); expect(await vote(context.materia.id)).toEqual(beforeVote);
      expect(await h.prisma.feedbackHistorial.count({ where: { accion: "OCULTAMIENTO_REPORTES" } })).toBe(0);
    } finally {
      await h.sql.query('DROP TRIGGER fail_t5_event ON "AdministracionHistorial"'); await h.sql.query('DROP FUNCTION fail_t5_event()');
    }
    expect((await report(feedback.id, reporters[1]!)).status).toBe(201);
  });

  it("rollback de restitución conserva ocultamiento y voto retirado para reintentar", async () => {
    const { feedback, context } = await published(); const reports = await threshold(feedback.id); expect((await resolve(reports[0].id)).status).toBe(200);
    const before = await current(feedback.id); const beforeVote = await vote(context.materia.id);
    await h.sql.query('CREATE FUNCTION fail_t5_restore() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION \'T5 restore rollback probe\'; END $$');
    await h.sql.query('CREATE TRIGGER fail_t5_restore BEFORE UPDATE ON "ValoracionMateria" FOR EACH ROW EXECUTE FUNCTION fail_t5_restore()');
    try {
      expect((await moderate(feedback.id, "RESTITUCION_REPORTES")).status).toBe(500);
      expect(await current(feedback.id)).toEqual(before); expect(await vote(context.materia.id)).toEqual(beforeVote);
      expect(await h.prisma.feedbackHistorial.count({ where: { accion: "RESTITUCION_REPORTES" } })).toBe(0);
    } finally {
      await h.sql.query('DROP TRIGGER fail_t5_restore ON "ValoracionMateria"'); await h.sql.query('DROP FUNCTION fail_t5_restore()');
    }
    expect((await moderate(feedback.id, "RESTITUCION_REPORTES")).status).toBe(200);
  });
});
