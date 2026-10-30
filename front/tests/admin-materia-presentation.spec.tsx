// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminMateriaDetail } from "@/components/admin/AdminAcademicDetail";
import { obtenerDetalleAdministrativo, type AdminRecord } from "@/services/admin-detail";
import { eliminarAcademico } from "@/services/admin-academic";
import type { Materia } from "@/types/materias";

const state = vi.hoisted(() => ({ role: "ADMIN", query: "" }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(state.query), useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { id: "admin", role: state.role } }) }));
vi.mock("@/services/admin-detail", () => ({ obtenerDetalleAdministrativo: vi.fn() }));
vi.mock("@/services/admin-academic", () => ({ eliminarAcademico: vi.fn() }));

const date = "2026-10-29T15:30:00.000Z";
let materia: Materia;
// jsdom carece de apertura modal nativa; se conserva el diálogo real y sus controles.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
function detail(page = 1): AdminRecord {
  return { registro: { ...materia }, auditoria: { id: materia.id, createdAt: date, createdBy: "actor-reference", updatedAt: null, updatedBy: null, deletedAt: materia.deletedAt, deletedBy: null }, historial: { items: [], total: 0, page, pageSize: 3 } };
}
beforeEach(() => {
  vi.resetAllMocks(); state.role = "ADMIN"; state.query = "";
  materia = { id: "m1", nombre: "Álgebra y Geometría Analítica Aplicada a Sistemas de Información y Modelos de Ingeniería", modalidad: "ANUAL", carreras: [{ carrera: "S", anioCarrera: "2", nivelElectiva: null }], createdAt: date, deletedAt: null };
  vi.mocked(obtenerDetalleAdministrativo).mockImplementation(async (_kind, _id, page = 1) => detail(page));
  vi.mocked(eliminarAcademico).mockImplementation(async () => { materia = { ...materia, deletedAt: date }; });
});
afterEach(cleanup);

async function renderDetail() {
  const view = render(<AdminMateriaDetail materiaId="m1" />);
  await screen.findByRole("heading", { level: 1, name: materia.nombre });
  return view;
}
function field(label: string) {
  const term = screen.getByText(label, { selector: "dt" });
  return term.closest("div")!.querySelector("dd")!;
}
function href(name: string | RegExp) { return new URL(screen.getByRole("link", { name }).getAttribute("href")!, "https://local.test"); }

