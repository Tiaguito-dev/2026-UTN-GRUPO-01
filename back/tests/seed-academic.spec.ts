import { describe, expect, it } from "vitest";
import { MATERIAS } from "../src/academic/seed-academic-data.js";

describe("catálogo demo completo", () => {
  it.each(["S", "C", "Q", "I", "M"] as const)("cubre años, electivas y oferta de %s", (carrera) => {
    const materias = MATERIAS.filter((m) => m.carreras.some((c) => c.carrera === carrera));
    const asociaciones = materias.flatMap((m) => m.carreras.filter((c) => c.carrera === carrera));
    expect(new Set(asociaciones.map((c) => c.anioCarrera))).toEqual(new Set(["1", "2", "3", "4", "5", "ELECTIVA"]));
    expect(new Set(asociaciones.filter((c) => c.anioCarrera === "ELECTIVA").map((c) => c.nivelElectiva))).toEqual(new Set(["3", "4", "5"]));
    for (const materia of materias) {
      for (const anio of [2025, 2026]) {
        const oferta = materia.cursadas.filter((c) => c.anio === anio).flatMap((c) => c.comisiones).filter((c) => c.carrera === carrera);
        expect(oferta.length).toBeGreaterThan(0);
        expect(oferta.every((c) => c.profesores.length > 0)).toBe(true);
      }
    }
  });

  it("no repite identidades de materias, períodos o comisiones", () => {
    expect(new Set(MATERIAS.map((m) => m.nombre)).size).toBe(MATERIAS.length);
    for (const materia of MATERIAS) {
      expect(new Set(materia.cursadas.map((c) => `${c.anio}/${c.cuatrimestre}`)).size).toBe(materia.cursadas.length);
      for (const cursada of materia.cursadas) {
        expect(new Set(cursada.comisiones.map((c) => `${c.carrera}/${c.numero}`)).size).toBe(cursada.comisiones.length);
      }
    }
  });
});
