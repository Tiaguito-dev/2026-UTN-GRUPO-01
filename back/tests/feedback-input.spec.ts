import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  validateCreateFeedback,
  validateUpdateFeedback,
  validateFeedbackPagination,
  validateFeedbackId,
} from "../src/reviews/application/feedback-input.js";

describe("Feedback: contrato de entrada", () => {
  it("recorta bordes y admite texto español, saltos de línea y tabulación", () => {
    expect(validateCreateFeedback({ texto: "  Explica bien.\n\tBuena comisión.  ", anonimo: true }))
      .toEqual({ texto: "Explica bien.\n\tBuena comisión.", anonimo: true });
  });
  it("cuenta puntos de código y permite exactamente 3000", () => {
    expect(validateCreateFeedback({ texto: "😀".repeat(3000), anonimo: false }).texto).toHaveLength(6000);
    expect(() => validateCreateFeedback({ texto: "😀".repeat(3001), anonimo: false })).toThrow();
  });
  it.each(["", "   ", "Texto\u0000oculto", "Texto\u0007oculto", "Texto\u007foculto"])("rechaza texto vacío o con controles: %j", (texto) => {
    expect(() => validateCreateFeedback({ texto, anonimo: false })).toThrow();
  });
  it.each([
    { texto: "Bien", anonimo: "false" },
    { texto: "Bien", anonimo: false, autorId: randomUUID() },
    { texto: "Bien", anonimo: false, profesorId: "inventado" },
    { texto: "Bien" },
  ])("rechaza tipos y campos no permitidos", (body) => {
    expect(() => validateCreateFeedback(body)).toThrow();
  });
  it("permite docente UUID o referencia general null", () => {
    const profesorId = randomUUID();
    expect(validateCreateFeedback({ texto: "Bien", anonimo: false, profesorId }).profesorId).toBe(profesorId);
    expect(validateCreateFeedback({ texto: "Bien", anonimo: false, profesorId: null }).profesorId).toBeNull();
  });
  it("edición solo admite texto y anonimato, sin cambiar el docente", () => {
    expect(validateUpdateFeedback({ texto: "  Actualizado  " })).toEqual({ texto: "Actualizado" });
    expect(validateUpdateFeedback({ anonimo: false })).toEqual({ anonimo: false });
    expect(() => validateUpdateFeedback({ profesorId: randomUUID() })).toThrow();
    expect(() => validateUpdateFeedback({ autorId: randomUUID() })).toThrow();
  });
  it("paginar limita listados a nueve e historial a tres", () => {
    expect(validateFeedbackPagination({})).toEqual({ page: 1, pageSize: 9 });
    expect(validateFeedbackPagination({}, true)).toEqual({ page: 1, pageSize: 3 });
    expect(validateFeedbackPagination({ page: "2", pageSize: "3" })).toEqual({ page: 2, pageSize: 3 });
    expect(() => validateFeedbackPagination({ pageSize: "10" })).toThrow();
    expect(() => validateFeedbackPagination({ pageSize: "4" }, true)).toThrow();
    expect(() => validateFeedbackPagination({ page: ["1", "2"] })).toThrow();
  });
  it("valida UUID completo", () => {
    const id = randomUUID();
    expect(validateFeedbackId(id)).toBe(id);
    expect(() => validateFeedbackId(`${id}/otro`)).toThrow();
  });
});
