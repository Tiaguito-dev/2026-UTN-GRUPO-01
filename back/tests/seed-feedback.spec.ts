import { describe, expect, it } from "vitest";
import { ESTUDIANTES_DEMO, generarExperiencias, idDeterministico, type ComisionSemilla } from "../src/reviews/seed-feedback-data.js";

const comision = (n: number, profesores = 2): ComisionSemilla => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, nombre: `S-${n}`, materiaId: `m${n % 3}`, materiaNombre: "Materia",
  cursadaId: `c${n}`, anio: 2026, cuatrimestre: "PRIMERO",
  profesores: Array.from({ length: profesores }, (_, i) => ({ id: `p${(n + i) % 7}`, nombreCompleto: `Profesor ${i}`, cargo: "TITULAR" as const })),
});

describe("seed de experiencias de demostración", () => {
  const comisiones = Array.from({ length: 60 }, (_, n) => comision(n, n % 5 === 0 ? 0 : 2));
  const experiencias = generarExperiencias(comisiones);

  it("cubre todas las comisiones, con 2 a 6 experiencias de estudiantes distintos", () => {
    for (const c of comisiones) {
      const propias = experiencias.filter((e) => e.comision.id === c.id);
      expect(propias.length).toBeGreaterThanOrEqual(2);
      expect(propias.length).toBeLessThanOrEqual(6);
      expect(new Set(propias.map((e) => e.autorIndex)).size).toBe(propias.length);
    }
  });

  it("respeta los contratos de Feedback: puntuación 1–5, texto válido y docente de la propia comisión", () => {
    for (const e of experiencias) {
      expect([1, 2, 3, 4, 5]).toContain(e.puntuacion);
      expect(e.texto.length).toBeGreaterThan(0);
      expect(e.texto.length).toBeLessThanOrEqual(3000);
      expect(e.autorIndex).toBeGreaterThanOrEqual(1);
      expect(e.autorIndex).toBeLessThanOrEqual(ESTUDIANTES_DEMO);
      if (e.profesor) expect(e.comision.profesores).toContainEqual(e.profesor);
    }
    expect(experiencias.filter((e) => e.comision.profesores.length === 0).every((e) => e.profesor === null)).toBe(true);
  });

  it("es determinista, con ids estables, y da un ranking variado", () => {
    expect(generarExperiencias(comisiones)).toEqual(experiencias);
    expect(new Set(experiencias.map((e) => e.id)).size).toBe(experiencias.length);
    expect(idDeterministico("a", "b")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(new Set(experiencias.map((e) => e.puntuacion)).size).toBeGreaterThanOrEqual(4);
  });
});
