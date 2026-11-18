import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { moderationHarness, type ModerationHarness } from "./support/moderation-harness.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
type Account = Awaited<ReturnType<ModerationHarness["account"]>>;

describe.skipIf(!databaseUrl)("T3: acciones HTTP con sesión y PostgreSQL reales", () => {
  let h: ModerationHarness;
  let owner: Account;
  let other: Account;
  let admin: Account;
  beforeAll(async () => { h = await moderationHarness(databaseUrl!); }, 30_000);
  beforeEach(async () => { await h.reset(); owner = await h.account(); other = await h.account(); admin = await h.account("ADMIN"); });
  afterAll(async () => { if (h) await h.close(); });
  const decision = (id: string, accion: string, versionEsperada = 1, actor?: Account) => h.request(`/admin/feedback/${id}/moderacion`, (actor ?? admin).cookie, "POST", { accion, versionEsperada, motivo: "Revisión administrativa privada" });
  const ownAction = (id: string, accion: string, versionEsperada = 1, actor?: Account) => h.request(`/feedback/${id}/${accion}`, (actor ?? owner).cookie, "POST", { versionEsperada });
  async function row(estadoModeracion: "PENDIENTE" | "APROBADO" = "PENDIENTE", autorId?: string) {
    const context = await h.context();
    return { context, feedback: await h.feedback(context, autorId ?? owner.id, { estadoModeracion }) };
  }
  async function voteCount(materiaId: string) { return h.prisma.valoracionMateria.count({ where: { materiaId, usuarioId: owner.id, deletedAt: null } }); }

  it("propios pagina nueve, filtra identidad y bajas, incluye todos los estados y contexto histórico", async () => {
    const rows: Awaited<ReturnType<ModerationHarness["feedback"]>>[] = [];
    const timestamp = new Date("2026-11-17T00:00:00Z");
    for (let index = 0; index < 11; index++) {
      const context = await h.context();
      rows.push(await h.feedback(context, owner.id, { estadoModeracion: index === 0 ? "RECHAZADO" : index === 1 ? "PENDIENTE" : "APROBADO", createdAt: timestamp,
        ...(index === 0 ? { requiereRevisionHumana: true, motivoRechazo: "Corregir el texto", ocultoAdministracion: true } : {}) }));
    }
    const { context } = await row("PENDIENTE", other.id);
    await h.feedback(context, owner.id, { deletedAt: new Date() });
    const response = await h.request("/feedback/propios", owner.cookie);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    const first = await response.json();
    const second = await (await h.request("/feedback/propios?page=2", owner.cookie)).json();
    expect(first).toMatchObject({ total: 11, page: 1, pageSize: 9 });
    expect(first.items).toHaveLength(9); expect(second.items).toHaveLength(2);
    const all = [...first.items, ...second.items];
    expect(all.map(item => item.id)).toEqual(rows.map(item => item.id).sort().reverse());
    expect(all.find(item => item.id === rows[0]!.id)).toMatchObject({ estadoModeracion: "RECHAZADO", motivoRechazo: "Corregir el texto", versionModeracion: 1, ocultoAdministracion: true, propio: true, autor: null });
    expect(all[0].contexto).toMatchObject({ nombre: "S-31", anio: 2026 });
    expect(JSON.stringify(all)).not.toMatch(/autorId|passwordHash|email|Identidad privada/);
    const otherRows = await (await h.request("/feedback/propios", other.cookie)).json();
    expect(otherRows.total).toBe(1);
    expect((await h.request(`/feedback/propios?autorId=${other.id}`, owner.cookie)).status).toBe(400);
    expect((await h.request("/feedback/propios?pageSize=10", owner.cookie)).status).toBe(400);
  });

  it("cola ADMIN usa pendientes por defecto, filtro de estado y orden determinista sin bajas", async () => {
    const pending = await row(); const approved = await row("APROBADO");
    const rejected = await row(); await decision(rejected.feedback.id, "RECHAZO");
    const deleted = await row(); await h.prisma.feedback.update({ where: { id: deleted.feedback.id }, data: { deletedAt: new Date() } });
    expect((await h.request("/admin/feedback", owner.cookie)).status).toBe(403);
    const response = await h.request("/admin/feedback", admin.cookie);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    const queue = await response.json();
    expect(queue).toMatchObject({ total: 1, page: 1, pageSize: 9 });
    expect(queue.items[0]).toMatchObject({ id: pending.feedback.id, estadoModeracion: "PENDIENTE", versionModeracion: 1 });
    expect(queue.items[0].contexto).toMatchObject({ materiaNombre: pending.context.materia.nombre });
    expect(queue.items[0].createdAt).toBeTruthy(); expect(queue.items[0].updatedAt).toBeTruthy();
    const filtered = await (await h.request("/admin/feedback?estado=APROBADO", admin.cookie)).json();
    expect(filtered.items.map((item: { id: string }) => item.id)).toEqual([approved.feedback.id]);
    expect((await h.request("/admin/feedback?estado=TODOS", admin.cookie)).status).toBe(400);
    expect((await h.request("/admin/feedback?pageSize=10", admin.cookie)).status).toBe(400);
    expect((await h.request(`/admin/feedback/${pending.feedback.id}/detalle`, admin.cookie)).status).toBe(200);
  });

  it("todas las rutas nuevas exigen sesión y escrituras Origin/CSRF", async () => {
    const { feedback } = await row("APROBADO");
    for (const path of ["/feedback/propios", "/admin/feedback"]) expect((await h.request(path, "")).status).toBe(401);
    for (const path of [`/feedback/${feedback.id}/ocultar`, `/feedback/${feedback.id}/restaurar`, `/feedback/${feedback.id}/revision`, `/admin/feedback/${feedback.id}/moderacion`]) {
      expect((await h.request(path, "", "POST", { versionEsperada: 1 })).status).toBe(401);
      const response = await fetch(`${h.url}${path}`, { method: "POST", headers: { Cookie: admin.cookie, "Content-Type": "application/json" }, body: JSON.stringify({ versionEsperada: 1, accion: "RECHAZO", motivo: "Revisado" }) });
      expect(response.status).toBe(403);
    }
  });

  it("aprueba ajeno, publica y sincroniza votos; auditoría correlacionada conserva actor real", async () => {
    const { feedback, context } = await row();
    expect(await voteCount(context.materia.id)).toBe(0);
    const response = await decision(feedback.id, "APROBACION");
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ estadoModeracion: "APROBADO", versionModeracion: 2 });
    expect(await voteCount(context.materia.id)).toBe(1);
    const snapshot = await h.prisma.feedbackHistorial.findFirstOrThrow({ where: { feedbackId: feedback.id, accion: "APROBACION" } });
    expect(await h.prisma.administracionHistorial.findUnique({ where: { id: snapshot.id } })).toMatchObject({ actorId: admin.id, entidadId: feedback.id, accion: "APROBACION" });
    const detail = await (await h.request(`/admin/feedback/${feedback.id}/detalle`, admin.cookie)).json();
    expect(detail.historial.items.find((item: { accion: string }) => item.accion === "APROBACION")).toMatchObject({ actorId: admin.id,
      cambios: expect.arrayContaining([{ campo: "estadoModeracion", anterior: "PENDIENTE", nuevo: "APROBADO" }, { campo: "motivo", anterior: null, nuevo: "Revisión administrativa privada" }]) });
    const publicResponse = await (await h.request("/feedback", other.cookie)).json();
    expect(publicResponse.items).toHaveLength(1); expect(publicResponse.items[0].autor).toBeNull();
    expect(JSON.stringify(publicResponse)).not.toMatch(/motivo|Revisión administrativa privada|autorId|Identidad privada/);
    expect(JSON.stringify(await (await h.request(`/feedback/${feedback.id}/historial`, owner.cookie)).json())).not.toContain("Revisión administrativa privada");
  });

  it.each(["ocultar", "restaurar", "revision"])("ni tercero ni ADMIN ajeno ejercen acción del autor %s", async action => {
    const { feedback } = await row("APROBADO");
    for (const actor of [other, admin]) expect((await ownAction(feedback.id, action, 1, actor)).status).toBe(403);
    expect(await h.prisma.feedbackHistorial.count({ where: { feedbackId: feedback.id } })).toBe(1);
  });

  it.each(["APROBACION", "RECHAZO", "OCULTAMIENTO_ADMIN", "RESTITUCION_ADMIN"])("USER no puede forzar decisión %s", async action => {
    const { feedback } = await row();
    for (const actor of [owner, other]) expect((await decision(feedback.id, action, 1, actor)).status).toBe(403);
  });

  it("ADMIN autor conserva acciones propias pero no autoaprobación ni edición ajena", async () => {
    const own = await row("PENDIENTE", admin.id);
    expect((await decision(own.feedback.id, "APROBACION")).status).toBe(403);
    const approved = await row("APROBADO", admin.id);
    expect((await ownAction(approved.feedback.id, "ocultar", 1, admin)).status).toBe(200);
    const foreign = await row("APROBADO");
    expect((await h.request(`/feedback/${foreign.feedback.id}`, admin.cookie, "PATCH", { texto: "Ajeno", versionEsperada: 1 })).status).toBe(403);
  });

  it("ocultamiento/restauración voluntarios y administrativos mantienen causas independientes y votos", async () => {
    const { feedback, context } = await row();
    expect((await decision(feedback.id, "APROBACION")).status).toBe(200);
    expect((await ownAction(feedback.id, "ocultar", 2)).status).toBe(200); expect(await voteCount(context.materia.id)).toBe(0);
    expect((await decision(feedback.id, "OCULTAMIENTO_ADMIN", 3)).status).toBe(200);
    expect((await ownAction(feedback.id, "restaurar", 4)).status).toBe(200);
    expect(await h.prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } })).toMatchObject({ ocultoAutor: false, ocultoAdministracion: true, estadoModeracion: "APROBADO", versionModeracion: 5 });
    expect(await voteCount(context.materia.id)).toBe(0);
    expect((await decision(feedback.id, "RESTITUCION_ADMIN", 5)).status).toBe(200); expect(await voteCount(context.materia.id)).toBe(1);
    await h.prisma.feedback.update({ where: { id: feedback.id }, data: { ocultoReportes: true, ocultoAutor: true, ocultoAdministracion: true } });
    expect((await ownAction(feedback.id, "restaurar", 6)).status).toBe(200);
    expect((await decision(feedback.id, "RESTITUCION_ADMIN", 7)).status).toBe(200);
    expect(await h.prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } })).toMatchObject({ ocultoAutor: false, ocultoAdministracion: false, ocultoReportes: true });
    expect(await voteCount(context.materia.id)).toBe(0);
    expect((await (await h.request("/feedback", other.cookie)).json()).items).toHaveLength(0);
  });

  it.each(["PENDIENTE", "RECHAZADO"] as const)("restitución ADMIN de %s no publica; autor no oculta/restaura", async estado => {
    const { feedback, context } = await row();
    let version = 1;
    if (estado === "RECHAZADO") { expect((await decision(feedback.id, "RECHAZO")).status).toBe(200); version++; }
    await h.prisma.feedback.update({ where: { id: feedback.id }, data: { ocultoAdministracion: true } });
    expect((await decision(feedback.id, "RESTITUCION_ADMIN", version)).status).toBe(200);
    expect(await voteCount(context.materia.id)).toBe(0);
    for (const action of ["ocultar", "restaurar"]) expect((await ownAction(feedback.id, action, version + 1)).status).toBe(409);
  });

  it("rechazo retira voto, conserva motivo para el autor y exige corrección textual y solicitud separada", async () => {
    const { feedback, context } = await row();
    expect((await decision(feedback.id, "APROBACION")).status).toBe(200);
    expect((await decision(feedback.id, "RECHAZO", 2)).status).toBe(200); expect(await voteCount(context.materia.id)).toBe(0);
    expect((await (await h.request(`/feedback/${feedback.id}`, owner.cookie)).json()).motivoRechazo).toBe("Revisión administrativa privada");
    expect((await ownAction(feedback.id, "revision", 3)).status).toBe(409);
    expect((await h.request(`/feedback/${feedback.id}`, owner.cookie, "PATCH", { anonimo: false, puntuacion: 5, versionEsperada: 3 })).status).toBe(200);
    expect((await ownAction(feedback.id, "revision", 4)).status).toBe(409);
    expect((await h.request(`/feedback/${feedback.id}`, owner.cookie, "PATCH", { texto: "Contenido corregido", versionEsperada: 4 })).status).toBe(200);
    expect(await h.prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } })).toMatchObject({ estadoModeracion: "RECHAZADO", versionModeracion: 5, requiereRevisionHumana: true });
    expect((await decision(feedback.id, "APROBACION", 5)).status).toBe(409);
    expect((await ownAction(feedback.id, "revision", 5)).status).toBe(200);
    expect(await h.prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } })).toMatchObject({ estadoModeracion: "PENDIENTE", versionModeracion: 6, requiereRevisionHumana: true });
    expect(await voteCount(context.materia.id)).toBe(0);
    expect((await decision(feedback.id, "APROBACION", 6)).status).toBe(200); expect(await voteCount(context.materia.id)).toBe(1);
  });

  it("rechazado corrige y solicita revisión con comisión y ancestros dados de baja conservando snapshots", async () => {
    const { feedback, context } = await row();
    expect((await decision(feedback.id, "RECHAZO")).status).toBe(200);
    await h.prisma.comision.update({ where: { id: context.comision.id }, data: { activa: false, deletedAt: new Date(), numero: 99 } });
    await h.prisma.cursada.update({ where: { id: context.cursada.id }, data: { deletedAt: new Date() } });
    await h.prisma.materia.update({ where: { id: context.materia.id }, data: { deletedAt: new Date(), nombre: "Nombre posterior" } });
    const response = await h.request(`/feedback/${feedback.id}`, owner.cookie, "PATCH", { texto: "Corrección histórica", versionEsperada: 2 });
    expect(response.status).toBe(200); const updated = await response.json();
    expect(updated.contexto).toMatchObject({ nombre: "S-31", materiaNombre: context.materia.nombre, comisionId: context.comision.id });
    expect((await ownAction(feedback.id, "revision", 3)).status).toBe(200);
    expect((await h.request(`/comisiones/${context.comision.id}/feedback`, other.cookie, "POST", { texto: "Alta inválida", anonimo: true, puntuacion: 4 })).status).toBe(404);
  });

  it.each(["PENDIENTE", "APROBADO"] as const)("otras ediciones de %s siguen bloqueadas en comisión inactiva", async estado => {
    const { feedback, context } = await row(estado);
    await h.prisma.comision.update({ where: { id: context.comision.id }, data: { activa: false } });
    expect((await h.request(`/feedback/${feedback.id}`, owner.cookie, "PATCH", { texto: "No permitido", versionEsperada: 1 })).status).toBe(409);
  });

  it("editar aprobado conserva publicación; no-op no escribe; versión obsoleta falla aun sin diferencias", async () => {
    const { feedback } = await row("APROBADO");
    const noOp = await h.request(`/feedback/${feedback.id}`, owner.cookie, "PATCH", { texto: feedback.texto, versionEsperada: 1 });
    expect(noOp.status).toBe(200); expect(await h.prisma.feedbackHistorial.count({ where: { feedbackId: feedback.id } })).toBe(1);
    expect((await h.request(`/feedback/${feedback.id}`, owner.cookie, "PATCH", { texto: "Modificación real", versionEsperada: 1 })).status).toBe(200);
    expect(await h.prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } })).toMatchObject({ estadoModeracion: "APROBADO", versionModeracion: 2 });
    expect((await h.request(`/feedback/${feedback.id}`, owner.cookie, "PATCH", { texto: "Modificación real", versionEsperada: 1 })).status).toBe(409);
    expect(await h.prisma.feedbackHistorial.count({ where: { feedbackId: feedback.id } })).toBe(2);
  });

  it("nueva publicación conserva el historial de un rechazo retirado", async () => {
    const { feedback, context } = await row();
    expect((await decision(feedback.id, "RECHAZO")).status).toBe(200);
    expect((await h.request(`/feedback/${feedback.id}`, owner.cookie, "DELETE")).status).toBe(204);
    const created = await h.request(`/comisiones/${context.comision.id}/feedback`, owner.cookie, "POST", { texto: "Nuevo intento", anonimo: true, puntuacion: 4 });
    expect(created.status).toBe(201); const replacement = await created.json();
    expect(replacement.id).not.toBe(feedback.id);
    expect(await h.prisma.feedback.findUniqueOrThrow({ where: { id: replacement.id } })).toMatchObject({ estadoModeracion: "APROBADO", requiereRevisionHumana: false });
    expect(await h.prisma.feedbackHistorial.count({ where: { feedbackId: feedback.id, accion: "RECHAZO" } })).toBe(1);
    expect((await (await h.request("/feedback", other.cookie)).json()).total).toBe(1);
  });

  it.each(["ocultar", "restaurar", "revision"])("baja lógica bloquea acción de autor %s", async action => {
    const { feedback } = await row("APROBADO"); await h.prisma.feedback.update({ where: { id: feedback.id }, data: { deletedAt: new Date() } });
    expect((await ownAction(feedback.id, action)).status).toBe(404);
    expect((await decision(feedback.id, "RECHAZO")).status).toBe(404);
  });

  it("no-op de ocultamiento no duplica eventos y reintento obsoleto devuelve 409", async () => {
    const { feedback } = await row("APROBADO");
    expect((await ownAction(feedback.id, "ocultar")).status).toBe(200);
    expect((await ownAction(feedback.id, "ocultar", 2)).status).toBe(200);
    expect((await ownAction(feedback.id, "ocultar", 1)).status).toBe(409);
    expect(await h.prisma.feedbackHistorial.count({ where: { feedbackId: feedback.id, accion: "OCULTAMIENTO_AUTOR" } })).toBe(1);
    expect(await h.prisma.administracionHistorial.count({ where: { entidadId: feedback.id } })).toBe(1);
  });

  it("dos administradores sobre una versión producen una decisión y un 409", async () => {
    const { feedback } = await row(); const secondAdmin = await h.account("ADMIN");
    const responses = await Promise.all([decision(feedback.id, "APROBACION"), decision(feedback.id, "RECHAZO", 1, secondAdmin)]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    expect(await h.prisma.feedbackHistorial.count({ where: { feedbackId: feedback.id, accion: { in: ["APROBACION", "RECHAZO"] } } })).toBe(1);
  });

  it("aprobación concurrente con edición no publica contenido sin revisión", async () => {
    const { feedback } = await row();
    const responses = await Promise.all([decision(feedback.id, "APROBACION"), h.request(`/feedback/${feedback.id}`, owner.cookie, "PATCH", { texto: "Cambio simultáneo", versionEsperada: 1 })]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    const current = await h.prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } });
    expect(current.estadoModeracion === "APROBADO" ? current.texto === feedback.texto : current.texto === "Cambio simultáneo").toBe(true);
    expect(current.versionModeracion).toBe(2);
  });

  it("ocultamiento voluntario concurrente con rechazo conserva una sola versión ganadora", async () => {
    const { feedback } = await row("APROBADO");
    const responses = await Promise.all([ownAction(feedback.id, "ocultar"), decision(feedback.id, "RECHAZO")]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    expect((await h.prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } })).versionModeracion).toBe(2);
    expect(await h.prisma.administracionHistorial.count({ where: { entidadId: feedback.id } })).toBe(1);
  });

  it("dos solicitudes simultáneas generan un solo reenvío humano", async () => {
    const { feedback } = await row(); await decision(feedback.id, "RECHAZO");
    expect((await h.request(`/feedback/${feedback.id}`, owner.cookie, "PATCH", { texto: "Corrección para revisión", versionEsperada: 2 })).status).toBe(200);
    const responses = await Promise.all([ownAction(feedback.id, "revision", 3), ownAction(feedback.id, "revision", 3)]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    expect(await h.prisma.feedbackHistorial.count({ where: { feedbackId: feedback.id, accion: "SOLICITUD_REVISION" } })).toBe(1);
  });

  it("fallo del ledger HTTP revierte estado, versión, snapshot y voto", async () => {
    const { feedback, context } = await row();
    // Trigger exists only in the owned schema; force a real failure after nested snapshot/vote writes.
    await h.sql.query('CREATE FUNCTION fail_t3_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION \'T3 rollback probe\'; END $$');
    await h.sql.query('CREATE TRIGGER fail_t3_ledger BEFORE INSERT ON "AdministracionHistorial" FOR EACH ROW EXECUTE FUNCTION fail_t3_ledger()');
    try {
      expect((await decision(feedback.id, "APROBACION")).status).toBe(500);
      expect(await h.prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } })).toMatchObject({ estadoModeracion: "PENDIENTE", versionModeracion: 1 });
      expect(await h.prisma.feedbackHistorial.count({ where: { feedbackId: feedback.id } })).toBe(1);
      expect(await h.prisma.administracionHistorial.count({ where: { entidadId: feedback.id } })).toBe(0);
      expect(await voteCount(context.materia.id)).toBe(0);
    } finally {
      await h.sql.query('DROP TRIGGER fail_t3_ledger ON "AdministracionHistorial"');
      await h.sql.query('DROP FUNCTION fail_t3_ledger()');
    }
  });
});
