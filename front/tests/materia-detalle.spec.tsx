// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MateriaDetail } from "@/components/academic/MateriaDetail";
const { state } = vi.hoisted(() => ({ state: { role: "USER", deletedAt: null as string | null, detail: null as null | { materia: null; error: string; notFound: boolean; retry: () => void } } }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("anioCarrera=ELECTIVA&listadoPage=2&q=Plan&nivelElectiva=4") }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { role: state.role } }) }));
vi.mock("@/hooks/useMateria", () => ({ useMateria: () => state.detail ?? ({ materia: { id: "m1", nombre: "Materia", anioCarrera: "ELECTIVA", nivelElectiva: "4", createdAt: "2026-01-01", deletedAt: state.deletedAt }, error: "", retry: vi.fn() }) }));
vi.mock("@/hooks/usePaginatedFetch", () => ({ usePaginatedFetch: () => ({ state: { status: "ready", data: { items: [], total: 0, page: 1, pageSize: 3 } }, retry: vi.fn() }) }));
vi.mock("@/components/academic/CursadasList", () => ({ CursadasList: ({ materiasHref }: { materiasHref: string }) => <a href={materiasHref}>Materias de la cursada</a> }));
afterEach(() => { cleanup(); state.role = "USER"; state.deletedAt = null; state.detail = null; });
describe("Detalle de materia", () => {
  it("Volver y breadcrumb recuperan año y página del listado", () => {
    render(<MateriaDetail materiaId="m1" />);
    for (const label of ["Volver", "Materias", "Materias de la cursada"]) {
      expect(screen.getByRole("link", { name: label }).getAttribute("href")).toBe("/home/materias?q=Plan&nivelElectiva=4&anioCarrera=ELECTIVA&page=2");
    }
    expect(screen.getByRole("heading", { name: "Historial de cambios" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Editar" })).toBeNull();
  });
  it("TASK-031: mientras carga el detalle, título y breadcrumb muestran 'Cargando…'", () => {
    state.detail = { materia: null, error: "", notFound: false, retry: vi.fn() };
    render(<MateriaDetail materiaId="m1" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Cargando…");
    expect(document.querySelector('[aria-current="page"]')?.textContent).toBe("Cargando…");
  });
  it("TASK-031: un 404 muestra el estado notFound con enlace de vuelta, sin Reintentar", () => {
    state.detail = { materia: null, error: "Materia no encontrada.", notFound: true, retry: vi.fn() };
    render(<MateriaDetail materiaId="m1" />);
    expect(screen.getByRole("alert").textContent).toContain("Materia no encontrada.");
    expect(screen.getByRole("link", { name: "Volver al listado de materias" }).getAttribute("href")).toBe("/home/materias?q=Plan&nivelElectiva=4&anioCarrera=ELECTIVA&page=2");
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  });
  it("solo ADMIN puede ver Editar para una materia activa y conserva contexto", () => {
    state.role = "ADMIN";
    const view = render(<MateriaDetail materiaId="m1" />);
    const href = screen.getByRole("link", { name: "Editar" }).getAttribute("href")!;
    expect(Object.fromEntries(new URL(href, "http://local").searchParams)).toEqual({ anioCarrera: "ELECTIVA", listadoPage: "2", q: "Plan", nivelElectiva: "4" });
    state.deletedAt = "2026-01-02";
    view.rerender(<MateriaDetail materiaId="m1" />);
    expect(screen.queryByRole("link", { name: "Editar" })).toBeNull();
  });
});