describe("presentación administrativa de Materias", () => {
  it("presenta encabezado, descripción, información académica y acciones con foco de página", async () => {
    await renderDetail();
    expect(screen.getByText("Detalle de materia")).toBeTruthy();
    expect(screen.getByText("Datos académicos y períodos de cursada")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Información académica" })).toBeTruthy();
    expect(field("Estado").textContent).toBe("Activa");
    expect(screen.getByRole("link", { name: "Editar materia" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Dar de baja.*Álgebra/ })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
    expect(document.querySelector('a[href^="/home/materias"]')).toBeNull();
  });
  it("muestra carrera y año reales en modalidad anual, sin campo Cuatrimestre", async () => {
    await renderDetail();
    expect(field("Modalidad").textContent).toBe("Anual");
    expect(screen.queryByText("Cuatrimestre", { selector: "dt" })).toBeNull();
    expect(screen.getByText("Ingeniería en Sistemas de Información")).toBeTruthy();
    expect(screen.getByText("2.º año")).toBeTruthy();
  });
  it.each([["PRIMERO", "Primer cuatrimestre"], ["SEGUNDO", "Segundo cuatrimestre"]] as const)("presenta %s con modalidad y cuatrimestre independientes", async (modalidad, periodo) => {
    materia.modalidad = modalidad;
    await renderDetail();
    expect(field("Modalidad").textContent).toBe("Cuatrimestral");
    expect(field("Cuatrimestre").textContent).toBe(periodo);
  });
  it("conserva todas las asociaciones y niveles de electiva sin duplicar el año de otra carrera", async () => {
    materia.carreras.push({ carrera: "I", anioCarrera: "ELECTIVA", nivelElectiva: "4" });
    await renderDetail();
    expect(screen.getByText("Ingeniería en Sistemas de Información")).toBeTruthy();
    expect(screen.getByText("2.º año")).toBeTruthy();
    expect(screen.getByText("Ingeniería Industrial")).toBeTruthy();
    expect(screen.getByText(/Electiva.*4\.º Nivel/)).toBeTruthy();
  });
  it("asocia cada carrera con su propio año regular", async () => {
    materia.carreras.push({ carrera: "I", anioCarrera: "4", nivelElectiva: null });
    await renderDetail();
    const sistemas = screen.getByText("Ingeniería en Sistemas de Información", { selector: "dt" }).closest("div")!;
    const industrial = screen.getByText("Ingeniería Industrial", { selector: "dt" }).closest("div")!;
    expect(within(sistemas).getByText("2.º año")).toBeTruthy();
    expect(within(sistemas).queryByText("4.º año")).toBeNull();
    expect(within(industrial).getByText("4.º año")).toBeTruthy();
    expect(within(industrial).queryByText("2.º año")).toBeNull();
  });
  it("expresa modalidad ausente y carreras vacías sin inventar datos académicos", async () => {
    materia.modalidad = null; materia.carreras = [];
    await renderDetail();
    expect(field("Modalidad").textContent).toBe("No registrado");
    expect(screen.queryByText("Cuatrimestre", { selector: "dt" })).toBeNull();
    expect(screen.getByText("No hay carreras asociadas.")).toBeTruthy();
  });
  it("conserva filtros y página al volver, editar y abrir el listado real de cursadas", async () => {
    const origin = "/home/admin/materias?q=Redes&carrera=S&anioCarrera=2&page=3";
    state.query = new URLSearchParams({ returnTo: origin }).toString();
    await renderDetail();
    expect(href(/Volver a/).pathname + href(/Volver a/).search).toBe(origin);
    // TASK-admin-navigation-context: cancelar edición recupera el detalle, no salta al listado.
    expect(href("Editar materia").searchParams.get("returnTo")).toBe(`/home/admin/materias/m1?${new URLSearchParams({ returnTo: origin })}`);
    const cursadas = href("Ver cursadas");
    expect(cursadas.pathname).toBe("/home/admin/cursadas");
    expect(cursadas.searchParams.get("materiaId")).toBe("m1");
    expect(cursadas.searchParams.get("materiaReturnTo")).toBe(origin);
  });
  it("oculta edición y baja para materias inactivas, conservando auditoría e historial", async () => {
    materia.deletedAt = date;
    await renderDetail();
    expect(field("Estado").textContent).toBe("Inactiva");
    expect(screen.queryByRole("link", { name: "Editar materia" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Dar de baja/ })).toBeNull();
    expect(await screen.findByRole("heading", { name: "Auditoría" })).toBeTruthy();
  });
  it("no ofrece acciones administrativas ni auditoría al rol USER", async () => {
    state.role = "USER";
    await renderDetail();
    expect(screen.queryByRole("link", { name: "Editar materia" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Dar de baja/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Auditoría" })).toBeNull();
  });
  it("exige confirmación de baja y refresca estado y auditoría tras respuesta del servidor", async () => {
    await renderDetail();
    await userEvent.click(screen.getByRole("button", { name: /Dar de baja.*Álgebra/ }));
    const dialog = screen.getByRole("dialog", { name: "Dar de baja materia" });
    expect(within(dialog).getByText(/Querés dar de baja.*Álgebra/)).toBeTruthy();
    expect(eliminarAcademico).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar baja" }));
    await waitFor(() => expect(eliminarAcademico).toHaveBeenCalledExactlyOnceWith("materias", "m1"));
    expect(await screen.findByText("La materia se dio de baja correctamente.")).toBeTruthy();
    await waitFor(() => expect(field("Estado").textContent).toBe("Inactiva"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("distingue error y reintento de carga del detalle", async () => {
    vi.mocked(obtenerDetalleAdministrativo).mockRejectedValueOnce(new Error("Conexión interrumpida"));
    render(<AdminMateriaDetail materiaId="m1" />);
    expect(screen.getByRole("status").textContent).toBe("Cargando registro…");
    expect((await screen.findByRole("alert")).textContent).toContain("Intentá nuevamente");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { level: 1, name: materia.nombre })).toBeTruthy();
  });
  it("usa la auditoría compartida y solicita historial paginado de tres", async () => {
    vi.mocked(obtenerDetalleAdministrativo).mockImplementation(async (_kind, _id, page = 1) => ({ ...detail(page), historial: { page, pageSize: 3, total: 4, items: [{ id: `event-${page}`, actorId: null, accion: "EDICION", createdAt: date, cambios: [{ campo: "nombre", anterior: "Álgebra", nuevo: materia.nombre }] }] } }));
    await renderDetail();
    const heading = await screen.findByRole("heading", { name: "Auditoría" });
    const audit = heading.closest("section")!;
    expect(within(audit).getByText("Solo administración")).toBeTruthy();
    expect(within(audit).getByRole("heading", { name: "Baja" })).toBeTruthy();
    const disclosure = audit.querySelector("details")!;
    expect(disclosure.open).toBe(false);
    await userEvent.click(within(audit).getByText("Historial de cambios"));
    expect(within(audit).getByRole("table")).toBeTruthy();
    expect(within(audit).getByText("Página 1 de 2")).toBeTruthy();
    await userEvent.click(within(audit).getByRole("button", { name: "Página siguiente" }));
    await waitFor(() => expect(obtenerDetalleAdministrativo).toHaveBeenCalledWith("materias", "m1", 2));
    expect(await screen.findByText("Página 2 de 2")).toBeTruthy();
  });
  it("permite reintentar auditoría sin perder los datos de materia", async () => {
    let auditUnavailable = true;
    vi.mocked(obtenerDetalleAdministrativo).mockImplementation(async (_kind, _id, page) => {
      if (page !== undefined && auditUnavailable) throw new Error("Auditoría temporalmente no disponible");
      return detail(page);
    });
    await renderDetail();
    const retry = await screen.findByRole("button", { name: "Reintentar auditoría" });
    expect(screen.getByRole("heading", { level: 1, name: materia.nombre })).toBeTruthy();
    auditUnavailable = false;
    await userEvent.click(retry);
    expect(await screen.findByRole("heading", { name: "Auditoría" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reintentar auditoría" })).toBeNull();
  });
});
