// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminProfesorDetail } from "@/components/admin/AdminAcademicDetail";
import { obtenerDetalleAdministrativo, type AdminRecord } from "@/services/admin-detail";
import { eliminarAcademico } from "@/services/admin-academic";
import type { Profesor } from "@/services/academic";

const state = vi.hoisted(() => ({ role: "ADMIN", query: "" }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(state.query), useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { id: "admin", role: state.role } }) }));
vi.mock("@/services/admin-detail", () => ({ obtenerDetalleAdministrativo: vi.fn() }));
vi.mock("@/services/admin-academic", () => ({ eliminarAcademico: vi.fn() }));

const date = "2026-10-29T15:30:00.000Z";
const reference = "644e6a1a-b99b-42f5-b677-098a37af0951";
let profesor: Profesor;
let history: AdminRecord["historial"];
beforeAll(() => {
  // jsdom no abre dialog de forma nativa; el foco y los controles siguen siendo los reales.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
function detail(page = 1): AdminRecord {
  return {
    registro: { ...profesor },
    auditoria: { id: profesor.id, createdAt: date, createdBy: reference, createdByName: "Nombre autorizado", updatedAt: null, updatedBy: reference, updatedByName: null, deletedAt: profesor.deletedAt ?? null, deletedBy: null },
    historial: { ...history, page },
  };
}
beforeEach(() => {
  vi.resetAllMocks(); state.role = "ADMIN"; state.query = "";
  profesor = { id: "p1", nombreCompleto: "María de los Ángeles Fernández del Valle", createdAt: date, deletedAt: null };
  history = { items: [], total: 0, page: 1, pageSize: 3 };
  vi.mocked(obtenerDetalleAdministrativo).mockImplementation(async (_kind, _id, page = 1) => detail(page));
  vi.mocked(eliminarAcademico).mockImplementation(async () => { profesor = { ...profesor, deletedAt: date }; });
});
afterEach(cleanup);

async function renderDetail() {
  const view = render(<AdminProfesorDetail profesorId="p1" />);
  await screen.findByRole("region", { name: "Información del profesor" });
  return view;
}
function field(label: string) {
  const info = screen.getByRole("region", { name: "Información del profesor" });
  return within(info).getByText(label, { selector: "dt" }).closest("div")!.querySelector("dd")!;
}
function href(name: string | RegExp) {
  return new URL(screen.getByRole("link", { name }).getAttribute("href")!, "https://local.test");
}

describe("presentación administrativa de Profesores", () => {
  it.each([
    ["María de los Ángeles Fernández del Valle", "MV"],
    ["  Álvaro   Pérez  ", "ÁP"],
    ["Cher", "C"],
  ])("conserva el nombre completo %s y calcula iniciales disponibles", async (name, initials) => {
    profesor.nombreCompleto = name;
    const { container } = await renderDetail();
    const heading = screen.getByRole("heading", { level: 1, name: name.trim().replace(/\s+/gu, " ") });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("Detalle de profesor")).toBeTruthy();
    expect(screen.getByText("Registro del catálogo de profesores")).toBeTruthy();
    expect(field("Nombre completo").textContent).toBe(name.trim());
    expect(field("Estado").textContent).toBe("Activo");
    expect(container.querySelector('[class*="avatar"]')?.textContent).toBe(initials);
    expect(container.querySelector('[class*="avatar"]')?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("link", { name: "Editar profesor" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Dar de baja profesor/ }).textContent).toBe("Dar de baja");
    expect(screen.queryByText(/Especialidad|Correo electrónico|Asignaciones/)).toBeNull();
  });

  it("presenta nombre ausente sin inventar iniciales", async () => {
    profesor.nombreCompleto = "   ";
    const { container } = await renderDetail();
    expect(screen.getByRole("heading", { level: 1, name: "No registrado" })).toBeTruthy();
    expect(field("Nombre completo").textContent).toBe("No registrado");
    expect(container.querySelector('[class*="avatar"]')?.textContent).toBe("");
  });

  it("conserva búsqueda y página tanto en Volver como breadcrumb y edición", async () => {
    const list = "/home/admin/profesores?q=Mar%C3%ADa&page=3";
    state.query = new URLSearchParams({ returnTo: list, successMessage: "Profesor actualizado correctamente." }).toString();
    await renderDetail();
    expect(href(/Volver a/).pathname + href(/Volver a/).search).toBe(list);
    const breadcrumb = screen.getByRole("navigation", { name: "Ubicación actual" });
    expect(within(breadcrumb).getByRole("link", { name: "Administración" }).getAttribute("href")).toBe("/home/admin");
    expect(within(breadcrumb).getByRole("link", { name: "Profesores" }).getAttribute("href")).toBe(list);
    expect(within(breadcrumb).getByText(profesor.nombreCompleto).getAttribute("aria-current")).toBe("page");
    expect(href("Editar profesor").pathname).toBe("/home/admin/profesores/p1/editar");
    expect(href("Editar profesor").searchParams.get("returnTo")).toBe(list);
    expect(screen.getByText("Profesor actualizado correctamente.")).toBeTruthy();
  });

  it.each(["https://externo.test", "/home/admin/usuarios?page=2", "/home/admin/profesores/p2", "/home/admin/profesores?page=0", "/home/admin/profesores?q=A&q=B", "/home/admin/profesores#fragmento"])("rechaza origen inválido o ajeno %s", async (returnTo) => {
    state.query = new URLSearchParams({ returnTo }).toString();
    await renderDetail();
    expect(href(/Volver a/).pathname + href(/Volver a/).search).toBe("/home/admin/profesores");
    expect(href("Editar profesor").searchParams.get("returnTo")).toBe("/home/admin/profesores");
  });

  it("conserva auditoría del profesor inactivo sin ofrecer editar ni baja", async () => {
    profesor.deletedAt = date;
    await renderDetail();
    expect(field("Estado").textContent).toBe("Inactivo");
    expect(screen.queryByRole("link", { name: "Editar profesor" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Dar de baja/ })).toBeNull();
    expect(await screen.findByRole("heading", { name: "Auditoría" })).toBeTruthy();
  });

  it("oculta acciones y auditoría para otros roles", async () => {
    state.role = "USER";
    await renderDetail();
    expect(screen.queryByRole("link", { name: "Editar profesor" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Dar de baja/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Auditoría" })).toBeNull();
  });

  it("permite cancelar por teclado y confirma baja actualizando estado e historial", async () => {
    await renderDetail();
    const user = userEvent.setup();
    const opener = screen.getByRole("button", { name: /Dar de baja profesor/ });
    opener.focus();
    await user.keyboard("{Enter}");
    let dialog = screen.getByRole("dialog", { name: "Dar de baja profesor" });
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(eliminarAcademico).not.toHaveBeenCalled();
    expect(dialog.textContent).toContain("asignaciones en comisiones vigentes");
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
    await user.keyboard("{Enter}");
    dialog = screen.getByRole("dialog", { name: "Dar de baja profesor" });
    await user.click(within(dialog).getByRole("button", { name: "Confirmar baja" }));
    await waitFor(() => expect(eliminarAcademico).toHaveBeenCalledExactlyOnceWith("profesores", "p1"));
    expect(await screen.findByText("El profesor se dio de baja correctamente.")).toBeTruthy();
    await waitFor(() => expect(field("Estado").textContent).toBe("Inactivo"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByRole("heading", { name: "Auditoría" })).toBeTruthy();
  });

  it("conserva restricción de baja por asignaciones y permite cancelar tras error", async () => {
    vi.mocked(eliminarAcademico).mockRejectedValue(new Error("El profesor tiene asignaciones en comisiones vigentes."));
    await renderDetail();
    await userEvent.click(screen.getByRole("button", { name: /Dar de baja profesor/ }));
    const dialog = screen.getByRole("dialog", { name: "Dar de baja profesor" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar baja" }));
    expect((await within(dialog).findByRole("alert")).textContent).toContain("asignaciones en comisiones vigentes");
    expect(field("Estado").textContent).toBe("Activo");
    expect((within(dialog).getByRole("button", { name: "Confirmar baja" }) as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("reutiliza auditoría e historial vacío cerrado con actores y ausencias reales", async () => {
    const { container } = await renderDetail();
    const heading = await screen.findByRole("heading", { name: "Auditoría" });
    const audit = heading.closest("section")!;
    expect(within(audit).getByText("Solo administración")).toBeTruthy();
    expect(within(audit).getByRole("heading", { name: "Creación" })).toBeTruthy();
    expect(within(audit).getByRole("heading", { name: "Última modificación" })).toBeTruthy();
    expect(within(audit).getByRole("heading", { name: "Baja" })).toBeTruthy();
    expect(within(audit).getByText("Nombre autorizado")).toBeTruthy();
    expect(within(audit).getByText("Usuario no identificado")).toBeTruthy();
    expect(within(audit).getAllByText("No registrado").length).toBeGreaterThan(0);
    expect(within(audit).getByText("La fecha de actualización no constituye un historial completo de cambios")).toBeTruthy();
    const time = audit.querySelector("time")!;
    expect(time.dateTime).toBe(date);
    expect(time.querySelector("small")?.textContent).toBe(new Date(date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }));
    const disclosure = audit.querySelector("details")!;
    expect(disclosure.open).toBe(false);
    await userEvent.click(audit.querySelector("summary")!);
    expect(within(audit).getByText("No hay eventos registrados")).toBeTruthy();
    expect(container.textContent).not.toContain(reference);
  });

  it("conserva orden, operaciones, comparación y paginación del historial real", async () => {
    history = { page: 1, pageSize: 3, total: 4, items: [
      { id: "event-reference-2", actorId: reference, actorName: "Actor autorizado", accion: "EDICION", createdAt: date, cambios: [{ campo: "nombreCompleto", anterior: "Nombre anterior", nuevo: profesor.nombreCompleto }] },
      { id: "event-reference-1", actorId: reference, actorName: null, accion: "BAJA_BLOQUEADA", createdAt: "2026-10-28T15:30:00.000Z", cambios: [] },
    ] };
    const { container } = await renderDetail();
    const heading = await screen.findByRole("heading", { name: "Auditoría" });
    const audit = heading.closest("section")!;
    const summary = audit.querySelector("summary")!;
    expect(summary.textContent).toContain("4");
    summary.focus();
    expect(document.activeElement).toBe(summary);
    // La activación nativa de summary por Enter/Espacio queda para la revisión del navegador.
    await userEvent.click(summary);
    const events = within(audit).getAllByRole("listitem");
    expect(events[0]!.textContent).toContain("Edición");
    expect(events[1]!.textContent).toContain("Baja bloqueada");
    const table = within(audit).getByRole("table");
    expect(within(table).getAllByRole("columnheader").map(cell => cell.textContent)).toEqual(["Campo", "Antes", "Después"]);
    expect(within(table).getByText("Nombre anterior")).toBeTruthy();
    expect(within(table).getByText(profesor.nombreCompleto)).toBeTruthy();
    expect(within(audit).getByText("Actor: Actor autorizado")).toBeTruthy();
    expect(within(audit).getByText("Actor: Usuario no identificado")).toBeTruthy();
    expect(container.textContent).not.toContain(reference);
    expect(container.textContent).not.toContain("event-reference");
    await userEvent.click(within(audit).getByRole("button", { name: "Página siguiente" }));
    await waitFor(() => expect(obtenerDetalleAdministrativo).toHaveBeenCalledWith("profesores", "p1", 2));
    expect(await screen.findByText("Página 2 de 2")).toBeTruthy();
  });
});
