import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { moderationHarness, type ModerationHarness } from "./support/moderation-harness.js";
import { PrismaFeedbackRepository } from "../src/reviews/infrastructure/prisma-feedback.repository.js";
import type { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const matrix = (["PENDIENTE", "APROBADO", "RECHAZADO"] as const).flatMap(estadoModeracion =>
  [false, true].flatMap(deleted => [false, true].flatMap(ocultoAutor =>
    [false, true].flatMap(ocultoAdministracion => [false, true].map(ocultoReportes => ({ estadoModeracion, deleted, ocultoAutor, ocultoAdministracion, ocultoReportes }))))));

describe.skipIf(!databaseUrl)("T2: visibilidad HTTP y PostgreSQL sin cruces de fixtures", () => {
  let h: ModerationHarness;
  let owner: Awaited<ReturnType<ModerationHarness["account"]>>;
  let reader: typeof owner;
  let admin: typeof owner;
  beforeAll(async () => { h = await moderationHarness(databaseUrl!); }, 30_000);
  beforeEach(async () => {
    await h.reset();
    owner = await h.account(); reader = await h.account(); admin = await h.account("ADMIN");
  });
  afterAll(async () => { if (h) await h.close(); });

  it.each(matrix)("aplica política en superficies públicas y conserva accesos autorizados: %j", async value => {
    const context = await h.context();
    const visible = value.estadoModeracion === "APROBADO" && !value.deleted && !value.ocultoAutor && !value.ocultoAdministracion && !value.ocultoReportes;
    const feedback = await h.feedback(context, owner.id, { estadoModeracion: value.estadoModeracion,
      deletedAt: value.deleted ? new Date() : null, ocultoAutor: value.ocultoAutor, ocultoAdministracion: value.ocultoAdministracion,
      ocultoReportes: value.ocultoReportes, ...(value.estadoModeracion === "RECHAZADO" ? { requiereRevisionHumana: true, motivoRechazo: "Motivo privado" } : {}) });
    for (const cookie of [reader.cookie, admin.cookie]) {
      for (const path of [`/feedback?materiaId=${context.materia.id}`, `/comisiones/${context.comision.id}/feedback`, "/feedback/feed"]) {
        const response = await h.request(path, cookie);
        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("no-store");
        const body = await response.json();
        expect(body.items.map((item: { id: string }) => item.id)).toEqual(visible ? [feedback.id] : []);
        if ("total" in body) expect(body.total).toBe(visible ? 1 : 0);
        expect(JSON.stringify(body)).not.toMatch(/autorId|Identidad privada|motivoRechazo|Motivo privado|ocultoAdministracion/);
      }
      expect((await h.request(`/feedback/${feedback.id}/respuestas`, cookie)).status).toBe(visible ? 200 : 404);
      expect((await h.request(`/feedback/${feedback.id}`, cookie)).status).toBe(visible ? 403 : 404);
      expect((await h.request(`/feedback/${feedback.id}/like`, cookie, "PUT")).status).toBe(visible ? 200 : 404);
      expect((await h.request(`/feedback/${feedback.id}/respuestas`, cookie, "POST", { texto: "Consulta", anonimo: true, solicitudId: randomUUID() })).status).toBe(visible ? 201 : 404);
    }
    expect((await h.request(`/feedback/${feedback.id}`, owner.cookie)).status).toBe(value.deleted ? 404 : 200);
    expect((await h.request(`/feedback/${feedback.id}/historial`, owner.cookie)).status).toBe(200);
    const own = await (await h.request(`/comisiones/${context.comision.id}/feedback/propio`, owner.cookie)).json();
    expect(own?.id ?? null).toBe(value.deleted ? null : feedback.id);
    expect((await h.request(`/admin/feedback/${feedback.id}/detalle`, reader.cookie)).status).toBe(403);
    expect((await h.request(`/admin/feedback/${feedback.id}/detalle`, admin.cookie)).status).toBe(200);
  });

  it("oculta relaciones sin destruirlas y las devuelve al restituir aprobación visible", async () => {
    const context = await h.context();
    const feedback = await h.feedback(context, owner.id);
    const like = await h.request(`/feedback/${feedback.id}/like`, reader.cookie, "PUT");
    expect(like.status).toBe(200);
    const created = await h.request(`/feedback/${feedback.id}/respuestas`, reader.cookie, "POST", { texto: "Respuesta existente", anonimo: true, solicitudId: randomUUID() });
    expect(created.status).toBe(201);
    const reply = await created.json();
    const repo = new PrismaFeedbackRepository(h.prisma as unknown as PrismaService);
    await repo.transitionModeration(feedback.id, { id: admin.id, role: "ADMIN" }, { accion: "OCULTAMIENTO_ADMIN", versionEsperada: 1, motivo: "Revisión temporal" });
    expect((await h.request(`/feedback/${feedback.id}/respuestas`, reader.cookie)).status).toBe(404);
    expect((await h.request(`/feedback/respuestas/${reply.id}`, reader.cookie, "PATCH", { texto: "No modificar oculto" })).status).toBe(404);
    expect((await h.request(`/feedback/${feedback.id}/like`, reader.cookie, "DELETE")).status).toBe(404);
    expect(await h.prisma.feedbackLike.count({ where: { feedbackId: feedback.id, deletedAt: null } })).toBe(1);
    expect(await h.prisma.feedbackRespuesta.count({ where: { feedbackId: feedback.id, deletedAt: null } })).toBe(1);
    await repo.transitionModeration(feedback.id, { id: admin.id, role: "ADMIN" }, { accion: "RESTITUCION_ADMIN", versionEsperada: 2, motivo: "Revisión finalizada" });
    const feed = await (await h.request("/feedback/feed", reader.cookie)).json();
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0]).toMatchObject({ id: feedback.id, cantidadLikes: 1, cantidadRespuestas: 1, meGusta: true, autor: null });
    const replies = await (await h.request(`/feedback/${feedback.id}/respuestas`, reader.cookie)).json();
    expect(replies.items.map((item: { id: string }) => item.id)).toEqual([reply.id]);
  });

  it("cursor revalida visibilidad y no filtra un ocultamiento posterior a la primera página", async () => {
    const contexts = await Promise.all([h.context(), h.context(), h.context()]);
    const rows = [];
    for (const [index, context] of contexts.entries()) rows.push(await h.feedback(context, owner.id, { createdAt: new Date(Date.UTC(2026, 10, 17, 0, 0, index)) }));
    const first = await (await h.request("/feedback/feed?pageSize=1", reader.cookie)).json();
    expect(first.items[0].id).toBe(rows[2]!.id);
    await new PrismaFeedbackRepository(h.prisma as unknown as PrismaService).transitionModeration(rows[1]!.id, { id: admin.id, role: "ADMIN" },
      { accion: "OCULTAMIENTO_ADMIN", versionEsperada: 1, motivo: "Revisión en curso" });
    const next = await (await h.request(`/feedback/feed?pageSize=1&cursor=${first.nextCursor}`, reader.cookie)).json();
    expect(next.items.map((item: { id: string }) => item.id)).toEqual([rows[0]!.id]);
    expect(next.hasMore).toBe(false);
  });
});
