import { describe, expect, it } from "vitest";
import { adminCreationHref } from "@/validations/admin";

describe("Filtros tras una creación administrativa", () => {
  const materia = { nombre: "Análisis", carreras: [{ carrera: "S", anioCarrera: "3", nivelElectiva: null }] };
  it.each([
    ["q=algebra", materia, true],
    ["q=analisis&carrera=S&anioCarrera=3", materia, false],
    ["carrera=Q", materia, true],
    ["anioCarrera=ELECTIVA&nivelElectiva=4", materia, true],
    ["carrera=S&anioCarrera=3", { ...materia, carreras: [{ carrera: "S", anioCarrera: "2" }, { carrera: "Q", anioCarrera: "3" }] }, true],
  ] as const)("materia preserva %s y detecta visibilidad", (query, record, outside) => {
    const url = new URL(adminCreationHref(`/home/admin/materias?${query}&page=2`, "Creada.", record), "https://local.test");
    expect(url.searchParams.has("creationOutsideFilters")).toBe(outside);
    expect(url.searchParams.get("page")).toBe("2");
    for (const [key, value] of new URLSearchParams(query)) expect(url.searchParams.get(key)).toBe(value);
    expect(url.searchParams.get("successMessage")).toBe("Creada.");
  });
  it.each([
    [{ cursadaId: "c1", carrera: "S" }, false],
    [{ cursadaId: "c1", carrera: "Q" }, true],
    [{ cursadaId: "c2", carrera: "S" }, true],
  ])("comisión detecta cambios de carrera o período", (record, outside) => {
    const url = new URL(adminCreationHref("/home/admin/comisiones?materiaId=m1&cursadaId=c1&carrera=S", "Creada.", record), "https://local.test");
    expect(url.searchParams.has("creationOutsideFilters")).toBe(outside);
    expect(url.searchParams.get("cursadaId")).toBe("c1");
    expect(url.searchParams.get("carrera")).toBe("S");
  });
});
