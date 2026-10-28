// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ComisionesMateria } from "@/components/academic/ComisionesMateria";
import { ComisionesList } from "@/components/academic/ComisionesList";
import { safeAdminReturnTo } from "@/validations/admin";

vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ usePathname: () => "/home/materias/m1/cursadas/c1", useSearchParams: () => new URLSearchParams("carrera=Q&cursadaId=c1&comisionesPage=2"), useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => true }));
vi.mock("@/hooks/useCursada", () => ({ useCursada: () => ({ cursada: { id: "c1", anio: 2026, materia: { id: "m1", nombre: "Álgebra" } } }) }));
vi.mock("@/services/academic", () => ({
  listarCursadasPorMateria: vi.fn().mockResolvedValue({ items: [{ id: "c1", anio: 2026, cuatrimestre: "ANUAL", comisiones: 0, profesores: 0, carreras: ["Q"] }], total: 1, page: 1, pageSize: 100 }),
  listarComisionesPorCursada: vi.fn().mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 9 }),
}));
vi.mock("@/components/academic/CursadasList", () => ({ CursadasList: () => null }));
afterEach(cleanup);

describe("Origen del alta de comisión desde materia", () => {
  it("el listado de una cursada también conserva el retorno administrativo", () => {
    render(<ComisionesList materiaId="m1" cursadaId="c1" />);
    const url = new URL(screen.getByRole("link", { name: "Nueva comisión" }).getAttribute("href")!, "https://local.test");
    expect(url.searchParams.get("cursadaId")).toBe("c1");
    expect(url.searchParams.get("returnTo")).toBe("/home/admin/comisiones?materiaId=m1&cursadaId=c1");
  });
  it("precarga período y vuelve a la sección administrativa de la misma materia con filtros", async () => {
    render(<ComisionesMateria materiaId="m1" materiaNombre="Álgebra" carreras={[{ carrera: "Q", anioCarrera: "2", nivelElectiva: null }]} />);
    const link = await screen.findByRole("link", { name: "Nueva comisión" });
    const url = new URL(link.getAttribute("href")!, "https://local.test");
    expect(url.pathname).toBe("/home/admin/comisiones/nueva");
    expect(url.searchParams.get("cursadaId")).toBe("c1");
    const target = url.searchParams.get("returnTo");
    expect(target).toBe("/home/admin/comisiones?materiaId=m1&cursadaId=c1&carrera=Q&page=2");
    expect(safeAdminReturnTo(target)).toBe(target);
  });
});
