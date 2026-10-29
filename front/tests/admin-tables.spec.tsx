// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminAcademicList } from "@/components/admin/AdminAcademicList";
import { UsuariosList } from "@/components/admin/UsuariosList";
import { listarProfesores, listarMaterias, listarComisionesPorCursada } from "@/services/academic";
import { listarUsuarios } from "@/services/users";
import { safeAdminReturnTo } from "@/validations/admin";

const nav = vi.hoisted(() => ({ query: "", path: "/home/admin/profesores", replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(nav.query), useRouter: () => nav, usePathname: () => nav.path }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("@/services/academic", async (original) => ({ ...await original<typeof import("@/services/academic")>(), listarProfesores: vi.fn(), listarMaterias: vi.fn(), listarComisionesPorCursada: vi.fn(), listarCursadasPorMateria: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 }) }));
vi.mock("@/services/users", () => ({ listarUsuarios: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { id: "self", role: "ADMIN" } }) }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); nav.query = ""; nav.path = "/home/admin/profesores"; });

describe("Tablas administrativas TASK-069", () => {
  it("filtra profesores antes de paginar y conserva el filtro al editar", async () => {
    nav.query = "q=García";
    // TASK-070: filtrado remoto; la UI muestra la página ya filtrada por el backend.
    const items = [{ id: "p11", nombreCompleto: "Ana García", createdAt: "2026-01-01", deletedAt: null }];
    vi.mocked(listarProfesores).mockResolvedValue({ items, total: 1, page: 1, pageSize: 9 });
    render(<AdminAcademicList kind="profesores" />);
    expect(await screen.findByText("Ana García")).toBeTruthy();
    expect(screen.queryByText("Profesor 0")).toBeNull();
    expect(screen.getByText(/1 registro/)).toBeTruthy();
    const edit = screen.getByRole("link", { name: "Editar Ana García" });
    expect(new URL(edit.getAttribute("href")!, "http://local").searchParams.get("returnTo")).toBe("/home/admin/profesores?q=Garc%C3%ADa");
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Dar de baja Ana García" })).toBeTruthy();
    expect(listarProfesores).toHaveBeenCalledExactlyOnceWith({ page: 1, pageSize: 9, q: "García" });
    expect(screen.getByRole("button", { name: "Nuevo profesor" })).toBeTruthy();
  });
  it("busca explícitamente y reinicia página manteniendo filtros", async () => {
    nav.query = "page=3&q=Ana";
    vi.mocked(listarProfesores).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 });
    render(<AdminAcademicList kind="profesores" />);
    const search = screen.getByRole("searchbox", { name: "Buscar por nombre" });
    await userEvent.clear(search); await userEvent.type(search, "María");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(nav.replace).toHaveBeenLastCalledWith("/home/admin/profesores?q=Mar%C3%ADa", { scroll: false });
  });
  it("Usuarios combina email y rol remotamente, sin alta ni edición de roles", async () => {
    nav.path = "/home/admin/usuarios"; nav.query = "q=utn&rol=ADMIN";
    vi.mocked(listarUsuarios).mockResolvedValue({ page: 1, pageSize: 9, total: 1, items: [
      { id: "u1", displayName: "Ana", email: "ana@utn.edu", role: "ADMIN", createdAt: "2026-01-01", disabledAt: null },
    ] });
    render(<UsuariosList />);
    expect(await screen.findByText("ana@utn.edu")).toBeTruthy();
    expect(screen.queryByText("juan@utn.edu")).toBeNull();
    expect(screen.queryByRole("button", { name: /Nuevo usuario|Editar rol/ })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Estado" })).toBeTruthy();
    expect(listarUsuarios).toHaveBeenCalledWith({ page: 1, pageSize: 9, q: "utn", rol: "ADMIN", estado: undefined });
  });
  it("Materias envía nombre, carrera y año al servidor antes de paginar", async () => {
    nav.path = "/home/admin/materias"; nav.query = "q=Redes&carrera=S&anioCarrera=4&page=2";
    vi.mocked(listarMaterias).mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 9 });
    render(<AdminAcademicList kind="materias" />);
    await waitFor(() => expect(listarMaterias).toHaveBeenCalledWith(expect.objectContaining({ q: "Redes", carrera: "S", anioCarrera: "4", page: 2, pageSize: 9 })));
    expect(await screen.findByText(/0 registros/)).toBeTruthy();
  });
  it("Comisiones combina carrera y período remotamente al cambiar el filtro", async () => {
    nav.path = "/home/admin/comisiones"; nav.query = "materiaId=m1&cursadaId=c1&carrera=Q";
    vi.mocked(listarMaterias).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 });
    const items = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, cursadaId: "c1", carrera: i === 11 ? "Q" as const : "S" as const, nombre: i === 11 ? "Q-11" : `S-${i}`, numero: i, activa: true, profesores: [], createdAt: "2026-01-01", deletedAt: null }));
    vi.mocked(listarComisionesPorCursada).mockResolvedValue({ items: items.filter((item) => item.carrera === "Q"), total: 1, page: 1, pageSize: 9 });
    const view = render(<AdminAcademicList kind="comisiones" />);
    expect(await screen.findByRole("cell", { name: "Q-11" })).toBeTruthy();
    expect(screen.queryByRole("cell", { name: "S-0" })).toBeNull();
    expect(listarComisionesPorCursada).toHaveBeenCalledWith("c1", { page: 1, pageSize: 9, carrera: "Q" });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Carrera" }), "S");
    expect(nav.replace).toHaveBeenLastCalledWith("/home/admin/comisiones?materiaId=m1&cursadaId=c1&carrera=S", { scroll: false });
    vi.mocked(listarComisionesPorCursada).mockResolvedValue({ items: items.filter((item) => item.carrera === "S").slice(0, 9), total: 11, page: 1, pageSize: 9 });
    nav.query = "materiaId=m1&cursadaId=c1&carrera=S"; view.rerender(<AdminAcademicList kind="comisiones" />);
    expect(await screen.findByRole("cell", { name: "S-0" })).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(10);
    expect(listarComisionesPorCursada).toHaveBeenCalledTimes(2);
  });
  it("conserva filtros válidos en retornos sin abrir parámetros arbitrarios", () => {
    expect(safeAdminReturnTo("/home/admin/materias?carrera=S&anioCarrera=ELECTIVA&nivelElectiva=4&q=Redes&page=2")).toBeTruthy();
    expect(safeAdminReturnTo("/home/admin/comisiones?materiaId=m1&cursadaId=c1&carrera=Q&page=2")).toBeTruthy();
    expect(safeAdminReturnTo("/home/admin/materias?carrera=OTRA")).toBeUndefined();
    expect(safeAdminReturnTo("/home/admin/profesores?q=a&q=b")).toBeUndefined();
  });
});
