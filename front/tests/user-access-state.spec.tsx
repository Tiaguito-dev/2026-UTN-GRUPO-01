// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UsuariosList } from "@/components/admin/UsuariosList";
import { AdminRecordDetail } from "@/components/admin/AdminRecordDetail";
import { cambiarEstadoUsuario, listarUsuarios } from "@/services/users";
import { obtenerDetalleAdministrativo, type AdminRecord } from "@/services/admin-detail";

const nav = vi.hoisted(() => ({ query: "", replace: vi.fn(), push: vi.fn(), account: { id: "self", role: "ADMIN" } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(nav.query), useRouter: () => nav, usePathname: () => "/home/admin/usuarios" }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: nav.account }) }));
vi.mock("@/services/users", () => ({ listarUsuarios: vi.fn(), cambiarEstadoUsuario: vi.fn() }));
vi.mock("@/services/admin-detail", () => ({ obtenerDetalleAdministrativo: vi.fn() }));
const date = "2026-01-01T00:00:00.000Z";
const user = { id: "u1", displayName: "Ana", email: "ana@utn.edu", role: "USER" as const, createdAt: date, disabledAt: null };
const detail = (disabledAt: string | null, page = 1): AdminRecord => ({ registro: { ...user, disabledAt }, auditoria: { id: user.id, createdAt: date, createdBy: null, updatedAt: date, updatedBy: "self", deletedAt: disabledAt, deletedBy: disabledAt ? "self" : null }, historial: { items: [{ id: "h1", actorId: "self", accion: disabledAt ? "DESACTIVACION" : "ACTIVACION", createdAt: date, cambios: [{ campo: "estado", anterior: disabledAt ? "ACTIVO" : "INACTIVO", nuevo: disabledAt ? "INACTIVO" : "ACTIVO" }] }], total: 4, page, pageSize: 3 } });

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); nav.query = ""; nav.account = { id: "self", role: "ADMIN" }; });

