// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminAcademicList } from "@/components/admin/AdminAcademicList";
import { AdminMateriaDetail, AdminProfesorDetail, AdminCursadaDetail } from "@/components/admin/AdminAcademicDetail";
import { ComisionDetail } from "@/components/academic/ComisionDetail";
import { obtenerDetalleAdministrativo } from "@/services/admin-detail";
import { eliminarAcademico } from "@/services/admin-academic";
import { listarProfesores, listarComisionesPorCursada } from "@/services/academic";
import { obtenerMateria } from "@/services/materias";

const nav = vi.hoisted(() => ({ query: "", role: "ADMIN", replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(nav.query), useRouter: () => nav, usePathname: () => "/home/admin/profesores" }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { id: "admin", role: nav.role } }) }));
vi.mock("@/services/admin-detail", () => ({ obtenerDetalleAdministrativo: vi.fn() }));
vi.mock("@/services/admin-academic", () => ({ eliminarAcademico: vi.fn() }));
vi.mock("@/services/materias", () => ({ obtenerMateria: vi.fn() }));
vi.mock("@/services/academic", () => ({ listarProfesores: vi.fn(), listarComisionesPorCursada: vi.fn(), listarMaterias: vi.fn(), listarCursadasPorMateria: vi.fn(), obtenerCursada: vi.fn(), obtenerComision: vi.fn(), CARGOS: ["TITULAR", "ADJUNTO", "JTP"] }));
vi.mock("@/components/feedback/ComisionFeedback", () => ({ ComisionFeedback: () => <p>Experiencias conservadas</p> }));
const date = "2026-01-01T00:00:00.000Z";
const materia = { id: "m1", nombre: "Álgebra", modalidad: "ANUAL" as const, carreras: [{ carrera: "S" as const, anioCarrera: "4" as const, nivelElectiva: null }], createdAt: date, deletedAt: null };
const profesor = { id: "p1", nombreCompleto: "Ana García", createdAt: date, deletedAt: null };
const cursada = { id: "cu1", anio: 2026, cuatrimestre: "ANUAL", materia: { id: "m1", nombre: materia.nombre, modalidad: "ANUAL" }, deletedAt: null, createdAt: date };
const comision = { id: "co1", nombre: "S-41", cursadaId: "cu1", carrera: "S", numero: 41, activa: true, profesores: [{ id: "p1", nombreCompleto: profesor.nombreCompleto, cargo: "TITULAR" }], cursada, createdAt: date, deletedAt: null };
let deleted = false; let blocked = false;
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks(); nav.query = ""; nav.role = "ADMIN"; deleted = false; blocked = false;
  vi.mocked(obtenerMateria).mockResolvedValue(materia);
  vi.mocked(listarProfesores).mockResolvedValue({ items: [profesor], total: 1, page: 1, pageSize: 9 });
  vi.mocked(listarComisionesPorCursada).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 });
  vi.mocked(eliminarAcademico).mockImplementation(async () => { deleted = true; });
  vi.mocked(obtenerDetalleAdministrativo).mockImplementation(async (kind, id) => ({
    registro: { ...(kind === "materias" ? materia : kind === "profesores" ? profesor : kind === "cursadas" ? cursada : comision), deletedAt: deleted ? date : null, ...(kind === "comisiones" ? { activa: !deleted } : {}) },
    auditoria: { id, createdAt: date, createdBy: "admin", updatedAt: deleted ? date : null, updatedBy: deleted ? "admin" : null, deletedAt: deleted ? date : null, deletedBy: deleted ? "admin" : null },
    historial: { items: blocked ? [{ id: "event", actorId: "admin", accion: "BAJA_BLOQUEADA", createdAt: date, cambios: [{ campo: "resultado", anterior: null, nuevo: "BLOQUEADA" }, { campo: "motivo", anterior: null, nuevo: "Tiene períodos vigentes." }] }] : [], total: blocked ? 1 : 0, page: 1, pageSize: 3 },
  }));
});

