import { describe, expect, it } from "vitest";
import { validateModerationCommand } from "../src/reviews/application/feedback-input.js";
import { validateReporteQuery } from "../src/reviews/application/feedback-reporte-input.js";
import { transitionFeedbackModeration, type FeedbackModerationRecord } from "../src/reviews/domain/feedback-moderation.js";

describe("T5: contratos de restitución y bandeja", () => {
  it("admite restitución preventiva explícita y justificada", () => {
    expect(validateModerationCommand({ accion: "RESTITUCION_REPORTES", versionEsperada: 2, motivo: "  Revisado  " }))
      .toEqual({ accion: "RESTITUCION_REPORTES", versionEsperada: 2, motivo: "Revisado" });
  });
  it.each([undefined, "", " ", "x".repeat(1001), "Revisión\ninválida"])("restitución rechaza justificación inválida %j", motivo => {
    expect(() => validateModerationCommand({ accion: "RESTITUCION_REPORTES", versionEsperada: 2, motivo })).toThrow();
  });
  it("nunca admite activar ocultamiento automático desde el contrato ADMIN", () => {
    expect(() => validateModerationCommand({ accion: "OCULTAMIENTO_REPORTES", versionEsperada: 2, motivo: "Inventado" })).toThrow();
  });
  it.each(["true", "false"])("filtra ocultamiento preventivo %s sin coerción truthy", value => {
    expect(validateReporteQuery({ ocultoReportes: value })).toEqual({ page: 1, pageSize: 9, ocultoReportes: value === "true" });
  });
  it.each(["1", "0", "TRUE", ["true"], null])("rechaza filtro ambiguo %j", ocultoReportes => {
    expect(() => validateReporteQuery({ ocultoReportes })).toThrow();
  });
});

describe("T5: límites de la decisión preventiva", () => {
  const row: FeedbackModerationRecord = { autorId: "autor", deletedAt: null, estadoModeracion: "APROBADO", versionModeracion: 1,
    requiereRevisionHumana: false, motivoRechazo: null, ocultoAutor: false, ocultoAdministracion: false, ocultoReportes: false };
  const actor = { id: "denunciante", role: "USER" as const };
  const admin = { id: "admin", role: "ADMIN" as const };
  it.each([undefined, -1, 1.5, Number.NaN])("no decide usando conteo inválido %j", count => {
    expect(() => transitionFeedbackModeration(row, actor, { accion: "OCULTAMIENTO_REPORTES", versionEsperada: 1, motivo: "Umbral" }, false, count)).toThrow();
  });
  it.each([0, 1])("no oculta con %i denunciantes abiertos", count => {
    expect(() => transitionFeedbackModeration(row, actor, { accion: "OCULTAMIENTO_REPORTES", versionEsperada: 1, motivo: "Umbral" }, false, count)).toThrow();
  });
  it("rechaza autor como disparador aunque indique el conteo correcto", () => {
    expect(() => transitionFeedbackModeration(row, { id: row.autorId, role: "USER" }, { accion: "OCULTAMIENTO_REPORTES", versionEsperada: 1, motivo: "Umbral" }, false, 3)).toThrow();
  });
  it("dos denunciantes activan ocultamiento y bloquean restitución hasta reducir el conteo", () => {
    const hidden = transitionFeedbackModeration(row, actor, { accion: "OCULTAMIENTO_REPORTES", versionEsperada: 1, motivo: "Umbral" }, false, 2).state;
    expect(hidden).toMatchObject({ ocultoReportes: true, estadoModeracion: "APROBADO", versionModeracion: 2 });
    expect(() => transitionFeedbackModeration({ ...row, ...hidden }, admin, { accion: "RESTITUCION_REPORTES", versionEsperada: 2, motivo: "Revisado" }, false, 2)).toThrow();
    expect(transitionFeedbackModeration({ ...row, ...hidden }, admin, { accion: "RESTITUCION_REPORTES", versionEsperada: 2, motivo: "Revisado" }, false, 1).state.ocultoReportes).toBe(false);
  });
  it("restitución interna sigue requiriendo ADMIN", () => {
    expect(() => transitionFeedbackModeration({ ...row, ocultoReportes: true }, actor, { accion: "RESTITUCION_REPORTES", versionEsperada: 1, motivo: "Revisado" }, false, 2)).toThrow();
  });
  it("no desborda la versión PostgreSQL al activar el umbral", () => {
    expect(() => transitionFeedbackModeration({ ...row, versionModeracion: 2_147_483_647 }, actor, { accion: "OCULTAMIENTO_REPORTES", versionEsperada: 2_147_483_647, motivo: "Umbral" }, false, 3)).toThrow();
  });
  it("restitución de causa nunca aprueba un rechazo ni borra antecedente u otras causas", () => {
    const rejected: FeedbackModerationRecord = { ...row, estadoModeracion: "RECHAZADO", requiereRevisionHumana: true, motivoRechazo: "Formal", ocultoReportes: true, ocultoAutor: true, ocultoAdministracion: true };
    expect(transitionFeedbackModeration(rejected, admin, { accion: "RESTITUCION_REPORTES", versionEsperada: 1, motivo: "Revisado" }, false, 1).state)
      .toMatchObject({ estadoModeracion: "RECHAZADO", requiereRevisionHumana: true, motivoRechazo: "Formal", ocultoAutor: true, ocultoAdministracion: true, ocultoReportes: false, versionModeracion: 2 });
  });
});
