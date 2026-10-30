// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminCursadaDetail } from "@/components/admin/AdminAcademicDetail";
import { obtenerDetalleAdministrativo, type AdminRecord } from "@/services/admin-detail";
import { eliminarAcademico } from "@/services/admin-academic";
import type { CursadaDetalle } from "@/services/academic";

const state = vi.hoisted(() => ({ role: "ADMIN", query: "" }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(state.query), useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { id: "admin", role: state.role } }) }));
vi.mock("@/services/admin-detail", () => ({ obtenerDetalleAdministrativo: vi.fn() }));
vi.mock("@/services/admin-academic", () => ({ eliminarAcademico: vi.fn() }));

const date = "2026-10-29T15:30:00.000Z";
let cursada: CursadaDetalle & { deletedAt: string | null };
let history: AdminRecord["historial"];
beforeAll(() => {
  // jsdom no implementa la apertura nativa; se mantienen el diálogo y sus controles reales.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
function detail(page = 1): AdminRecord {
  return {
    registro: { ...cursada },
    auditoria: { id: cursada.id, createdAt: date, createdBy: "actor-reference", createdByName: "Nombre autorizado", updatedAt: null, updatedBy: "unresolved-reference", updatedByName: null, deletedAt: cursada.deletedAt, deletedBy: null },
    historial: { ...history, page },
  };
}
beforeEach(() => {
  vi.resetAllMocks(); state.role = "ADMIN"; state.query = "";
  cursada = { id: "cu1", anio: 2026, cuatrimestre: "ANUAL", materia: { id: "m1", nombre: "Álgebra y Geometría Analítica Aplicada a Sistemas de Información y Modelos de Ingeniería", modalidad: "SEGUNDO" }, deletedAt: null };
  history = { items: [], total: 0, page: 1, pageSize: 3 };
  vi.mocked(obtenerDetalleAdministrativo).mockImplementation(async (_kind, _id, page = 1) => detail(page));
  vi.mocked(eliminarAcademico).mockImplementation(async () => { cursada = { ...cursada, deletedAt: date }; });
});
afterEach(cleanup);

async function renderDetail() {
  const view = render(<AdminCursadaDetail cursadaId="cu1" />);
  await screen.findByRole("heading", { name: "Información de la cursada" });
  return view;
}
function field(label: string) {
  return screen.getByText(label, { selector: "dt" }).closest("div")!.querySelector("dd")!;
}
function href(name: string | RegExp) {
  return new URL(screen.getByRole("link", { name }).getAttribute("href")!, "https://local.test");
}

describe("presentación administrativa de Cursadas", () => {
  it.each([["ANUAL", "Anual 2026"], ["PRIMERO", "1er cuatrimestre 2026"], ["SEGUNDO", "2do cuatrimestre 2026"]] as const)("muestra período %s independiente de la modalidad registrada de materia", async (periodo, title) => {
    cursada.cuatrimestre = periodo;
    cursada.materia.modalidad = periodo === "ANUAL" ? "SEGUNDO" : "ANUAL";
    await renderDetail();
    const heading = screen.getByRole("heading", { level: 1, name: title });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("Detalle de cursada")).toBeTruthy();
    expect(field("Período").textContent).toBe(title);
    expect(field("Estado").textContent).toBe("Activa");
    expect(within(field("Materia")).getByRole("link", { name: cursada.materia.nombre })).toBeTruthy();
    expect(screen.getByText("Las comisiones y sus equipos docentes se consultan dentro de esta cursada")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Editar cursada" })).toBeTruthy();
  });

  it("conserva breadcrumb completo, filtros, página y regreso desde comisiones", async () => {
    const origin = "/home/admin/materias?q=Redes&carrera=S&page=3";
    const list = `/home/admin/cursadas?${new URLSearchParams({ materiaId: "m1", materiaReturnTo: origin, page: "2" })}`;
    state.query = new URLSearchParams({ returnTo: list }).toString();
    await renderDetail();
    const breadcrumb = screen.getByRole("navigation", { name: "Ubicación actual" });
    expect(within(breadcrumb).getByRole("link", { name: "Administración" }).getAttribute("href")).toBe("/home/admin");
    expect(within(breadcrumb).getByRole("link", { name: "Materias" }).getAttribute("href")).toBe(origin);
    expect(within(breadcrumb).getByRole("link", { name: cursada.materia.nombre })).toBeTruthy();
    expect(within(breadcrumb).getByRole("link", { name: "Cursadas" })).toBeTruthy();
    expect(within(breadcrumb).getByText("Anual 2026").getAttribute("aria-current")).toBe("page");
    expect(href(/Volver a/).pathname + href(/Volver a/).search).toBe(list);
    // TASK-admin-navigation-context: edición conserva el detalle como destino de cancelación.
    expect(href("Editar cursada").searchParams.get("returnTo")).toBe(`/home/admin/cursadas/cu1?${new URLSearchParams({ returnTo: list })}`);
    const materia = new URL(within(field("Materia")).getByRole("link").getAttribute("href")!, "https://local.test");
    expect(materia.pathname).toBe("/home/admin/materias/m1");
    expect(materia.searchParams.get("returnTo")).toBe(origin);
    const commissions = href("Ver comisiones");
    expect(commissions.pathname).toBe("/home/admin/comisiones");
    expect(commissions.searchParams.get("materiaId")).toBe("m1");
    expect(commissions.searchParams.get("cursadaId")).toBe("cu1");
    expect(commissions.searchParams.get("materiaReturnTo")).toBe(origin);
    const returnTo = new URL(commissions.searchParams.get("returnTo")!, "https://local.test");
    expect(returnTo.pathname).toBe("/home/admin/cursadas/cu1");
    expect(returnTo.searchParams.get("returnTo")).toBe(list);
    expect(document.querySelector('a[href^="/home/materias"]')).toBeNull();
  });

  it("presenta nombre ausente sin inventar contexto de materia", async () => {
    cursada.materia.nombre = "   ";
    await renderDetail();
    expect(field("Materia").textContent).toBe("No registrado");
  });

  it.each([null, undefined])("mantiene año y señala período ausente (%s) sin inferir la modalidad", async (periodo) => {
    cursada.cuatrimestre = periodo;
    await renderDetail();
    expect(screen.getByRole("heading", { level: 1, name: "2026 · No registrado" })).toBeTruthy();
    expect(field("Período").textContent).toBe("2026 · No registrado");
  });

  it("mantiene consulta de comisiones e historial de cursadas inactivas sin edición ni baja", async () => {
    cursada.deletedAt = date;
    await renderDetail();
    expect(field("Estado").textContent).toBe("Inactiva");
    expect(screen.queryByRole("link", { name: "Editar cursada" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Dar de baja/ })).toBeNull();
    expect(href("Ver comisiones").pathname).toBe("/home/admin/comisiones");
    expect(await screen.findByRole("heading", { name: "Auditoría" })).toBeTruthy();
  });

  it("no ofrece acciones ni auditoría a otros roles", async () => {
    state.role = "USER";
    await renderDetail();
    expect(screen.queryByRole("link", { name: "Editar cursada" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Dar de baja/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Auditoría" })).toBeNull();
  });

  it("permite cancelar con foco inicial seguro y confirma baja refrescando estado e historial", async () => {
    await renderDetail();
    const user = userEvent.setup();
    const opener = screen.getByRole("button", { name: /Dar de baja/ });
    await user.click(opener);
    let dialog = screen.getByRole("dialog", { name: "Dar de baja cursada" });
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(eliminarAcademico).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
    await user.click(opener);
    dialog = screen.getByRole("dialog", { name: "Dar de baja cursada" });
    await user.click(within(dialog).getByRole("button", { name: "Confirmar baja" }));
    await waitFor(() => expect(eliminarAcademico).toHaveBeenCalledExactlyOnceWith("cursadas", "cu1"));
    expect(await screen.findByText("La cursada se dio de baja correctamente.")).toBeTruthy();
    await waitFor(() => expect(field("Estado").textContent).toBe("Inactiva"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByRole("heading", { name: "Auditoría" })).toBeTruthy();
  });

  it("conserva baja bloqueada y permite corregir sin ocultar el diálogo", async () => {
    vi.mocked(eliminarAcademico).mockRejectedValue(new Error("La cursada tiene comisiones vigentes asociadas."));
    await renderDetail();
    await userEvent.click(screen.getByRole("button", { name: /Dar de baja/ }));
    const dialog = screen.getByRole("dialog", { name: "Dar de baja cursada" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar baja" }));
    expect((await within(dialog).findByRole("alert")).textContent).toContain("comisiones vigentes");
    expect(field("Estado").textContent).toBe("Activa");
    expect((within(dialog).getByRole("button", { name: "Confirmar baja" }) as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("reutiliza auditoría, traduce períodos históricos y conserva actores y paginación reales", async () => {
    history = { page: 1, pageSize: 3, total: 4, items: [{ id: "event-reference", actorId: "unnamed-reference", actorName: null, accion: "EDICION", createdAt: date, cambios: [{ campo: "cuatrimestre", anterior: "ANUAL", nuevo: "SEGUNDO" }] }] };
    const { container } = await renderDetail();
    const heading = await screen.findByRole("heading", { name: "Auditoría" });
    const audit = heading.closest("section")!;
    expect(within(audit).getByText("Solo administración")).toBeTruthy();
    expect(within(audit).getByRole("heading", { name: "Baja" })).toBeTruthy();
    expect(within(audit).getByText("Nombre autorizado")).toBeTruthy();
    expect(within(audit).getByText("Usuario no identificado")).toBeTruthy();
    expect(within(audit).getAllByText("No registrado").length).toBeGreaterThan(0);
    expect(within(audit).getByText("La fecha de actualización no constituye un historial completo de cambios")).toBeTruthy();
    const disclosure = audit.querySelector("details")!;
    expect(disclosure.open).toBe(false);
    const summary = audit.querySelector("summary")!;
    expect(summary.textContent).toContain("4");
    summary.focus();
    expect(document.activeElement).toBe(summary);
    // La activación nativa Enter/Espacio de summary requiere la revisión manual de navegador.
    await userEvent.click(summary);
    expect(disclosure.open).toBe(true);
    const table = within(audit).getByRole("table");
    expect(within(table).getAllByRole("columnheader").map(cell => cell.textContent)).toEqual(["Campo", "Antes", "Después"]);
    expect(within(table).getByText("Anual")).toBeTruthy();
    expect(within(table).getByText("Segundo cuatrimestre")).toBeTruthy();
    expect(table.textContent).not.toMatch(/ANUAL|SEGUNDO/);
    expect(within(audit).getByText("Actor: Usuario no identificado")).toBeTruthy();
    for (const reference of ["actor-reference", "unresolved-reference", "unnamed-reference", "event-reference"]) expect(container.textContent).not.toContain(reference);
    await userEvent.click(within(audit).getByRole("button", { name: "Página siguiente" }));
    await waitFor(() => expect(obtenerDetalleAdministrativo).toHaveBeenCalledWith("cursadas", "cu1", 2));
    expect(await screen.findByText("Página 2 de 2")).toBeTruthy();
  });
});
