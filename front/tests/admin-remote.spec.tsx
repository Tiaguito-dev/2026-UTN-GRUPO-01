// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminAcademicList } from "@/components/admin/AdminAcademicList";
import { UsuariosList } from "@/components/admin/UsuariosList";
import { listarProfesores } from "@/services/academic";
import { eliminarAcademico } from "@/services/admin-academic";
import { cambiarEstadoUsuario, listarUsuarios } from "@/services/users";
import { AdminHistory } from "@/components/admin/AdminHistory";
import { listarHistorialAdministrativo } from "@/services/admin-history";

const nav = vi.hoisted(() => ({ query: "", path: "/home/admin/profesores", replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(nav.query), useRouter: () => nav, usePathname: () => nav.path }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { id: "self", role: "ADMIN" } }) }));
vi.mock("@/services/academic", async (original) => ({ ...await original<typeof import("@/services/academic")>(), listarProfesores: vi.fn() }));
vi.mock("@/services/admin-academic", () => ({ eliminarAcademico: vi.fn() }));
vi.mock("@/services/users", () => ({ listarUsuarios: vi.fn(), cambiarEstadoUsuario: vi.fn() }));
vi.mock("@/services/admin-history", () => ({ listarHistorialAdministrativo: vi.fn() }));
const profesor = { id: "p1", nombreCompleto: "Ana García", createdAt: "2026-01-01", deletedAt: null };
const usuario = { id: "u1", displayName: "Ana", email: "ana@utn.edu", role: "USER" as const, createdAt: "2026-01-01", disabledAt: null };
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); nav.query = ""; nav.path = "/home/admin/profesores"; });

describe("Administración remota TASK-070", () => {
  it("pide solo la página remota de profesores con búsqueda sin descargar catálogo", async () => {
    nav.query = "q=García&page=3";
    vi.mocked(listarProfesores).mockResolvedValue({ items: [profesor], total: 27, page: 3, pageSize: 9 });
    render(<AdminAcademicList kind="profesores" />);
    await screen.findByRole("cell", { name: "Ana García" });
    expect(listarProfesores).toHaveBeenCalledExactlyOnceWith({ page: 3, pageSize: 9, q: "García" });
    expect(screen.getByText(/27 registros/)).toBeTruthy();
  });
  it("eliminar exige confirmación y conserva errores relacionales para reintentar", async () => {
    vi.mocked(listarProfesores).mockResolvedValue({ items: [profesor], total: 1, page: 1, pageSize: 9 });
    vi.mocked(eliminarAcademico).mockRejectedValueOnce(new Error("Quitá primero las asignaciones vigentes.")).mockResolvedValue(undefined);
    render(<AdminAcademicList kind="profesores" />);
    await userEvent.click(await screen.findByRole("button", { name: "Eliminar Ana García" }));
    expect(eliminarAcademico).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Eliminar registro" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar eliminación" }));
    expect(await within(dialog).findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("asignaciones"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar eliminación" }));
    await waitFor(() => expect(eliminarAcademico).toHaveBeenCalledTimes(2));
    expect(eliminarAcademico).toHaveBeenLastCalledWith("profesores", "p1");
    expect(await screen.findByText(/Registro eliminado correctamente/)).toBeTruthy();
  });
  it("consulta usuarios con filtros remotos y no permite autodesactivarse", async () => {
    nav.path = "/home/admin/usuarios"; nav.query = "q=utn&rol=USER&estado=ACTIVO&page=2";
    vi.mocked(listarUsuarios).mockResolvedValue({ items: [usuario, { ...usuario, id: "self", displayName: "Mi cuenta" }], total: 11, page: 2, pageSize: 9 });
    render(<UsuariosList />);
    await screen.findByRole("cell", { name: "Ana" });
    expect(listarUsuarios).toHaveBeenCalledExactlyOnceWith({ page: 2, pageSize: 9, q: "utn", rol: "USER", estado: "ACTIVO" });
    expect(screen.queryByRole("button", { name: "Desactivar Mi cuenta" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Desactivar Ana" }));
    expect(cambiarEstadoUsuario).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole("dialog", { name: "Desactivar usuario" })).getByRole("button", { name: "Confirmar desactivación" }));
    await waitFor(() => expect(cambiarEstadoUsuario).toHaveBeenCalledWith("u1", false));
  });
  it("historial solicita páginas de tres y permite avanzar", async () => {
    vi.mocked(listarHistorialAdministrativo).mockImplementation(async (_kind, _id, input) => ({ items: [{ id: "h1", actorId: "admin", accion: "EDICION", createdAt: "2026-01-01", cambios: [{ campo: "nombreCompleto", anterior: "Ana", nuevo: "Ana García" }] }], total: 4, page: input?.page ?? 1, pageSize: 3 }));
    render(<AdminHistory kind="profesores" id="p1" />);
    await screen.findByText("Ahora: Ana García");
    expect(listarHistorialAdministrativo).toHaveBeenCalledWith("profesores", "p1", { page: 1, pageSize: 3 });
    await userEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    await waitFor(() => expect(listarHistorialAdministrativo).toHaveBeenLastCalledWith("profesores", "p1", { page: 2, pageSize: 3 }));
  });
});
