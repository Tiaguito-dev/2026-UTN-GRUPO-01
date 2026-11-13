import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FeedbackInputError } from "../src/reviews/application/errors.js";
import {
  validateCreateFeedback,
  validateUpdateFeedback,
  validateFeedbackPagination,
  validateFeedbackId,
  validateGeneralFeedbackQuery,
} from "../src/reviews/application/feedback-input.js";

describe("Feedback: contrato de entrada", () => {
  it("valida carrera y materia opcionales sin admitir otros filtros", () => {
    const materiaId = randomUUID();
    expect(validateGeneralFeedbackQuery({ carrera: "S", materiaId, page: "2" })).toEqual({ page: 2, pageSize: 9, carrera: "S", materiaId });
    expect(validateGeneralFeedbackQuery({})).toEqual({ page: 1, pageSize: 9 });
    for (const query of [{ carrera: "X" }, { carrera: ["S", "I"] }, { materiaId: "no-uuid" }, { profesorId: materiaId }]) {
      expect(() => validateGeneralFeedbackQuery(query)).toThrow();
    }
  });
  it("recorta bordes y admite texto español, saltos de línea y tabulación", () => {
    expect(validateCreateFeedback({ texto: "  Explica bien.\n\tBuena comisión.  ", anonimo: true, puntuacion: 3 }))
      .toEqual({ texto: "Explica bien.\n\tBuena comisión.", anonimo: true, puntuacion: 3 });
  });
  it("cuenta puntos de código y permite exactamente 3000", () => {
    expect(validateCreateFeedback({ texto: "😀".repeat(3000), anonimo: false, puntuacion: 3 }).texto).toHaveLength(6000);
    expect(() => validateCreateFeedback({ texto: "😀".repeat(3001), anonimo: false, puntuacion: 3 })).toThrow();
  });
  it.each(["", "   ", "Texto\u0000oculto", "Texto\u0007oculto", "Texto\u007foculto"])("rechaza texto vacío o con controles: %j", (texto) => {
    expect(() => validateCreateFeedback({ texto, anonimo: false, puntuacion: 3 })).toThrow();
  });
  it.each([
    { texto: "Bien", anonimo: "false", puntuacion: 3 },
    { texto: "Bien", anonimo: false, autorId: randomUUID(), puntuacion: 3 },
    { texto: "Bien", anonimo: false, profesorId: "inventado", puntuacion: 3 },
    { texto: "Bien", puntuacion: 3 },
  ])("rechaza tipos y campos no permitidos", (body) => {
    expect(() => validateCreateFeedback(body)).toThrow();
  });
  it("permite docente UUID o referencia general null", () => {
    const profesorId = randomUUID();
    expect(validateCreateFeedback({ texto: "Bien", anonimo: false, profesorId, puntuacion: 3 }).profesorId).toBe(profesorId);
    expect(validateCreateFeedback({ texto: "Bien", anonimo: false, profesorId: null, puntuacion: 3 }).profesorId).toBeNull();
  });
  it("edición permite texto y anonimato sin estrellas, sin cambiar el docente", () => {
    expect(validateUpdateFeedback({ texto: "  Actualizado  " })).toEqual({ texto: "Actualizado" });
    expect(validateUpdateFeedback({ anonimo: false })).toEqual({ anonimo: false });
    expect(() => validateUpdateFeedback({ profesorId: randomUUID() })).toThrow();
    expect(() => validateUpdateFeedback({ autorId: randomUUID() })).toThrow();
  });
  it.each([1, 2, 3, 4, 5])("creación acepta y conserva puntuación entera %i", (puntuacion) => {
    expect(validateCreateFeedback({ texto: "Bien", anonimo: false, puntuacion }))
      .toEqual({ texto: "Bien", anonimo: false, puntuacion });
  });
  it("creación exige puntuación aunque el resto del comentario sea válido", () => {
    expect(() => validateCreateFeedback({ texto: "Bien", anonimo: false })).toThrow(FeedbackInputError);
  });
  it.each([
    { puntuacion: undefined }, { puntuacion: null }, { puntuacion: 0 }, { puntuacion: 6 },
    { puntuacion: 2.5 }, { puntuacion: "3" }, { puntuacion: true }, { puntuacion: false },
    { puntuacion: NaN }, { puntuacion: Infinity }, { puntuacion: [] }, { puntuacion: {} },
  ])("creación rechaza puntuación inválida: %j", ({ puntuacion }) => {
    expect(() => validateCreateFeedback({ texto: "Bien", anonimo: false, puntuacion })).toThrow(FeedbackInputError);
  });
  it.each([1, 2, 3, 4, 5])("edición acepta puntuación explícita %i sin exigir texto", (puntuacion) => {
    expect(validateUpdateFeedback({ puntuacion })).toEqual({ puntuacion });
    expect(validateUpdateFeedback({ texto: "  Actualizado  ", anonimo: true, puntuacion }))
      .toEqual({ texto: "Actualizado", anonimo: true, puntuacion });
  });
  it("edición de un histórico puede omitir estrellas sin asignar una puntuación por defecto", () => {
    const result = validateUpdateFeedback({ texto: "  Histórico actualizado  ", anonimo: true });
    expect(result).toEqual({ texto: "Histórico actualizado", anonimo: true });
    expect(result).not.toHaveProperty("puntuacion");
  });
  it.each([
    { puntuacion: null }, { puntuacion: 0 }, { puntuacion: 6 }, { puntuacion: 2.5 },
    { puntuacion: "3" }, { puntuacion: true }, { puntuacion: false },
    { puntuacion: NaN }, { puntuacion: Infinity }, { puntuacion: [] }, { puntuacion: {} },
  ])("edición rechaza quitar estrellas o enviar puntuación inválida: %j", ({ puntuacion }) => {
    expect(() => validateUpdateFeedback({ texto: "Actualizado", puntuacion })).toThrow(FeedbackInputError);
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