describe("administración del acceso de usuarios", () => {
  it.each(["/home/admin/profesores", "https://externo.test", "/home/admin/usuarios/u2"])("rechaza un origen ajeno al listado: %s", async (returnTo) => {
    nav.query = new URLSearchParams({ returnTo }).toString();
    vi.mocked(obtenerDetalleAdministrativo).mockResolvedValue(detail(null));
    render(<AdminRecordDetail kind="users" id="u1" />);
    await screen.findByRole("region", { name: "Cuenta de usuario" });
    expect(screen.getByRole("link", { name: /Volver/ }).getAttribute("href")).toBe("/home/admin/usuarios");
    expect(within(screen.getByRole("navigation", { name: "Ubicación actual" })).getByText("Ana")).toBeTruthy();
    expect(screen.queryByText("No podés desactivar tu propia cuenta")).toBeNull();
  });
  it("conserva textos largos, campos ausentes y el regreso al listado filtrado", async () => {
    const origin = "/home/admin/usuarios?q=Ana&estado=ACTIVO&page=3";
    nav.query = new URLSearchParams({ returnTo: origin }).toString();
    const longName = "Nombre público completo ".repeat(12);
    const data = detail(null);
    data.registro = { ...data.registro, displayName: longName, email: null };
    vi.mocked(obtenerDetalleAdministrativo).mockResolvedValue(data);
    render(<AdminRecordDetail kind="users" id="u1" />);
    expect((await screen.findAllByText(longName.trim())).every(node => node.textContent === longName)).toBe(true);
    expect(screen.getAllByText("No registrado").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Volver/ }).getAttribute("href")).toBe(origin);
    expect(screen.queryByText("u1")).toBeNull();
  });
  it("identifica cuentas homónimas, permite cancelar y refresca resultados filtrados después de desactivar", async () => {
    nav.query = "estado=ACTIVO";
    vi.mocked(listarUsuarios).mockResolvedValueOnce({ items: [user, { ...user, id: "u2", email: "otra@utn.edu" }], total: 2, page: 1, pageSize: 9 }).mockResolvedValue({ items: [{ ...user, id: "u2", email: "otra@utn.edu" }], total: 1, page: 1, pageSize: 9 });
    vi.mocked(cambiarEstadoUsuario).mockResolvedValue({ ...user, disabledAt: date });
    render(<UsuariosList />);
    const action = await screen.findByRole("button", { name: "Desactivar usuario Ana (ana@utn.edu)" });
    expect(action.querySelector("svg.lucide-user-x")).toBeTruthy();
    await userEvent.click(action);
    let dialog = screen.getByRole("dialog", { name: "Desactivar usuario" });
    expect(dialog.textContent).toContain("Ana (ana@utn.edu)");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(cambiarEstadoUsuario).not.toHaveBeenCalled();
    await userEvent.click(action);
    dialog = screen.getByRole("dialog", { name: "Desactivar usuario" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar desactivación" }));
    await waitFor(() => expect(screen.queryByRole("cell", { name: "ana@utn.edu" })).toBeNull());
    expect(screen.getByRole("cell", { name: "otra@utn.edu" })).toBeTruthy();
    expect(listarUsuarios).toHaveBeenLastCalledWith({ page: 1, pageSize: 9, estado: "ACTIVO", q: undefined, rol: undefined });
    expect(screen.getByText("Usuario desactivado correctamente.")).toBeTruthy();
  });

  it("reactiva desde otra página del historial y vuelve a mostrar los eventos más recientes con las acciones actuales", async () => {
    let disabledAt: string | null = date;
    vi.mocked(obtenerDetalleAdministrativo).mockImplementation(async (_kind, _id, page) => detail(disabledAt, page));
    vi.mocked(cambiarEstadoUsuario).mockImplementation(async () => { disabledAt = null; return user; });
    render(<AdminRecordDetail kind="users" id="u1" />);
    // El historial ahora inicia cerrado y se abre antes de paginar.
    await userEvent.click(await screen.findByText(/Historial de cambios/));
    await userEvent.click(await screen.findByRole("button", { name: "Página siguiente" }));
    await waitFor(() => expect(obtenerDetalleAdministrativo).toHaveBeenLastCalledWith("users", "u1", 2));
    await userEvent.click(await screen.findByRole("button", { name: "Reactivar usuario Ana (ana@utn.edu)" }));
    const dialog = screen.getByRole("dialog", { name: "Reactivar usuario" });
    expect(dialog.textContent).toContain("Ana (ana@utn.edu)");
    expect(dialog.textContent).toContain("sesiones revocadas no se restaurarán");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar reactivación" }));
    const action = await screen.findByRole("button", { name: "Desactivar usuario Ana (ana@utn.edu)" });
    expect(action.querySelector("svg.lucide-user-x")).toBeTruthy();
    expect(cambiarEstadoUsuario).toHaveBeenCalledExactlyOnceWith("u1", true);
    expect(obtenerDetalleAdministrativo).toHaveBeenLastCalledWith("users", "u1", 1);
    expect(within(screen.getByRole("region", { name: "Cuenta de usuario" })).getByText("Activo")).toBeTruthy();
    expect(screen.getByText("Activación")).toBeTruthy();
    expect(screen.getByText("Actor: Usuario no identificado")).toBeTruthy();
    expect(screen.getByText("Usuario reactivado correctamente.")).toBeTruthy();
  });

  it("muestra el rechazo del backend y conserva el estado para reintentar sin anunciar éxito", async () => {
    vi.mocked(obtenerDetalleAdministrativo).mockResolvedValue(detail(null));
    vi.mocked(cambiarEstadoUsuario).mockRejectedValue(new Error("Debe conservar al menos un administrador activo."));
    render(<AdminRecordDetail kind="users" id="u1" />);
    await userEvent.click(await screen.findByRole("button", { name: /Desactivar usuario Ana/ }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar desactivación" }));
    expect((await within(dialog).findByRole("alert")).textContent).toContain("administrador activo");
    expect(screen.queryByText("Usuario desactivado correctamente.")).toBeNull();
    expect(within(screen.getByRole("region", { name: "Cuenta de usuario" })).getByText("Activo")).toBeTruthy();
  });

  it.each([{ id: "u1", role: "ADMIN" }, { id: "self", role: "USER" }])("no ofrece cambiar estado a la propia cuenta ni a usuarios sin rol administrativo: %j", async (account) => {
    nav.account = account;
    vi.mocked(obtenerDetalleAdministrativo).mockResolvedValue(detail(null));
    render(<AdminRecordDetail kind="users" id="u1" />);
    await screen.findByRole("region", { name: "Cuenta de usuario" });
    expect(screen.queryByRole("button", { name: /Desactivar usuario/ })).toBeNull();
    if (account.id === "u1") expect(screen.getByText("No podés desactivar tu propia cuenta")).toBeTruthy();
    if (account.role === "USER") {
      expect(screen.queryByRole("heading", { name: "Auditoría" })).toBeNull();
      expect(screen.queryByText(/Historial de cambios/)).toBeNull();
    }
  });
});
