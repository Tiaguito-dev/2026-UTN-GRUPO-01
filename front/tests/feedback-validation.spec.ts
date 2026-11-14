import { describe, expect, it } from "vitest";
import { MAX_TEXTO_FEEDBACK, validarTextoFeedback, validarPuntuacionFeedback, diferenciasFeedback } from "../src/validations/feedback";
import { validateCreateFeedback } from "../../back/src/reviews/application/feedback-input.js";

describe("Feedback: validación y edición de diferencias", () => {
  it("permite texto español con saltos de línea y tabulaciones", () => {
    expect(validarTextoFeedback("  Buena comisión.\n\tExplica bien.  ")).toBe("");
  });
  it("rechaza vacío, controles y más de 3000 puntos de código", () => {
    expect(MAX_TEXTO_FEEDBACK).toBe(3000);
    for (const texto of ["", " \n ", "Texto\u0000", "Texto\u007f", "😀".repeat(3001)]) {
      expect(validarTextoFeedback(texto)).not.toBe("");
    }
    expect(validarTextoFeedback("😀".repeat(3000))).toBe("");
  });
  it("una edición equivalente no produce campos para enviar", () => {
    const original = { texto: "Buena comisión", anonimo: true, puntuacion: 3 };
    expect(diferenciasFeedback(original, { texto: "  Buena comisión  ", anonimo: true, puntuacion: 3 })).toEqual({});
  });
  it("solo envía diferencias reales de texto y anonimato", () => {
    const original = { texto: "Buena comisión", anonimo: true, puntuacion: 3 };
    expect(diferenciasFeedback(original, { texto: "  Más ejemplos  ", anonimo: true, puntuacion: 3 })).toEqual({ texto: "Más ejemplos" });
    expect(diferenciasFeedback(original, { texto: "Buena comisión", anonimo: false, puntuacion: 3 })).toEqual({ anonimo: false });
  });
  it("comparte con backend las reglas de controles, saltos y límites Unicode", () => {
    const cases = [
      "", "  ", "Explica bien", "  Explica bien  ", "Dos\nlíneas", "Dos\r\nlíneas", "Una\ttabulación",
      "Texto\u0000", "\u000bTexto", "Texto\u000c", "Texto\u007f", "Texto\u0080", "Texto\u009f",
      "😀".repeat(3000), "😀".repeat(3001),
    ];
    for (const texto of cases) {
      let backendAccepts = true;
      // Puntuación válida para seguir aislando las reglas originales de texto.
      try { validateCreateFeedback({ texto, anonimo: true, puntuacion: 3 }); } catch { backendAccepts = false; }
      expect(validarTextoFeedback(texto) === "", JSON.stringify(texto.slice(0, 20))).toBe(backendAccepts);
    }
  });
  it.each(["1", "2", "3", "4", "5"])("acepta selección FormData %s sin convertir tipos arbitrarios", value => {
    expect(validarPuntuacionFeedback(value)).toBe("");
  });
  it.each(["", "0", "6", "2.5", "3x", "1.0", " 3 ", "true", "false", "NaN", "Infinity"])("rechaza selección inválida %j", value => {
    expect(validarPuntuacionFeedback(value)).not.toBe("");
  });
  it("solo permite selección vacía para históricos sin puntuación", () => {
    expect(validarPuntuacionFeedback("", false)).toBe("");
    expect(validarPuntuacionFeedback("0", false)).not.toBe("");
  });
  it("solo añade estrellas al PATCH cuando difieren y no envía null", () => {
    const original = { texto: "Bien", anonimo: true, puntuacion: 3 };
    expect(diferenciasFeedback(original, { ...original, puntuacion: 5 })).toEqual({ puntuacion: 5 });
    expect(diferenciasFeedback(original, { ...original, puntuacion: null })).toEqual({});
    const historical = { ...original, puntuacion: null };
    expect(diferenciasFeedback(historical, historical)).toEqual({});
    expect(diferenciasFeedback(historical, { ...historical, puntuacion: 1 })).toEqual({ puntuacion: 1 });
  });
});
