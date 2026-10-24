import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as front from "../src/validations/academic";
// The real backend validators, imported by relative path (TASK-031 decision 3): the name limits
// live inline in each one, so testing them, not `nombreSchema` alone, catches a one-sided change.
import { materiaFields } from "../../back/src/academic/application/materia-input.js";
import { validateCrearProfesorInput } from "../../back/src/academic/application/crear-profesor-input.js";
import { validateCrearComisionInput } from "../../back/src/academic/application/crear-comision-input.js";
import { ANIO_MINIMO, anioMaximo, validateCrearCursadaInput } from "../../back/src/academic/application/crear-cursada-input.js";

const UUID = "00000000-0000-4000-8000-000000000000";
function accepts(validate: () => unknown): boolean {
  try { validate(); return true; } catch { return false; }
}

const nombres = [
  { entidad: "materia", max: front.MAX_NOMBRE_MATERIA, back: (nombre: string) => materiaFields.nombre.safeParse(nombre).success },
  { entidad: "profesor", max: front.MAX_NOMBRE_PROFESOR, back: (nombre: string) => accepts(() => validateCrearProfesorInput({ nombreCompleto: nombre })) },
  { entidad: "comisión", max: front.MAX_NOMBRE_COMISION, back: (nombre: string) => accepts(() => validateCrearComisionInput({ cursadaId: UUID, nombre })) },
];
function casosDeNombre(max: number): [string, string][] {
  return [
    ["vacío", ""],
    ["solo espacios", "   "],
    ["en el límite", "a".repeat(max)],
    ["uno más", "a".repeat(max + 1)],
    ["en el límite con espacios alrededor", `  ${"a".repeat(max)}  `],
    ["emoji en el límite (puntos de código)", "😀".repeat(max)],
    ["emoji uno más", "😀".repeat(max + 1)],
    ["C0 (NUL)", "a\u0000b"],
    ["C0 (salto de línea final)", "a\n"],
    ["DEL", "a\u007fb"],
    ["C1 inicio", "a\u0080b"],
    ["C1 fin", "a\u009fb"],
    ["NBSP, justo fuera de C1", "a b"],
  ];
}

describe.each(nombres)("Paridad front/back: nombre de $entidad", ({ max, back }) => {
  it.each(casosDeNombre(max))("%s", (_caso, nombre) => {
    expect(front.validateNombre(nombre, max) === undefined, "el front y el back deben coincidir").toBe(back(nombre));
  });
});

describe("Paridad front/back: año de la cursada", () => {
  // `anioMaximo()` depends on today on both sides: freeze the date (TASK-031 risk 2).
  beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-06-15T12:00:00Z")); });
  afterAll(() => { vi.useRealTimers(); });
  it("acepta y rechaza los mismos años alrededor de los límites de los dos lados", () => {
    const bordes = [ANIO_MINIMO, front.ANIO_MINIMO, anioMaximo(), front.anioMaximo()];
    for (const anio of new Set(bordes.flatMap((borde) => [borde - 1, borde, borde + 1]))) {
      const backAcepta = accepts(() => validateCrearCursadaInput({ materiaId: UUID, profesorId: UUID, anio, cuatrimestre: "PRIMERO" }));
      expect(front.validateAnio(String(anio)) === undefined, `año ${anio}`).toBe(backAcepta);
    }
  });
});
