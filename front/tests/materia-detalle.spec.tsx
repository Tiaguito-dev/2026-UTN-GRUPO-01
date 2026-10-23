// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MateriaDetail } from "@/components/academic/MateriaDetail";
const { state } = vi.hoisted(() => ({ state: { role: "USER", deletedAt: null as string | null } }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("anioCarrera=ELECTIVA&listadoPage=2&q=Plan&nivelElectiva=4") }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { role: state.role } }) }));
vi.mock("@/hooks/useMateria", () => ({ useMateria: () => ({ materia: { id: "m1", nombre: "Materia", anioCarrera: "ELECTIVA", nivelElectiva: "4", createdAt: "2026-01-01", deletedAt: state.deletedAt }, error: "", retry: vi.fn() }) }));
vi.mock("@/hooks/usePaginatedFetch", () => ({ usePaginatedFetch: () => ({ status: "ready", result: { items: [], total: 0, page: 1, pageSize: 3 }, page: 1, setPage: vi.fn() }) }));
vi.mock("@/components/academic/CursadasList", () => ({ CursadasList: ({ materiasHref }: { materiasHref: string }) => <a href={materiasHref}>Materias de la cursada</a> }));
afterEach(() => { cleanup(); state.role = "USER"; state.deletedAt = null; });
describe("Detalle de materia", () => {
  it("Volver y breadcrumb recuperan año y página del listado", () => {
    render(<MateriaDetail materiaId="m1" />);
    for (const label of ["Volver", "Materias", "Materias de la cursada"]) {
      expect(screen.getByRole("link", { name: label }).getAttribute("href")).toBe("/home/materias?q=Plan&nivelElectiva=4&anioCarrera=ELECTIVA&page=2");
    }
    expect(screen.getByRole("heading", { name: "Historial de cambios" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Editar" })).toBeNull();
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