describe("bajas administrativas académicas", () => {
  it.each([
    ["materias", "m1", <AdminMateriaDetail key="materia" materiaId="m1" />, "Editar materia"],
    ["profesores", "p1", <AdminProfesorDetail key="profesor" profesorId="p1" />, "Editar profesor"],
    ["cursadas", "cu1", <AdminCursadaDetail key="cursada" cursadaId="cu1" />, "Editar cursada"],
    ["comisiones", "co1", <ComisionDetail key="comision" comisionId="co1" administrative />, "Editar comisión"],
  ] as const)("confirma la baja lógica de %s y conserva el detalle con auditoría", async (kind, id, component, editLabel) => {
    render(component);
    const action = await screen.findByRole("button", { name: /^Dar de baja/ });
    expect(action.querySelector("svg.lucide-trash-2")).toBeTruthy();
    await userEvent.click(action);
    let dialog = screen.getByRole("dialog");
    expect(dialog.textContent).not.toContain("Identificador");
    expect(dialog.textContent).not.toMatch(new RegExp(`\\b${id}\\b`));
    expect(dialog.textContent).not.toMatch(/[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/iu);
    const names = { materias: materia.nombre, profesores: profesor.nombreCompleto, cursadas: materia.nombre, comisiones: comision.nombre };
    expect(dialog.textContent).toContain(names[kind]);
    expect(dialog.textContent).toContain("El registro quedará inactivo. Se conservarán sus datos y el historial.");
    const warnings = {
      materias: "Si tiene períodos de cursada vigentes asociados, la baja se bloqueará. Dales de baja primero.",
      profesores: "Si tiene asignaciones en comisiones vigentes, la baja se bloqueará. Desvinculalo de esas comisiones primero.",
      cursadas: "Si tiene comisiones vigentes asociadas, la baja se bloqueará. Dales de baja primero.",
      comisiones: "No admitirá nuevas experiencias, ediciones ni asignaciones docentes. Se conservarán las relaciones existentes.",
    };
    expect(dialog.textContent).toContain(warnings[kind]);
    if (kind === "comisiones") expect(dialog.textContent).not.toContain("la baja se bloqueará");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(eliminarAcademico).not.toHaveBeenCalled();
    await userEvent.click(action);
    dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar baja" }));
    expect(eliminarAcademico).toHaveBeenCalledExactlyOnceWith(kind, id);
    await waitFor(() => expect(screen.queryByRole("button", { name: /^Dar de baja/ })).toBeNull());
    expect(await screen.findByRole("heading", { name: "Auditoría" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: editLabel })).toBeNull();
    expect(screen.getByText(/se dio de baja correctamente/)).toBeTruthy();
  });

  it("mantiene el error relacional y actualiza la auditoría del intento sin cerrar la confirmación", async () => {
    vi.mocked(eliminarAcademico).mockImplementation(async () => { blocked = true; throw new Error("Tiene períodos vigentes. Dales de baja primero."); });
    render(<AdminMateriaDetail materiaId="m1" />);
    await userEvent.click(await screen.findByRole("button", { name: /^Dar de baja/ }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar baja" }));
    expect(await within(dialog).findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Dales de baja primero"));
    expect(await screen.findByText("Baja bloqueada")).toBeTruthy();
    // Materias adopta la tabla compartida de auditoría con las etiquetas del detalle de usuarios.
    expect(screen.getByRole("rowheader", { name: "Resultado" })).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "Motivo" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Editar materia" })).toBeTruthy();
    expect(screen.getByRole("dialog")).toBe(dialog);
  });

  it("al dar de baja la última fila vuelve de página2 a página1 y actualiza el contador filtrado", async () => {
    nav.query = "q=Ana&page=2";
    const firstPage = Array.from({ length: 9 }, (_, index) => ({ ...profesor, id: `other-${index}`, nombreCompleto: `Ana ${index}` }));
    vi.mocked(listarProfesores).mockImplementation(async (input = {}) => ({ items: input.page === 2 ? deleted ? [] : [profesor] : firstPage, total: deleted ? 9 : 10, page: input.page ?? 1, pageSize: 9 }));
    const view = render(<AdminAcademicList kind="profesores" />);
    await userEvent.click(await screen.findByRole("button", { name: "Dar de baja Ana García" }));
    expect(screen.getByRole("dialog").textContent).toContain("Desvinculalo de esas comisiones primero.");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmar baja" }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/home/admin/profesores?q=Ana", { scroll: false }));
    nav.query = "q=Ana"; view.rerender(<AdminAcademicList kind="profesores" />);
    await screen.findByRole("cell", { name: "Ana 0" });
    expect(screen.getByText(/9 registros/)).toBeTruthy();
    expect(screen.queryByRole("cell", { name: "Ana García" })).toBeNull();
    expect(listarProfesores).toHaveBeenLastCalledWith({ page: 1, pageSize: 9, q: "Ana" });
  });

  it("no ofrece bajas a una cuenta USER aunque se monte el detalle directamente", async () => {
    nav.role = "USER";
    render(<AdminProfesorDetail profesorId="p1" />);
    await screen.findByRole("heading", { name: profesor.nombreCompleto });
    expect(screen.queryByRole("button", { name: /^Dar de baja/ })).toBeNull();
  });
});
