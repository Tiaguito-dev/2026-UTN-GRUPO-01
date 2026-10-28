import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateCrearMateriaInput } from "../src/academic/application/crear-materia-input.js";
import { validateActualizarMateriaInput } from "../src/academic/application/materia-input.js";
import { validateCrearCursadaInput } from "../src/academic/application/crear-cursada-input.js";

describe("Modalidad de materia y período real de cursada", () => {
  it.each(["ANUAL", "PRIMERO", "SEGUNDO"])("admite modalidad %s también en electivas", (modalidad) => {
    expect(validateCrearMateriaInput({ nombre: "Electiva", modalidad, carreras: [{ carrera: "S", anioCarrera: "ELECTIVA", nivelElectiva: "4" }] })).toMatchObject({ modalidad });
  });
  it("exige modalidad válida al crear y permite cambiarla independientemente de las carreras", () => {
    expect(() => validateCrearMateriaInput({ nombre: "Materia", carreras: [{ carrera: "S", anioCarrera: "1" }] })).toThrow();
    expect(() => validateCrearMateriaInput({ nombre: "Materia", modalidad: "SEMESTRAL", carreras: [{ carrera: "S", anioCarrera: "1" }] })).toThrow();
    expect(validateActualizarMateriaInput({ modalidad: "ANUAL" })).toEqual({ modalidad: "ANUAL" });
  });
  it("exige un período explícito y admite los tres períodos de desarrollo", () => {
    const input = { materiaId: randomUUID(), anio: 2026 };
    expect(() => validateCrearCursadaInput(input)).toThrow();
    for (const cuatrimestre of ["PRIMERO", "SEGUNDO", "ANUAL"]) {
      expect(validateCrearCursadaInput({ ...input, cuatrimestre })).toEqual({ ...input, cuatrimestre });
    }
  });
});
