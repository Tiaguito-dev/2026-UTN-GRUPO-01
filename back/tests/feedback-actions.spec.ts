import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { FeedbackService } from "../src/reviews/application/feedback.service.js";
import type { FeedbackRepository } from "../src/reviews/application/ports/feedback.repository.js";
import { validateModerationQuery, validateModerationCommand, validateOwnerModerationCommand, validateUpdateFeedback, validateCreateFeedback } from "../src/reviews/application/feedback-input.js";

describe("T3: contratos explícitos de acciones", () => {
  it("cola pendiente por defecto y páginas de hasta nueve", () => {
    expect(validateModerationQuery({})).toEqual({ page: 1, pageSize: 9, estado: "PENDIENTE" });
    expect(validateModerationQuery({ page: "2", pageSize: "3", estado: "RECHAZADO" })).toEqual({ page: 2, pageSize: 3, estado: "RECHAZADO" });
  });
  it.each([{ estado: "PUBLICADO" }, { estado: ["PENDIENTE", "APROBADO"] }, { pageSize: "10" }, { autorId: randomUUID() }, { page: "0" }])("rechaza consulta inválida %j", query => {
    expect(() => validateModerationQuery(query)).toThrow();
  });
  it.each(["APROBACION", "RECHAZO", "OCULTAMIENTO_ADMIN", "RESTITUCION_ADMIN"])("admite decisión %s con motivo normalizado", accion => {
    expect(validateModerationCommand({ accion, versionEsperada: 2, motivo: "  Revisión humana  " })).toEqual({ accion, versionEsperada: 2, motivo: "Revisión humana" });
  });
  it.each([undefined, "", " ", "x".repeat(1001), "Motivo\nno permitido", "Motivo\u0000no permitido"])("rechaza motivo inválido %j", motivo => {
    expect(() => validateModerationCommand({ accion: "APROBACION", versionEsperada: 1, motivo })).toThrow();
  });
  it.each([0, -1, 1.5, "1", null, 2_147_483_648])("rechaza versión %j", versionEsperada => {
    expect(() => validateOwnerModerationCommand({ versionEsperada })).toThrow();
    expect(() => validateModerationCommand({ accion: "APROBACION", versionEsperada, motivo: "Revisado" })).toThrow();
  });
  it.each(["SOLICITUD_REVISION", "OCULTAMIENTO_AUTOR", "PENDIENTE", "ELIMINACION"])("ADMIN no recibe acciones arbitrarias %s", accion => {
    expect(() => validateModerationCommand({ accion, versionEsperada: 1, motivo: "Revisado" })).toThrow();
  });
  it("el autor solo envía versión, nunca identidad, estado o causas", () => {
    expect(validateOwnerModerationCommand({ versionEsperada: 1 })).toEqual({ versionEsperada: 1 });
    for (const extra of [{ actorId: randomUUID() }, { accion: "APROBACION" }, { motivo: "Privado" }, { ocultoReportes: false }, { role: "ADMIN" }]) {
      expect(() => validateOwnerModerationCommand({ versionEsperada: 1, ...extra })).toThrow();
      if (!("accion" in extra) && !("motivo" in extra)) expect(() => validateModerationCommand({ accion: "APROBACION", motivo: "Revisado", versionEsperada: 1, ...extra })).toThrow();
    }
  });
  it("edición admite versión opcional y sigue rechazando estados y destinos", () => {
    expect(validateUpdateFeedback({ texto: "Corregido", versionEsperada: 3 })).toEqual({ texto: "Corregido", versionEsperada: 3 });
    expect(validateUpdateFeedback({ texto: "Corregido" })).toEqual({ texto: "Corregido" });
    for (const extra of [{ estadoModeracion: "APROBADO" }, { requiereRevisionHumana: false }, { motivoRechazo: null }, { ocultoAutor: false }, { comisionId: randomUUID() }, { profesorId: randomUUID() }]) {
      expect(() => validateUpdateFeedback({ texto: "Corregido", ...extra })).toThrow();
      if (!("profesorId" in extra)) expect(() => validateCreateFeedback({ texto: "Alta", anonimo: true, puntuacion: 4, ...extra })).toThrow();
    }
  });
  it("service valida versión/UUID/payload antes del repositorio", () => {
    const transitionModeration = vi.fn();
    const service = new FeedbackService({ transitionModeration } as unknown as FeedbackRepository);
    const actor = { id: randomUUID(), role: "ADMIN" as const };
    expect(() => service.moderate("invalido", actor, { accion: "APROBACION", motivo: "Revisado", versionEsperada: 1 })).toThrow();
    expect(() => service.moderate(randomUUID(), actor, { accion: "APROBACION", versionEsperada: 1 })).toThrow();
    expect(transitionModeration).not.toHaveBeenCalled();
  });
});
