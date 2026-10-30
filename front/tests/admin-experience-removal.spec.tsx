// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminRecordDetail } from "@/components/admin/AdminRecordDetail";
import { obtenerDetalleAdministrativo, type AdminRecord } from "@/services/admin-detail";
import { eliminarFeedback } from "@/services/feedback";

const state = vi.hoisted(() => ({ role: "ADMIN", query: "" }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(state.query) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { id: "admin", role: state.role } }) }));
vi.mock("@/services/admin-detail", () => ({ obtenerDetalleAdministrativo: vi.fn() }));
vi.mock("@/services/feedback", () => ({ eliminarFeedback: vi.fn() }));

const date = "2026-10-30T15:00:00.000Z";
const origin = "/home/admin/experiencias?carrera=S&materiaId=m1&page=3";
let deletedAt: string | null;
beforeAll(() => {
  // jsdom no implementa dialog nativo; emular únicamente apertura/cierre y cancel de Escape.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
function detail(page = 1): AdminRecord {
  return {
    registro: { id: "f1", autorId: "student", autor: { displayName: "Autora real" }, texto: "La experiencia que se eliminará.", anonimo: true, comisionId: "co1", comisionNombre: "S-31", materiaNombre: "Álgebra", deletedAt },
    auditoria: { id: "f1", createdAt: date, createdBy: "student", createdByName: "Autora real", updatedAt: deletedAt, updatedBy: deletedAt ? "admin" : null, updatedByName: deletedAt ? "Administradora" : null, deletedAt, deletedBy: deletedAt ? "admin" : null, deletedByName: deletedAt ? "Administradora" : null },
    historial: { items: deletedAt ? [{ id: "e1", actorId: "admin", actorName: "Administradora", accion: "ELIMINACION", createdAt: date, cambios: [{ campo: "deletedAt", anterior: null, nuevo: date }] }] : [], total: deletedAt ? 1 : 0, page, pageSize: 3 },
  };
}
beforeEach(() => {
  vi.resetAllMocks(); state.role = "ADMIN"; state.query = new URLSearchParams({ returnTo: origin }).toString(); deletedAt = null;
  vi.mocked(obtenerDetalleAdministrativo).mockImplementation(async (_kind, _id, page) => detail(page));
  vi.mocked(eliminarFeedback).mockImplementation(async () => { deletedAt = date; });
});
afterEach(cleanup);

describe("eliminación administrativa de experiencias", () => {
  it("ADMIN puede eliminar un comentario ajeno y anónimo solo después de confirmar", async () => {
    render(<AdminRecordDetail kind="feedback" id="f1" />);
    const remove = await screen.findByRole("button", { name: "Eliminar comentario" });
    expect(remove.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(eliminarFeedback).not.toHaveBeenCalled();
    await userEvent.click(remove);
    const dialog = screen.getByRole("dialog", { name: "Eliminar comentario" });
    expect(eliminarFeedback).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar eliminación" }));
    await screen.findByText("El comentario se eliminó correctamente.");
    expect(eliminarFeedback).toHaveBeenCalledExactlyOnceWith("f1");
    expect(screen.getByText("Eliminado", { selector: "span" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Eliminar comentario" })).toBeNull();
    expect(screen.getByText("La experiencia que se eliminará.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Volver a/ }).getAttribute("href")).toBe(origin);
    const summary = document.querySelector("summary")!;
    await userEvent.click(summary);
    expect(screen.getByText("Actor: Administradora")).toBeTruthy();
    expect(obtenerDetalleAdministrativo).toHaveBeenLastCalledWith("feedback", "f1", 1);
  });

  it.each(["Cancelar", "Escape"])("%s conserva el comentario y devuelve el foco sin llamadas", async (action) => {
    render(<AdminRecordDetail kind="feedback" id="f1" />);
    const remove = await screen.findByRole("button", { name: "Eliminar comentario" });
    await userEvent.click(remove);
    if (action === "Escape") act(() => {
      const dialog = screen.getByRole("dialog");
      if (fireEvent(dialog, new Event("cancel", { cancelable: true }))) (dialog as HTMLDialogElement).close();
    });
    else await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(eliminarFeedback).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(remove);
    expect(screen.getByText("La experiencia que se eliminará.")).toBeTruthy();
  });

  it("un error conserva contenido y contexto y permite reintentar", async () => {
    vi.mocked(eliminarFeedback).mockRejectedValueOnce(new Error("Intentá nuevamente."));
    render(<AdminRecordDetail kind="feedback" id="f1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Eliminar comentario" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar eliminación" }));
    expect(await screen.findByText(/No pudimos completar la operación/)).toBeTruthy();
    expect(screen.getByText("La experiencia que se eliminará.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Volver a/ }).getAttribute("href")).toBe(origin);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar eliminación" }));
    await screen.findByText("El comentario se eliminó correctamente.");
    expect(eliminarFeedback).toHaveBeenCalledTimes(2);
  });

  it("deshabilita la confirmación pendiente e impide envíos duplicados", async () => {
    let complete!: () => void;
    vi.mocked(eliminarFeedback).mockImplementation(() => new Promise<void>(resolve => { complete = resolve; }));
    render(<AdminRecordDetail kind="feedback" id="f1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Eliminar comentario" }));
    await userEvent.dblClick(screen.getByRole("button", { name: "Confirmar eliminación" }));
    expect(eliminarFeedback).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Procesando…" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Cancelar" }).hasAttribute("disabled")).toBe(true);
    complete();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("no muestra eliminación a USER ni para registros eliminados", async () => {
    state.role = "USER";
    const view = render(<AdminRecordDetail kind="feedback" id="f1" />);
    await screen.findByText("La experiencia que se eliminará.");
    expect(screen.queryByRole("button", { name: "Eliminar comentario" })).toBeNull();
    view.unmount(); state.role = "ADMIN"; deletedAt = date;
    render(<AdminRecordDetail kind="feedback" id="f1" />);
    await screen.findByText("La experiencia que se eliminará.");
    expect(screen.queryByRole("button", { name: "Eliminar comentario" })).toBeNull();
  });
});
