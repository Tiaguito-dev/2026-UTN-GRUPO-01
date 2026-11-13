// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MateriasList } from "@/components/academic/MateriasList";
import { MateriaDetail } from "@/components/academic/MateriaDetail";
import { listarMaterias, obtenerMateria } from "@/services/materias";

vi.mock("next/link", () => import("./support/next-link"));
const navigation = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(navigation.query), useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => false }));
vi.mock("@/services/materias", () => ({ listarMaterias: vi.fn(), obtenerMateria: vi.fn() }));
vi.mock("@/components/academic/ComisionesMateria", () => ({ ComisionesMateria: () => <div>Comisiones existentes</div> }));
const materia = { id: "m1", nombre: "Álgebra", carreras: [{ carrera: "S" as const, anioCarrera: "2" as const, nivelElectiva: null }], createdAt: "2026-01-01", deletedAt: null };
beforeEach(() => { vi.clearAllMocks(); navigation.query = "carrera=S&anioCarrera=2&page=2&q=Álgebra"; });
afterEach(cleanup);

describe("Valoración visible de materias", () => {
  it.each([
    [{ promedio: 4.3, cantidad: 12 }, "4,3 de 5 estrellas", "12 valoraciones"],
    [{ promedio: 4, cantidad: 1 }, "4,0 de 5 estrellas", "1 valoración"],
    [{ promedio: 1, cantidad: 2 }, "1,0 de 5 estrellas", "2 valoraciones"],
    [{ promedio: 5, cantidad: 2 }, "5,0 de 5 estrellas", "2 valoraciones"],
    [{ promedio: null, cantidad: 0 }, "Sin valoraciones", null],
  ] as const)("listado y detalle presentan %j igual y sin peticiones adicionales", async (valoracion, average, count) => {
    const item = { ...materia, valoracion };
    vi.mocked(listarMaterias).mockResolvedValue({ items: [item], total: 20, page: 2, pageSize: 9 });
    vi.mocked(obtenerMateria).mockResolvedValue(item);
    const view = render(<MateriasList />);
    expect(await screen.findByText(average)).toBeTruthy();
    if (count) expect(screen.getByText(count)).toBeTruthy();
    const link = screen.getByRole("link", { name: /Álgebra/ });
    expect(link.getAttribute("href")).toContain("listadoPage=2");
    expect(link.getAttribute("href")).toContain("carrera=S");
    expect(listarMaterias).toHaveBeenCalledTimes(1);
    expect(obtenerMateria).not.toHaveBeenCalled();
    view.unmount();
    render(<MateriaDetail materiaId="m1" />);
    expect(await screen.findByText(average)).toBeTruthy();
    if (count) expect(screen.getByText(count)).toBeTruthy();
    expect(screen.getByText("Comisiones existentes")).toBeTruthy();
    expect(obtenerMateria).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/usuarioId|autorId/)).toBeNull();
  });
  it("una materia compartida conserva el resumen al proyectarse en distintos años", async () => {
    navigation.query = "";
    const item = { ...materia, carreras: [
      { carrera: "S" as const, anioCarrera: "2" as const, nivelElectiva: null },
      { carrera: "S" as const, anioCarrera: "3" as const, nivelElectiva: null },
      { carrera: "Q" as const, anioCarrera: "2" as const, nivelElectiva: null },
    ], valoracion: { promedio: 4.3, cantidad: 12 } };
    vi.mocked(listarMaterias).mockResolvedValue({ items: [item], total: 1, page: 2, pageSize: 9 });
    render(<MateriasList />);
    expect(await screen.findAllByText("4,3 de 5 estrellas")).toHaveLength(2);
    expect(screen.getAllByText("12 valoraciones")).toHaveLength(2);
    expect(listarMaterias).toHaveBeenCalledTimes(1);
  });
});
