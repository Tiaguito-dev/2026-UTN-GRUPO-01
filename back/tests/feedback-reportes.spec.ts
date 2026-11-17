import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { validateCreateFeedbackReporte, validateReporteQuery, validateResolveFeedbackReporte } from "../src/reviews/application/feedback-reporte-input.js";
import { FeedbackReporteService } from "../src/reviews/application/feedback-reporte.service.js";
import type { FeedbackReporteRepository } from "../src/reviews/application/ports/feedback-reporte.repository.js";

describe("T4: contratos estrictos de reportes", () => {
  it.each(["INSULTOS_ACOSO", "AMENAZAS_INTIMIDACION", "DISCRIMINACION", "DATOS_PERSONALES", "SPAM", "OTRO"])("admite motivo %s y normaliza contexto", motivo => {
    expect(validateCreateFeedbackReporte({ motivo, descripcion: "  Contexto relevante  " })).toEqual({ motivo, descripcion: "Contexto relevante" });
  });
  it.each([undefined, "", "INVALIDO", "spam", null, 1])("rechaza motivo inválido %j", motivo => {
    expect(() => validateCreateFeedbackReporte({ motivo })).toThrow();
  });
  it.each(["x".repeat(1001), "Contexto\u0000", 4, null])("rechaza descripción inválida %j", descripcion => {
    expect(() => validateCreateFeedbackReporte({ motivo: "SPAM", descripcion })).toThrow();
  });
  it("admite descripción opcional y límite exacto", () => {
    expect(validateCreateFeedbackReporte({ motivo: "OTRO" })).toMatchObject({ motivo: "OTRO" });
    expect(validateCreateFeedbackReporte({ motivo: "OTRO", descripcion: "x".repeat(1000) }).descripcion).toHaveLength(1000);
  });
  it.each([{ denuncianteId: randomUUID() }, { usuarioId: randomUUID() }, { feedbackId: randomUUID() }, { versionReportada: 2 }, { estado: "RESUELTO" }, { administradorId: randomUUID() }, { justificacion: "Inventada" }, { resolvedAt: new Date().toISOString() }, { historialId: randomUUID() }])("impide inyección de campos %j", extra => {
    expect(() => validateCreateFeedbackReporte({ motivo: "SPAM", ...extra })).toThrow();
  });
  it("pagina nueve y admite filtros de administración", () => {
    expect(validateReporteQuery({})).toEqual({ page: 1, pageSize: 9 });
    const feedbackId = randomUUID();
    expect(validateReporteQuery({ page: "2", pageSize: "3", estado: "ABIERTO", motivo: "SPAM", feedbackId })).toEqual({ page: 2, pageSize: 3, estado: "ABIERTO", motivo: "SPAM", feedbackId });
  });
  it.each([{ pageSize: "10" }, { page: "0" }, { estado: "PENDIENTE" }, { motivo: "INVALIDO" }, { feedbackId: "invalido" }, { estado: ["ABIERTO", "RESUELTO"] }, { denuncianteId: randomUUID() }])("rechaza consulta inválida %j", query => {
    expect(() => validateReporteQuery(query)).toThrow();
  });
  it.each(["RESUELTO", "DESESTIMADO"])("admite cierre %s justificado", estado => {
    expect(validateResolveFeedbackReporte({ estado, motivo: "  Revisión humana  " })).toEqual({ estado, motivo: "Revisión humana" });
  });
  it.each([undefined, "", " ", "x".repeat(1001), "Motivo\ninválido", "Motivo\u0000"])("exige motivo administrativo válido %j", motivo => {
    expect(() => validateResolveFeedbackReporte({ estado: "RESUELTO", motivo })).toThrow();
  });
  it.each(["ABIERTO", "PENDIENTE", "APROBADO", "ELIMINADO"])("impide transición arbitraria %s", estado => {
    expect(() => validateResolveFeedbackReporte({ estado, motivo: "Revisado" })).toThrow();
  });
  it.each([{ administradorId: randomUUID() }, { resolvedAt: new Date().toISOString() }, { ocultoReportes: true }, { estadoModeracion: "RECHAZADO" }])("cierre rechaza campos ajenos %j", extra => {
    expect(() => validateResolveFeedbackReporte({ estado: "RESUELTO", motivo: "Revisado", ...extra })).toThrow();
  });
});

describe("T4: service de reportes", () => {
  function fixture() {
    const repository = { create: vi.fn(), list: vi.fn(), get: vi.fn(), resolve: vi.fn() };
    return { repository, service: new FeedbackReporteService(repository as unknown as FeedbackReporteRepository) };
  }
  it("valida identidad, destino y payload antes de crear", () => {
    const { repository, service } = fixture();
    expect(() => service.create("invalido", randomUUID(), { motivo: "SPAM" })).toThrow();
    expect(() => service.create(randomUUID(), "invalido", { motivo: "SPAM" })).toThrow();
    expect(() => service.create(randomUUID(), randomUUID(), { motivo: "SPAM", versionReportada: 4 })).toThrow();
    expect(repository.create).not.toHaveBeenCalled();
  });
  it("propaga exclusivamente datos validados y normalizados", () => {
    const { repository, service } = fixture(); const id = randomUUID(); const viewer = randomUUID();
    service.create(id, viewer, { motivo: "OTRO", descripcion: "  Contexto  " });
    expect(repository.create).toHaveBeenCalledWith(id, viewer, { motivo: "OTRO", descripcion: "Contexto" });
  });
  it("valida consulta administrativa y detalle con tres resoluciones", () => {
    const { repository, service } = fixture(); const id = randomUUID();
    service.list({ estado: "ABIERTO" }); service.get(id, {});
    expect(repository.list).toHaveBeenCalledWith({ page: 1, pageSize: 9, estado: "ABIERTO" });
    expect(repository.get).toHaveBeenCalledWith(id, { page: 1, pageSize: 3 });
    expect(() => service.get(id, { pageSize: 4 })).toThrow();
    expect(() => service.get("invalido", {})).toThrow();
  });
  it("exige ADMIN y UUID válidos antes de resolver", () => {
    const { repository, service } = fixture(); const id = randomUUID();
    expect(() => service.resolve(id, { id: randomUUID(), role: "USER" }, { estado: "RESUELTO", motivo: "Revisado" })).toThrow();
    expect(() => service.resolve(id, { id: "invalido", role: "ADMIN" }, { estado: "RESUELTO", motivo: "Revisado" })).toThrow();
    expect(() => service.resolve(id, { id: randomUUID(), role: "ADMIN" }, { estado: "RESUELTO" })).toThrow();
    expect(repository.resolve).not.toHaveBeenCalled();
  });
  it("propaga cierre justificado con actor autenticado", () => {
    const { repository, service } = fixture(); const id = randomUUID(); const actor = { id: randomUUID(), role: "ADMIN" as const };
    service.resolve(id, actor, { estado: "DESESTIMADO", motivo: "  Revisión humana  " });
    expect(repository.resolve).toHaveBeenCalledWith(id, actor, { estado: "DESESTIMADO", motivo: "Revisión humana" });
  });
});
