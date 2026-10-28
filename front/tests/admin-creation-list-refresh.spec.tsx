// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminAcademicList } from "@/components/admin/AdminAcademicList";
import { crearProfesor, listarProfesores } from "@/services/academic";

const nav = vi.hoisted(() => ({ query: "", replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(nav.query), useRouter: () => nav, usePathname: () => "/home/admin/profesores" }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => true }));
vi.mock("@/services/academic", async (original) => ({ ...await original<typeof import("@/services/academic")>(), crearProfesor: vi.fn(), listarProfesores: vi.fn() }));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
beforeEach(() => { vi.clearAllMocks(); nav.query = ""; });
afterEach(cleanup);
const date = "2026-01-01T00:00:00.000Z";
const profesor = { id: "p1", nombreCompleto: "Ada Lovelace", createdAt: date, deletedAt: null };
const empty = { items: [], total: 0, page: 1, pageSize: 9 };

describe("Listado tras alta en modal administrativo", () => {
  it("actualiza datos visibles y confirma en el mismo listado", async () => {
    vi.mocked(listarProfesores).mockResolvedValueOnce(empty).mockResolvedValue({ ...empty, items: [profesor], total: 1 });
    vi.mocked(crearProfesor).mockResolvedValue(profesor);
    render(<AdminAcademicList kind="profesores" />);
    await screen.findByText(/No hay registros/);
    await userEvent.click(screen.getByRole("button", { name: "Nuevo profesor" }));
    await userEvent.type(screen.getByLabelText("Nombre completo"), profesor.nombreCompleto);
    await userEvent.click(screen.getByRole("button", { name: "Crear profesor" }));
    expect(await screen.findByRole("cell", { name: profesor.nombreCompleto })).toBeTruthy();
    expect(screen.getByText(`Profesor creado: ${profesor.nombreCompleto}.`)).toBeTruthy();
    expect(listarProfesores).toHaveBeenCalledTimes(2);
    expect(nav.push).not.toHaveBeenCalled();
  });
  it("conserva filtros y ofrece limpiarlos cuando ocultan el alta", async () => {
    nav.query = "q=Rossi";
    vi.mocked(listarProfesores).mockResolvedValue(empty);
    vi.mocked(crearProfesor).mockResolvedValue(profesor);
    render(<AdminAcademicList kind="profesores" />);
    await screen.findByText(/No hay registros/);
    await userEvent.click(screen.getByRole("button", { name: "Nuevo profesor" }));
    await userEvent.type(screen.getByLabelText("Nombre completo"), profesor.nombreCompleto);
    await userEvent.click(screen.getByRole("button", { name: "Crear profesor" }));
    await screen.findByText(/no coincide con los filtros seleccionados/);
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("Rossi");
    await waitFor(() => expect(listarProfesores).toHaveBeenCalledTimes(2));
    expect(listarProfesores).toHaveBeenLastCalledWith({ page: 1, pageSize: 9, q: "Rossi" });
    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros para buscar el registro" }));
    expect(nav.replace).toHaveBeenLastCalledWith("/home/admin/profesores", { scroll: false });
  });
});
