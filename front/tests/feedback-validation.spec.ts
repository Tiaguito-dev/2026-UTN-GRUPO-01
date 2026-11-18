import { describe, expect, it } from "vitest";
import { feedbackOriginParams, feedbackNavigation, feedbackDetalleHref, feedbackEdicionHref, feedbackSuccessHref, feedbackSuccessMessage, inicioFeedWindowKey, MAX_TEXTO_FEEDBACK, validarTextoFeedback, validarPuntuacionFeedback, diferenciasFeedback } from "../src/validations/feedback";
import { validateCreateFeedback } from "../../back/src/reviews/application/feedback-input.js";

describe("Feedback: validación y edición de diferencias", () => {
  it("solo presenta mensajes de navegación de la aplicación, sin payloads o errores técnicos", () => {
    const message = "La experiencia se guardó correctamente. Tu comentario está pendiente de revisión por el equipo administrativo.";
    expect(feedbackSuccessMessage(message)).toBe(message);
    for (const value of [JSON.stringify({ token: "secret" }), [message], "Error: PrismaClient at src/repository.ts:12", "Mensaje inventado", null]) expect(feedbackSuccessMessage(value)).toBeUndefined();
  });
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


describe("Inicio publication navigation", () => {
  const contexto = { comisionId: "co1", cursadaId: "cu1", materiaId: "m1", materiaNombre: "Álgebra", nombre: "S-21", anio: 2026, cuatrimestre: null };
  it("el origen Inicio utiliza su raíz real en vez de inventar un recorrido académico", () => {
    const navigation = feedbackNavigation(contexto, new URLSearchParams("origen=inicio"));
    expect(navigation.items).toEqual([{ label: "Inicio", href: "/home" }]);
    expect(navigation.back).toEqual({ label: "Inicio", href: "/home" });
    expect(feedbackEdicionHref("f1", new URLSearchParams("origen=inicio"))).toBe("/home/feedback/f1/editar?origen=inicio");
  });
  it("Mis experiencias conserva jerarquía propia, página y origen al editar", () => {
    const params = new URLSearchParams("origen=experiencias&experienciasSeccion=propias&experienciasPage=3");
    const navigation = feedbackNavigation(contexto, params);
    expect(navigation.items).toEqual([{ label: "Inicio", href: "/home" }, { label: "Experiencias", href: "/home/experiencias" }, { label: "Mis experiencias", href: "/home/experiencias?seccion=propias&page=3" }]);
    expect(navigation.back).toEqual({ label: "Mis experiencias", href: "/home/experiencias?seccion=propias&page=3" });
    expect(feedbackEdicionHref("f1", params)).toBe("/home/feedback/f1/editar?origen=experiencias&experienciasSeccion=propias&experienciasPage=3");
    expect(feedbackDetalleHref("f1", params)).toBe("/home/feedback/f1?origen=experiencias&experienciasSeccion=propias&experienciasPage=3");
  });
  it("el ingreso directo académico conserva materias, contexto y comisión reales", () => {
    const navigation = feedbackNavigation(contexto, new URLSearchParams("carrera=S&listadoPage=2&comisionesPage=3"));
    expect(navigation.items.map(item => item.label)).toEqual(["Materias", "Álgebra", "Comisión S-21"]);
    expect(navigation.items[0].href).toContain("page=2");
    expect(navigation.materiaHref).toContain("comisionesPage=3");
    expect(navigation.back.label).toBe("Comisión");
  });
  it("preserves only a recognized Inicio origin, never an arbitrary return URL", () => {
    const params = new URLSearchParams("origen=inicio&returnTo=https://evil.test");
    expect(feedbackOriginParams(params).get("origen")).toBe("inicio"); expect(feedbackOriginParams(params).has("returnTo")).toBe(false);
    expect(feedbackNavigation(null, params).back).toEqual({ href: "/home", label: "Inicio" });
    expect(feedbackNavigation(null, new URLSearchParams("origen=https://evil.test")).back.href).toBe("/home/materias");
  });
  it("generates a fresh Inicio window only for home publication returns", () => {
    const first = new URL(feedbackSuccessHref("/home", "Published"), "http://local"); const second = new URL(feedbackSuccessHref("/home", "Published"), "http://local");
    expect(first.searchParams.get("feedRefresh")).toBeTruthy(); expect(first.searchParams.get("feedRefresh")).not.toBe(second.searchParams.get("feedRefresh"));
    expect(new URL(feedbackSuccessHref("/home/experiencias?page=2", "Published"), "http://local").searchParams.has("feedRefresh")).toBe(false);
    expect(inicioFeedWindowKey(first.searchParams.get("feedRefresh"))).toBe(first.searchParams.get("feedRefresh"));
    expect(inicioFeedWindowKey(["unexpected"])).toBe("initial"); expect(inicioFeedWindowKey("https://evil.test")).toBe("initial");
  });
});
