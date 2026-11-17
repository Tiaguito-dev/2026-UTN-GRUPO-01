import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import type { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { PrismaFeedbackReporteRepository } from "../src/reviews/infrastructure/prisma-feedback-reporte.repository.js";
import { moderationHarness, type ModerationHarness } from "./support/moderation-harness.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
type Account = Awaited<ReturnType<ModerationHarness["account"]>>;

describe.skipIf(!databaseUrl)("T4: reportes HTTP con sesiones y PostgreSQL reales", () => {
  let h: ModerationHarness;
  let owner: Account;
  let reporter: Account;
  let admin: Account;
  beforeAll(async () => { h = await moderationHarness(databaseUrl!); }, 30_000);
  beforeEach(async () => { await h.reset(); owner = await h.account(); reporter = await h.account(); admin = await h.account("ADMIN"); });
  afterAll(async () => { if (h) await h.close(); });
  const report = (id: string, account = reporter, body: unknown = { motivo: "SPAM" }) => h.request(`/feedback/${id}/reportes`, account.cookie, "POST", body);
  const resolve = (id: string, estado = "RESUELTO", account = admin, motivo = "Revisión administrativa justificada") => h.request(`/admin/feedback-reportes/${id}/resolucion`, account.cookie, "POST", { estado, motivo });
  async function row() {
    const context = await h.context();
    return { context, feedback: await h.feedback(context, owner.id) };
  }
  async function newReport() {
    const result = await row();
    const response = await report(result.feedback.id);
    expect(response.status).toBe(201);
    return { ...result, reporte: await response.json() };
  }

  it("crea desde sesión y conserva evidencia y contexto sin identidad en respuesta", async () => {
    const { feedback, context } = await row();
    const response = await report(feedback.id, reporter, { motivo: "INSULTOS_ACOSO", descripcion: "  Contexto de la denuncia  " });
    expect(response.status).toBe(201); expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({ feedbackId: feedback.id, versionReportada: 1, motivo: "INSULTOS_ACOSO", descripcion: "Contexto de la denuncia", estado: "ABIERTO", resolvedAt: null });
    expect(JSON.stringify(body)).not.toMatch(/denunciante|autorId|administradorId|email|password|Identidad privada/);
    const stored = await h.prisma.feedbackReporte.findUniqueOrThrow({ where: { id: body.id } });
    expect(stored).toMatchObject({ denuncianteId: reporter.id, feedbackId: feedback.id, versionReportada: 1, estado: "ABIERTO" });
    const detail = await (await h.request(`/admin/feedback-reportes/${body.id}`, admin.cookie)).json();
    expect(detail.evidencia).toMatchObject({ id: stored.historialId, texto: feedback.texto, puntuacion: feedback.puntuacion, anonimo: true });
    expect(detail.experiencia.contexto).toMatchObject({ materiaId: context.materia.id, materiaNombre: context.materia.nombre });
    expect(detail).toMatchObject({ cantidadReportesActivos: 1, denunciantesAbiertos: 1 });
    expect(await h.prisma.administracionHistorial.findFirstOrThrow({ where: { entidad: "feedbackReporte", entidadId: body.id } })).toMatchObject({ accion: "CREACION", actorId: reporter.id });
  });

  it("exige sesión, rol ADMIN y CSRF/Origin en todas las escrituras", async () => {
    const { feedback, reporte } = await newReport();
    expect((await h.request(`/feedback/${feedback.id}/reportes`, "", "POST", { motivo: "SPAM" })).status).toBe(401);
    for (const path of ["/admin/feedback-reportes", `/admin/feedback-reportes/${reporte.id}`]) {
      expect((await h.request(path, "")).status).toBe(401);
      expect((await h.request(path, reporter.cookie)).status).toBe(403);
      expect((await h.request(path, owner.cookie)).status).toBe(403);
    }
    expect((await h.request(`/admin/feedback-reportes/${reporte.id}/resolucion`, "", "POST", { estado: "RESUELTO", motivo: "Revisado" })).status).toBe(401);
    expect((await resolve(reporte.id, "RESUELTO", reporter)).status).toBe(403);
    for (const [path, cookie, body] of [[`/feedback/${feedback.id}/reportes`, reporter.cookie, { motivo: "SPAM" }], [`/admin/feedback-reportes/${reporte.id}/resolucion`, admin.cookie, { estado: "RESUELTO", motivo: "Revisado" }]] as const) {
      expect((await fetch(`${h.url}${path}`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(body) })).status).toBe(403);
    }
  });

  it("impide autorreporte y no revela existencia de IDs privados", async () => {
    const { feedback } = await row();
    expect((await report(feedback.id, owner)).status).toBe(403);
    expect((await report(randomUUID())).status).toBe(404);
    expect((await report("invalido")).status).toBe(400);
    expect(await h.prisma.feedbackReporte.count()).toBe(0);
  });

  it.each(["PENDIENTE", "RECHAZADO", "ocultoAutor", "ocultoAdministracion", "ocultoReportes", "deletedAt"])("rechaza experiencia no pública por %s sin filtrar contenido", async reason => {
    const { feedback } = await row();
    if (reason === "PENDIENTE") await h.prisma.feedback.update({ where: { id: feedback.id }, data: { estadoModeracion: "PENDIENTE" } });
    else if (reason === "RECHAZADO") await h.prisma.feedback.update({ where: { id: feedback.id }, data: { estadoModeracion: "RECHAZADO", requiereRevisionHumana: true, motivoRechazo: "Corrección necesaria" } });
    else if (reason === "deletedAt") await h.prisma.feedback.update({ where: { id: feedback.id }, data: { deletedAt: new Date() } });
    else await h.prisma.feedback.update({ where: { id: feedback.id }, data: { [reason]: true } });
    const response = await report(feedback.id);
    expect(response.status).toBe(404); expect(JSON.stringify(await response.json())).not.toContain(feedback.texto);
    expect(await h.prisma.feedbackReporte.count()).toBe(0);
  });

  it("contratos HTTP validan enums, límites, campos extra y justificación", async () => {
    const { feedback, reporte } = await newReport();
    for (const body of [{}, { motivo: "INVALIDO" }, { motivo: "SPAM", descripcion: "x".repeat(1001) }, { motivo: "SPAM", descripcion: "Contexto\u0000" }, { motivo: "SPAM", denuncianteId: owner.id }, { motivo: "SPAM", estado: "RESUELTO" }, { motivo: "SPAM", versionReportada: 1 }]) {
      expect((await report(feedback.id, reporter, body)).status).toBe(400);
    }
    for (const body of [{ estado: "RESUELTO" }, { estado: "RESUELTO", motivo: " " }, { estado: "DESESTIMADO", motivo: "x".repeat(1001) }, { estado: "ABIERTO", motivo: "Revisión" }, { estado: "RESUELTO", motivo: "Revisión", administradorId: owner.id }]) {
      expect((await h.request(`/admin/feedback-reportes/${reporte.id}/resolucion`, admin.cookie, "POST", body)).status).toBe(400);
    }
    expect((await h.request("/admin/feedback-reportes?pageSize=10", admin.cookie)).status).toBe(400);
    expect((await h.request("/admin/feedback-reportes?estado=PENDIENTE", admin.cookie)).status).toBe(400);
    expect((await h.request(`/admin/feedback-reportes/${reporte.id}?pageSize=4`, admin.cookie)).status).toBe(400);
  });

  it("reintento normalizado es idempotente y datos diferentes producen 409", async () => {
    const { feedback } = await row();
    const first = await report(feedback.id, reporter, { motivo: "SPAM", descripcion: " Contexto " });
    const firstBody = await first.json();
    const retry = await report(feedback.id, reporter, { motivo: "SPAM", descripcion: "Contexto" });
    expect(first.status).toBe(201); expect(retry.status).toBe(200); expect(await retry.json()).toEqual(firstBody);
    expect((await report(feedback.id, reporter, { motivo: "OTRO", descripcion: "Contexto" })).status).toBe(409);
    expect((await report(feedback.id, reporter, { motivo: "SPAM", descripcion: "Otro contexto" })).status).toBe(409);
    expect(await h.prisma.feedbackReporte.count()).toBe(1);
    expect(await h.prisma.administracionHistorial.count({ where: { entidad: "feedbackReporte" } })).toBe(1);
  });

  it("reportes idénticos concurrentes crean una sola fila y evento", async () => {
    const { feedback } = await row();
    const responses = await Promise.all(Array.from({ length: 6 }, () => report(feedback.id)));
    expect(responses.map(response => response.status).sort()).toEqual([200, 200, 200, 200, 200, 201]);
    const bodies = await Promise.all(responses.map(response => response.json()));
    expect(new Set(bodies.map(body => body.id)).size).toBe(1);
    expect(await h.prisma.feedbackReporte.count()).toBe(1);
    expect(await h.prisma.administracionHistorial.count({ where: { entidad: "feedbackReporte" } })).toBe(1);
  });

  it("datos distintos concurrentes para misma versión conservan un solo reporte", async () => {
    const { feedback } = await row();
    const responses = await Promise.all([report(feedback.id, reporter, { motivo: "SPAM" }), report(feedback.id, reporter, { motivo: "OTRO" })]);
    expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
    expect(await h.prisma.feedbackReporte.count()).toBe(1);
    expect(await h.prisma.administracionHistorial.count({ where: { entidad: "feedbackReporte" } })).toBe(1);
  });

  it("reporte concurrente con edición conserva evidencia original o rechaza el contenido pendiente", async () => {
    const { feedback } = await row();
    const [reported, edited] = await Promise.all([report(feedback.id), h.request(`/feedback/${feedback.id}`, owner.cookie, "PATCH", { texto: "Edición concurrente", versionEsperada: 1 })]);
    expect(edited.status).toBe(200); expect([201, 404]).toContain(reported.status);
    expect((await h.prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } })).estadoModeracion).toBe("PENDIENTE");
    if (reported.status === 201) {
      const body = await reported.json(); const detail = await (await h.request(`/admin/feedback-reportes/${body.id}`, admin.cookie)).json();
      expect(detail.reporte.versionReportada).toBe(1); expect(detail.evidencia.texto).toBe(feedback.texto);
    } else expect(await h.prisma.feedbackReporte.count()).toBe(0);
  });

  it("rechaza evidencia ausente sin inventar snapshots ni consumir cuota", async () => {
    const { feedback } = await row();
    // Corruption probe in the owned schema: production writers always snapshot content.
    await h.prisma.feedbackHistorial.deleteMany({ where: { feedbackId: feedback.id } });
    expect((await report(feedback.id)).status).toBe(409);
    expect(await h.prisma.feedbackReporte.count()).toBe(0);
    expect(await h.prisma.feedbackHistorial.count({ where: { feedbackId: feedback.id } })).toBe(0);
    expect(await h.prisma.administracionHistorial.count({ where: { entidad: "feedbackReporte" } })).toBe(0);
  });

  it("referencia snapshot legado sin versión sin duplicar texto ni alterar historial", async () => {
    const { feedback } = await row(); const previous = await h.prisma.feedbackHistorial.findMany({ where: { feedbackId: feedback.id } });
    expect(previous).toHaveLength(1); expect(previous[0]!.versionModeracion).toBeNull();
    const repository = new PrismaFeedbackReporteRepository(h.prisma as unknown as PrismaService);
    expect((await repository.create(feedback.id, reporter.id, { motivo: "SPAM" })).created).toBe(true);
    const response = await report(feedback.id); expect(response.status).toBe(200); const body = await response.json();
    expect((await h.prisma.feedbackReporte.findUniqueOrThrow({ where: { id: body.id } })).historialId).toBe(previous[0]!.id);
    expect(await h.prisma.feedbackHistorial.findMany({ where: { feedbackId: feedback.id } })).toEqual(previous);
  });

  it("usuarios concurrentes no activan umbral ni cambian publicación", async () => {
    const { feedback } = await row();
    const reporters = await Promise.all(Array.from({ length: 4 }, () => h.account()));
    const responses = await Promise.all(reporters.map(account => report(feedback.id, account)));
    expect(responses.map(response => response.status)).toEqual([201, 201, 201, 201]);
    const body = await responses[0]!.json();
    const detail = await (await h.request(`/admin/feedback-reportes/${body.id}`, admin.cookie)).json();
    expect(detail).toMatchObject({ cantidadReportesActivos: 4, denunciantesAbiertos: 4 });
    expect(await h.prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } })).toEqual(feedback);
    const community = await (await h.request(`/comisiones/${feedback.comisionId}/feedback`, reporter.cookie)).json();
    expect(community.items.some((item: { id: string }) => item.id === feedback.id)).toBe(true);
  });

  it("cuota concurrente global por usuario admite cinco de ocho experiencias", async () => {
    const rows = await Promise.all(Array.from({ length: 8 }, () => row()));
    const responses = await Promise.all(rows.map(item => report(item.feedback.id)));
    expect(responses.filter(response => response.status === 201)).toHaveLength(5);
    expect(responses.filter(response => response.status === 429)).toHaveLength(3);
    expect(await h.prisma.feedbackReporte.count({ where: { denuncianteId: reporter.id } })).toBe(5);
    expect(await h.prisma.administracionHistorial.count({ where: { entidad: "feedbackReporte" } })).toBe(5);
    const accepted = responses.findIndex(response => response.status === 201);
    expect((await report(rows[accepted]!.feedback.id)).status).toBe(200);
    expect((await report(rows[accepted]!.feedback.id, reporter, { motivo: "OTRO" })).status).toBe(409);
    const another = await h.account();
    expect((await report(rows[0]!.feedback.id, another)).status).toBe(201);
  });

  it("cuota y unicidad se coordinan entre pools Prisma independientes", async () => {
    const schema = (await h.sql.query<{ current_schema: string }>("SELECT current_schema()")).rows[0]!.current_schema;
    const independent = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl!, options: `-c search_path=${schema},public` }, { schema }) });
    await independent.$connect();
    try {
      const repositories = [new PrismaFeedbackReporteRepository(h.prisma as unknown as PrismaService), new PrismaFeedbackReporteRepository(independent as unknown as PrismaService)];
      const rows = await Promise.all(Array.from({ length: 8 }, () => row()));
      const results = await Promise.allSettled(rows.map((item, index) => repositories[index % 2]!.create(item.feedback.id, reporter.id, { motivo: "SPAM" })));
      expect(results.filter(result => result.status === "fulfilled")).toHaveLength(5);
      const failures = results.filter(result => result.status === "rejected"); expect(failures).toHaveLength(3);
      for (const failure of failures) if (failure.status === "rejected") expect(failure.reason).toMatchObject({ httpStatus: 429 });
      const winner = results.findIndex(result => result.status === "fulfilled");
      const retries = await Promise.all(repositories.map(repository => repository.create(rows[winner]!.feedback.id, reporter.id, { motivo: "SPAM" })));
      expect(retries.every(result => !result.created)).toBe(true); expect(retries[0]!.reporte.id).toBe(retries[1]!.reporte.id);
      expect(await h.prisma.feedbackReporte.count()).toBe(5);
    } finally { await independent.$disconnect(); }
  });

  it("cuota móvil cuenta cerrados y libera espacio después de diez minutos", async () => {
    const reports = [];
    for (let index = 0; index < 5; index++) reports.push(await newReport());
    expect((await resolve(reports[0]!.reporte.id)).status).toBe(200);
    const next = await row();
    expect((await report(next.feedback.id)).status).toBe(429);
    await h.sql.query('UPDATE "FeedbackReporte" SET "createdAt" = clock_timestamp() - interval \'10 minutes 1 second\' WHERE "id" = $1::uuid', [reports[1]!.reporte.id]);
    expect((await report(next.feedback.id)).status).toBe(201);
    expect(await h.prisma.feedbackReporte.count()).toBe(6);
  });

  it("edición y nueva aprobación conservan versión denunciada y deduplican usuarios entre versiones", async () => {
    const { feedback, reporte } = await newReport();
    expect((await h.request(`/feedback/${feedback.id}`, owner.cookie, "PATCH", { texto: "Texto corregido posteriormente", versionEsperada: 1 })).status).toBe(200);
    expect((await report(feedback.id)).status).toBe(404);
    expect((await h.request(`/admin/feedback/${feedback.id}/moderacion`, admin.cookie, "POST", { accion: "APROBACION", versionEsperada: 2, motivo: "Corrección revisada" })).status).toBe(200);
    const second = await report(feedback.id); expect(second.status).toBe(201);
    const secondBody = await second.json(); expect(secondBody.versionReportada).toBe(3); expect(secondBody.id).not.toBe(reporte.id);
    const detail = await (await h.request(`/admin/feedback-reportes/${reporte.id}`, admin.cookie)).json();
    expect(detail.evidencia.texto).toBe(feedback.texto);
    expect(detail.experiencia.versionModeracion).toBe(3);
    expect(detail).toMatchObject({ cantidadReportesActivos: 2, denunciantesAbiertos: 1 });
    const secondDetail = await (await h.request(`/admin/feedback-reportes/${secondBody.id}`, admin.cookie)).json();
    expect(secondDetail.evidencia.texto).toBe("Texto corregido posteriormente");
    expect(await h.prisma.feedbackReporte.count({ where: { feedbackId: feedback.id } })).toBe(2);
    expect((await resolve(reporte.id)).status).toBe(200);
    const oneOpen = await (await h.request(`/admin/feedback-reportes/${secondBody.id}`, admin.cookie)).json();
    expect(oneOpen).toMatchObject({ cantidadReportesActivos: 1, denunciantesAbiertos: 1 });
    expect((await resolve(secondBody.id, "DESESTIMADO")).status).toBe(200);
    const noneOpen = await (await h.request(`/admin/feedback-reportes/${reporte.id}`, admin.cookie)).json();
    expect(noneOpen).toMatchObject({ cantidadReportesActivos: 0, denunciantesAbiertos: 0 });
  });

  it("consulta administrativa pagina nueve, filtra y ordena de forma determinista", async () => {
    const { feedback } = await row();
    const reporters = await Promise.all(Array.from({ length: 11 }, () => h.account()));
    const ids: string[] = [];
    for (const account of reporters) {
      const body = await (await report(feedback.id, account, { motivo: ids.length % 2 === 0 ? "SPAM" : "OTRO" })).json(); ids.push(body.id);
    }
    await h.sql.query('UPDATE "FeedbackReporte" SET "createdAt" = $1 WHERE "feedbackId" = $2::uuid', [new Date("2026-11-17T12:00:00Z"), feedback.id]);
    const response = await h.request("/admin/feedback-reportes", admin.cookie);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    const first = await response.json(); const second = await (await h.request("/admin/feedback-reportes?page=2", admin.cookie)).json();
    expect(first).toMatchObject({ page: 1, pageSize: 9, total: 11 }); expect(first.items).toHaveLength(9); expect(second.items).toHaveLength(2);
    expect([...first.items, ...second.items].map(item => item.id)).toEqual(ids.sort().reverse());
    expect(first.items[0]).toMatchObject({ feedbackId: feedback.id, cantidadReportesActivos: 11, denunciantesAbiertos: 11 });
    const filtered = await (await h.request(`/admin/feedback-reportes?motivo=SPAM&estado=ABIERTO&feedbackId=${feedback.id}`, admin.cookie)).json();
    expect(filtered.total).toBe(6); expect(filtered.items.every((item: { motivo: string }) => item.motivo === "SPAM")).toBe(true);
    expect((await h.request(`/admin/feedback-reportes/${randomUUID()}`, admin.cookie)).status).toBe(404);
    expect((await h.request("/admin/feedback-reportes/no-uuid", admin.cookie)).status).toBe(400);
  });

  it.each(["RESUELTO", "DESESTIMADO"])("cierra %s con actor, fecha, motivo y evidencia conservada sin moderar", async estado => {
    const { feedback, reporte } = await newReport();
    const otherReporter = await h.account(); expect((await report(feedback.id, otherReporter)).status).toBe(201);
    const response = await resolve(reporte.id, estado, admin, "  Justificación administrativa  ");
    expect(response.status).toBe(200);
    const stored = await h.prisma.feedbackReporte.findUniqueOrThrow({ where: { id: reporte.id } });
    expect(stored).toMatchObject({ estado, administradorId: admin.id, justificacion: "Justificación administrativa" }); expect(stored.resolvedAt).toBeInstanceOf(Date);
    expect(await h.prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } })).toEqual(feedback);
    const detail = await (await h.request(`/admin/feedback-reportes/${reporte.id}`, admin.cookie)).json();
    expect(detail).toMatchObject({ cantidadReportesActivos: 1, denunciantesAbiertos: 1 }); expect(detail.evidencia.texto).toBe(feedback.texto);
    expect((await resolve(reporte.id, estado === "RESUELTO" ? "DESESTIMADO" : "RESUELTO")).status).toBe(409);
    expect((await report(feedback.id)).status).toBe(200);
    expect((await h.prisma.feedbackReporte.findUniqueOrThrow({ where: { id: reporte.id } })).estado).toBe(estado);
    expect(await h.prisma.administracionHistorial.count({ where: { entidad: "feedbackReporte", entidadId: reporte.id } })).toBe(2);
    const audit = await h.prisma.administracionHistorial.findFirstOrThrow({ where: { entidad: "feedbackReporte", entidadId: reporte.id, accion: { not: "CREACION" } } });
    expect(audit.actorId).toBe(admin.id); expect(JSON.stringify(audit.cambios)).toContain("Justificación administrativa");
  });

  it("dos administradores concurrentes producen un solo cierre", async () => {
    const { reporte } = await newReport(); const secondAdmin = await h.account("ADMIN");
    const responses = await Promise.all([resolve(reporte.id), resolve(reporte.id, "DESESTIMADO", secondAdmin)]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    const stored = await h.prisma.feedbackReporte.findUniqueOrThrow({ where: { id: reporte.id } });
    expect([admin.id, secondAdmin.id]).toContain(stored.administradorId);
    expect(await h.prisma.administracionHistorial.count({ where: { entidad: "feedbackReporte", entidadId: reporte.id } })).toBe(2);
  });

  it("resoluciones anteriores están paginadas de tres y no eliminan otros reportes", async () => {
    const { feedback, reporte } = await newReport();
    const closed: string[] = [];
    for (let index = 0; index < 4; index++) {
      const another = await h.account(); const body = await (await report(feedback.id, another)).json();
      expect((await resolve(body.id, index % 2 === 0 ? "RESUELTO" : "DESESTIMADO")).status).toBe(200); closed.push(body.id);
    }
    const first = await (await h.request(`/admin/feedback-reportes/${reporte.id}`, admin.cookie)).json();
    const second = await (await h.request(`/admin/feedback-reportes/${reporte.id}?page=2`, admin.cookie)).json();
    expect(first.resolucionesAnteriores).toMatchObject({ total: 4, page: 1, pageSize: 3 }); expect(first.resolucionesAnteriores.items).toHaveLength(3);
    expect(second.resolucionesAnteriores.items).toHaveLength(1);
    expect(new Set([...first.resolucionesAnteriores.items, ...second.resolucionesAnteriores.items].map(item => item.id))).toEqual(new Set(closed));
    expect(first.denunciantesAbiertos).toBe(1); expect(await h.prisma.feedbackReporte.count()).toBe(5);
  });

  it("el autor y la comunidad nunca reciben identidad de denunciantes ni reportes", async () => {
    const { feedback, reporte } = await newReport();
    expect((await h.request(`/feedback/${feedback.id}`, reporter.cookie)).status).toBe(403);
    for (const [path, account] of [[`/comisiones/${feedback.comisionId}/feedback`, reporter], [`/feedback/${feedback.id}`, owner], ["/feedback/propios", owner], ["/feedback", reporter], [`/feedback/${feedback.id}/historial`, owner]] as const) {
      const response = await h.request(path, account.cookie); expect(response.status).toBe(200);
      const body = JSON.stringify(await response.json());
      expect(body).not.toContain(reporter.id); expect(body).not.toContain(reporte.id); expect(body).not.toMatch(/denuncianteId|feedbackReporte|reportes/);
      if (account.id !== owner.id) expect(body).not.toContain(owner.id);
    }
  });

  it("mantiene acceso ADMIN a evidencia aunque la experiencia se retire", async () => {
    const { feedback, reporte } = await newReport();
    expect((await h.request(`/feedback/${feedback.id}`, owner.cookie, "DELETE")).status).toBe(204);
    expect((await report(feedback.id)).status).toBe(404);
    const detail = await h.request(`/admin/feedback-reportes/${reporte.id}`, admin.cookie); expect(detail.status).toBe(200);
    expect((await detail.json()).evidencia.texto).toBe(feedback.texto);
    expect((await resolve(reporte.id, "DESESTIMADO")).status).toBe(200);
  });

  it("rollback del ledger revierte creación y cierre completos", async () => {
    const { feedback, reporte } = await newReport(); const another = await h.account();
    await h.sql.query('CREATE FUNCTION fail_t4_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entidad" = \'feedbackReporte\' THEN RAISE EXCEPTION \'T4 rollback probe\'; END IF; RETURN NEW; END $$');
    await h.sql.query('CREATE TRIGGER fail_t4_ledger BEFORE INSERT ON "AdministracionHistorial" FOR EACH ROW EXECUTE FUNCTION fail_t4_ledger()');
    try {
      expect((await report(feedback.id, another)).status).toBe(500);
      expect(await h.prisma.feedbackReporte.count()).toBe(1);
      expect((await resolve(reporte.id)).status).toBe(500);
      expect(await h.prisma.feedbackReporte.findUniqueOrThrow({ where: { id: reporte.id } })).toMatchObject({ estado: "ABIERTO", resolvedAt: null, administradorId: null, justificacion: null });
      expect(await h.prisma.administracionHistorial.count({ where: { entidad: "feedbackReporte" } })).toBe(1);
      expect(await h.prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } })).toEqual(feedback);
    } finally {
      await h.sql.query('DROP TRIGGER fail_t4_ledger ON "AdministracionHistorial"');
      await h.sql.query('DROP FUNCTION fail_t4_ledger()');
    }
    expect((await report(feedback.id, another)).status).toBe(201);
    expect((await resolve(reporte.id)).status).toBe(200);
  });

  it("restricciones PostgreSQL impiden duplicar y vincular evidencia de otra experiencia", async () => {
    const { reporte } = await newReport(); const stored = await h.prisma.feedbackReporte.findUniqueOrThrow({ where: { id: reporte.id } });
    await expect(h.prisma.feedbackReporte.create({ data: { ...stored, id: randomUUID() } })).rejects.toThrow();
    const other = await row(); const snapshot = await h.prisma.feedbackHistorial.findFirstOrThrow({ where: { feedbackId: other.feedback.id } });
    await expect(h.prisma.feedbackReporte.update({ where: { id: stored.id }, data: { historialId: snapshot.id } })).rejects.toThrow();
    await expect(h.prisma.feedbackReporte.update({ where: { id: stored.id }, data: { estado: "RESUELTO" } })).rejects.toThrow();
    expect((await h.prisma.feedbackReporte.findUniqueOrThrow({ where: { id: stored.id } })).estado).toBe("ABIERTO");
  });

  it("no modifica likes, respuestas, votos ni agregados públicos", async () => {
    const { feedback, context } = await row();
    await h.prisma.feedback.update({ where: { id: feedback.id }, data: { estadoModeracion: "PENDIENTE" } });
    expect((await h.request(`/admin/feedback/${feedback.id}/moderacion`, admin.cookie, "POST", { accion: "APROBACION", versionEsperada: 1, motivo: "Experiencia revisada" })).status).toBe(200);
    expect((await h.request(`/feedback/${feedback.id}/like`, reporter.cookie, "PUT")).status).toBe(200);
    expect((await h.request(`/feedback/${feedback.id}/respuestas`, reporter.cookie, "POST", { solicitudId: randomUUID(), texto: "Respuesta previa al reporte", anonimo: true })).status).toBe(201);
    const beforeFeedback = await h.prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } });
    const beforeSnapshots = await h.prisma.feedbackHistorial.findMany({ where: { feedbackId: feedback.id } });
    const beforeLikes = await h.prisma.feedbackLike.findMany({ where: { feedbackId: feedback.id } });
    const beforeResponses = await h.prisma.feedbackRespuesta.findMany({ where: { feedbackId: feedback.id } });
    const beforeVotes = await h.prisma.valoracionMateria.findMany({ where: { materiaId: context.materia.id } });
    expect(beforeLikes).toHaveLength(1); expect(beforeResponses).toHaveLength(1); expect(beforeVotes).toHaveLength(1);
    const created = await (await report(feedback.id)).json(); expect((await resolve(created.id)).status).toBe(200);
    expect(await h.prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } })).toEqual(beforeFeedback);
    expect(await h.prisma.feedbackHistorial.findMany({ where: { feedbackId: feedback.id } })).toEqual(beforeSnapshots);
    expect(await h.prisma.feedbackLike.findMany({ where: { feedbackId: feedback.id } })).toEqual(beforeLikes);
    expect(await h.prisma.feedbackRespuesta.findMany({ where: { feedbackId: feedback.id } })).toEqual(beforeResponses);
    expect(await h.prisma.valoracionMateria.findMany({ where: { materiaId: context.materia.id } })).toEqual(beforeVotes);
  });

  it("identidad T4: solo ADMIN ve denunciante con selección segura aunque la experiencia sea anónima", async () => {
    const displayName = `Denunciante privado ${randomUUID()}`;
    const email = `identidad-${randomUUID()}@alu.frlp.utn.edu.ar`;
    await h.prisma.user.update({ where: { id: reporter.id }, data: { displayName, email } });
    const { feedback, reporte } = await newReport(); const third = await h.account();
    expect(feedback.anonimo).toBe(true);
    const path = `/admin/feedback-reportes/${reporte.id}`;
    expect((await h.request(path, "")).status).toBe(401);
    for (const account of [owner, third, reporter]) expect((await h.request(path, account.cookie)).status).toBe(403);
    const response = await h.request(path, admin.cookie); expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.reporte.denunciante).toEqual({ id: reporter.id, displayName });
    expect(body.reporte.denuncianteId).toBe(reporter.id);
    expect(body.evidencia).toMatchObject({ anonimo: true, texto: feedback.texto });
    expect(JSON.stringify(body)).not.toContain(email);
    expect(JSON.stringify(body)).not.toMatch(/"(?:email|passwordHash|sessions|passwordResetCredentials|emailVerificationCredentials|token|tokenHash|password|credentials)"/);
    expect(JSON.stringify(body)).not.toContain("fixture-no-login");
  });

  it("identidad T4: el detalle usa nombre actual de cuenta sin cambiar contratos de listado y recibos", async () => {
    const originalName = `Nombre anterior ${randomUUID()}`; const currentName = `Nombre vigente ${randomUUID()}`;
    await h.prisma.user.update({ where: { id: reporter.id }, data: { displayName: originalName } });
    const { feedback, reporte } = await newReport();
    await h.prisma.user.update({ where: { id: reporter.id }, data: { displayName: currentName } });
    const detail = await (await h.request(`/admin/feedback-reportes/${reporte.id}`, admin.cookie)).json();
    expect(detail.reporte.denunciante).toEqual({ id: reporter.id, displayName: currentName });
    expect(JSON.stringify(detail)).not.toContain(originalName);
    const list = await (await h.request("/admin/feedback-reportes", admin.cookie)).json();
    expect(list.items[0]).toMatchObject({ id: reporte.id, denuncianteId: reporter.id });
    expect(list.items[0]).not.toHaveProperty("denunciante");
    const retry = await report(feedback.id); expect(retry.status).toBe(200); const retryBody = await retry.json();
    expect(retryBody).toEqual(reporte);
    for (const body of [reporte, retryBody]) {
      expect(body).not.toHaveProperty("denunciante"); expect(body).not.toHaveProperty("denuncianteId");
      expect(JSON.stringify(body)).not.toContain(reporter.id); expect(JSON.stringify(body)).not.toContain(currentName);
    }
  });

  it.each(["RESUELTO", "DESESTIMADO"])("identidad T4: cierre %s conserva trazabilidad con denunciante inactivo", async estado => {
    const displayName = `Cuenta histórica ${randomUUID()}`;
    await h.prisma.user.update({ where: { id: reporter.id }, data: { displayName } });
    const { feedback, reporte } = await newReport();
    const disabledAt = new Date();
    await h.prisma.user.update({ where: { id: reporter.id }, data: { disabledAt } });
    const inactiveBefore = await h.prisma.user.findUniqueOrThrow({ where: { id: reporter.id } });
    const reason = `Decisión ${estado} documentada`;
    const response = await resolve(reporte.id, estado, admin, reason); expect(response.status).toBe(200);
    const closure = await response.json();
    expect(closure).toMatchObject({ id: reporte.id, estado, denuncianteId: reporter.id, administradorId: admin.id, justificacion: reason });
    expect(closure).not.toHaveProperty("denunciante"); expect(closure.resolvedAt).toBeTruthy();
    const detailResponse = await h.request(`/admin/feedback-reportes/${reporte.id}`, admin.cookie); expect(detailResponse.status).toBe(200);
    const detail = await detailResponse.json();
    expect(detail.reporte.denunciante).toEqual({ id: reporter.id, displayName });
    expect(detail.reporte).toMatchObject({ estado, denuncianteId: reporter.id, administradorId: admin.id, justificacion: reason, resolvedAt: closure.resolvedAt });
    expect(detail.evidencia.texto).toBe(feedback.texto);
    expect(await h.prisma.user.findUniqueOrThrow({ where: { id: reporter.id } })).toEqual(inactiveBefore);
    const stored = await h.prisma.feedbackReporte.findUniqueOrThrow({ where: { id: reporte.id } });
    expect(stored.denuncianteId).toBe(reporter.id); expect(stored.administradorId).toBe(admin.id); expect(stored.resolvedAt!.toISOString()).toBe(closure.resolvedAt);
    expect((await h.request(`/admin/feedback-reportes/${reporte.id}`, reporter.cookie)).status).toBe(401);
  });

  it("identidad T4: desestimar no sanciona ni altera cuenta, sesiones o permisos del denunciante", async () => {
    const { feedback, reporte } = await newReport();
    const accountBefore = await h.prisma.user.findUniqueOrThrow({ where: { id: reporter.id } });
    const sessionsBefore = await h.prisma.session.findMany({ where: { userId: reporter.id } });
    expect((await resolve(reporte.id, "DESESTIMADO")).status).toBe(200);
    expect(await h.prisma.user.findUniqueOrThrow({ where: { id: reporter.id } })).toEqual(accountBefore);
    expect(await h.prisma.session.findMany({ where: { userId: reporter.id } })).toEqual(sessionsBefore);
    expect((await h.request("/admin/feedback-reportes", reporter.cookie)).status).toBe(403);
    expect((await h.request(`/comisiones/${feedback.comisionId}/feedback`, reporter.cookie)).status).toBe(200);
    const another = await row(); expect((await report(another.feedback.id)).status).toBe(201);
    expect(await h.prisma.administracionHistorial.count({ where: { entidad: "usuario", entidadId: reporter.id } })).toBe(0);
    const detail = await (await h.request(`/admin/feedback-reportes/${reporte.id}`, admin.cookie)).json();
    expect(detail.reporte.denunciante).toEqual({ id: reporter.id, displayName: accountBefore.displayName });
  });

  it("identidad T4: identidad privada no aparece en comunidad, propios, historial, respuestas ni recibos", async () => {
    const displayName = `Identidad exclusiva ${randomUUID()}`;
    const email = `privado-${randomUUID()}@alu.frlp.utn.edu.ar`;
    await h.prisma.user.update({ where: { id: reporter.id }, data: { displayName, email } });
    const { feedback, reporte } = await newReport();
    const retry = await report(feedback.id); expect(retry.status).toBe(200);
    const paths: [string, Account][] = [
      ["/feedback/feed", owner], ["/feedback", owner], [`/comisiones/${feedback.comisionId}/feedback`, owner],
      [`/feedback/${feedback.id}`, owner], ["/feedback/propios", owner], [`/feedback/${feedback.id}/historial`, owner],
      [`/feedback/${feedback.id}/respuestas`, owner], ["/rankings/comisiones", owner], ["/rankings/profesores", owner],
    ];
    const bodies: unknown[] = [reporte, await retry.json()];
    for (const [path, account] of paths) {
      const response = await h.request(path, account.cookie); expect(response.status).toBe(200); bodies.push(await response.json());
    }
    for (const body of bodies) {
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain(reporter.id); expect(serialized).not.toContain(displayName); expect(serialized).not.toContain(email);
      expect(serialized).not.toMatch(/"denunciante(?:Id)?"|"passwordHash"|"tokenHash"/);
    }
  });

  it("identidad T4: denunciante obligatorio con FK y payload no puede suplantar identidad", async () => {
    const { feedback, reporte } = await newReport();
    const forged = await report(feedback.id, reporter, { motivo: "SPAM", denuncianteId: owner.id }); expect(forged.status).toBe(400);
    await expect(h.sql.query('UPDATE "FeedbackReporte" SET "denuncianteId" = NULL WHERE "id" = $1::uuid', [reporte.id])).rejects.toThrow();
    await expect(h.prisma.feedbackReporte.update({ where: { id: reporte.id }, data: { denuncianteId: randomUUID() } })).rejects.toThrow();
    expect((await h.prisma.feedbackReporte.findUniqueOrThrow({ where: { id: reporte.id } })).denuncianteId).toBe(reporter.id);
    const detail = await (await h.request(`/admin/feedback-reportes/${reporte.id}`, admin.cookie)).json();
    expect(detail.reporte.denunciante.id).toBe(reporter.id);
  });
});
