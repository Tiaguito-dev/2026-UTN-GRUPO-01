import { describe, expect, it } from "vitest";
import { MAX_TEXTO_FEEDBACK, validarTextoFeedback, diferenciasFeedback } from "../src/validations/feedback";
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
    const original = { texto: "Buena comisión", anonimo: true };
    expect(diferenciasFeedback(original, { texto: "  Buena comisión  ", anonimo: true })).toEqual({});
  });
  it("solo envía diferencias reales de texto y anonimato", () => {
    const original = { texto: "Buena comisión", anonimo: true };
    expect(diferenciasFeedback(original, { texto: "  Más ejemplos  ", anonimo: true })).toEqual({ texto: "Más ejemplos" });
    expect(diferenciasFeedback(original, { texto: "Buena comisión", anonimo: false })).toEqual({ anonimo: false });
  });
  it("comparte con backend las reglas de controles, saltos y límites Unicode", () => {
    const cases = [
      "", "  ", "Explica bien", "  Explica bien  ", "Dos\nlíneas", "Dos\r\nlíneas", "Una\ttabulación",
      "Texto\u0000", "\u000bTexto", "Texto\u000c", "Texto\u007f", "Texto\u0080", "Texto\u009f",
      "😀".repeat(3000), "😀".repeat(3001),
    ];
    for (const texto of cases) {
      let backendAccepts = true;
      try { validateCreateFeedback({ texto, anonimo: true }); } catch { backendAccepts = false; }
      expect(validarTextoFeedback(texto) === "", JSON.stringify(texto.slice(0, 20))).toBe(backendAccepts);
    }
  });
});
