import { describe, expect, it } from "vitest";
import { carreraLabel, carrerasResumenLabel, materiaAnioLabel } from "@/validations/materias";
import type { MateriaCarrera } from "@/types/materias";

const shared: MateriaCarrera[] = [
  { carrera: "S", anioCarrera: "1", nivelElectiva: null },
  { carrera: "I", anioCarrera: "2", nivelElectiva: null },
];

describe("Identificación académica de materia", () => {
  it("usa denominación formal y calcula Básica con las asociaciones completas", () => {
    expect(carreraLabel("S")).toBe("Ingeniería en Sistemas de Información");
    expect(carrerasResumenLabel(shared)).toBe("Básica");
    expect(carrerasResumenLabel([shared[0]])).toBe("Ingeniería en Sistemas de Información");
  });
  it("muestra el año de la carrera elegida o declara que depende de la carrera", () => {
    expect(materiaAnioLabel(shared, "S")).toBe("1.º año");
    expect(materiaAnioLabel(shared, "I")).toBe("2.º año");
    expect(materiaAnioLabel(shared)).toBe("Año según carrera");
    expect(materiaAnioLabel(shared, "Q")).toBe("Año según carrera");
  });
  it("sin carrera muestra el año común, conserva electiva y nivel y no elige la primera asociación", () => {
    const electives: MateriaCarrera[] = [
      { carrera: "S", anioCarrera: "ELECTIVA", nivelElectiva: "3" },
      { carrera: "I", anioCarrera: "ELECTIVA", nivelElectiva: "4" },
    ];
    expect(materiaAnioLabel(shared.map((row) => ({ ...row, anioCarrera: "2" })))).toBe("2.º año");
    expect(materiaAnioLabel(electives, "I")).toBe("Electiva · 4.º Nivel");
    expect(materiaAnioLabel(electives)).toBe("Electiva · Nivel según carrera");
    expect(materiaAnioLabel([])).toBe("Sin año asignado");
  });
});
