// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { AltaCursada } from "@/components/admin/AltaCursada";
import { AltaComision } from "@/components/admin/AltaComision";
import { listarCursadasPorMateria, listarMaterias, obtenerCursada } from "@/services/academic";

const { location } = vi.hoisted(() => ({ location: { search: "" } }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(location.search),
}));
vi.mock("@/services/academic", () => ({
  listarMaterias: vi.fn(),
  listarCursadasPorMateria: vi.fn(),
  obtenerCursada: vi.fn(),
  crearCursada: vi.fn(),
  crearComision: vi.fn(),
}));

afterEach(() => { cleanup(); location.search = ""; });

beforeEach(() => {
  vi.mocked(listarMaterias).mockResolvedValue({
    items: [
      { id: "m1", nombre: "Álgebra", carreras: [{ carrera: "S", anioCarrera: "1", nivelElectiva: null }], createdAt: "", deletedAt: null },
      { id: "m2", nombre: "Física", carreras: [{ carrera: "Q", anioCarrera: "1", nivelElectiva: null }], createdAt: "", deletedAt: null },
    ],
    total: 2,
    page: 1,
    pageSize: 100,
  });
  vi.mocked(listarCursadasPorMateria).mockResolvedValue({
    items: [
      { id: "c1", anio: 2026, comisiones: 0, profesores: 0, carreras: [] },
      { id: "c2", anio: 2026, comisiones: 0, profesores: 0, carreras: [] },
    ],
    total: 2,
    page: 1,
    pageSize: 100,
  });
  vi.mocked(obtenerCursada).mockResolvedValue({ id: "c2", anio: 2026, materia: { id: "m1", nombre: "Álgebra" } });
});

// TASK-043 decision 2: "Nueva cursada" / "Nueva comisión" from a detail navigate here with the parent preselected.
describe("Altas con el padre precargado por query (TASK-043)", () => {
  it("AltaCursada toma ?materiaId como valor inicial del select Materia", async () => {
    location.search = "materiaId=m2";
    render(<AltaCursada />);
    const materia = screen.getByLabelText("Materia") as HTMLSelectElement;
    await waitFor(() => expect(materia.value).toBe("m2"));
  });

  it("AltaComision toma ?cursadaId como cursada inicial y elige su materia", async () => {
    location.search = "cursadaId=c2";
    render(<AltaComision />);
    const materia = screen.getByLabelText("Materia") as HTMLSelectElement;
    await waitFor(() => expect(materia.value).toBe("m1"));
    const cursada = screen.getByLabelText("Cursada") as HTMLSelectElement;
    await waitFor(() => expect(cursada.value).toBe("c2"));
  });
});
