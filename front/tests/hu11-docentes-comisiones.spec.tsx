// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditarComision } from "@/components/admin/EditarAcademico";
import AdminLayout from "@/app/home/admin/layout";
import { asignarProfesorComision, listarProfesores, obtenerComision, quitarProfesorComision, type ComisionDetalle, type ProfesorAsignado } from "@/services/academic";

const { auth } = vi.hoisted(() => ({ auth: { role: "ADMIN" } }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { role: auth.role } }) }));
vi.mock("@/hooks/useMateria", () => ({ useMateria: () => ({ materia: { id: "m1", carreras: [{ carrera: "S" }] }, error: "", retry: vi.fn() }) }));
vi.mock("@/services/admin-academic", () => ({ obtenerProfesor: vi.fn(), actualizarProfesor: vi.fn(), actualizarCursada: vi.fn(), actualizarComision: vi.fn() }));
vi.mock("@/services/academic", () => ({ obtenerComision: vi.fn(), obtenerCursada: vi.fn(), listarMaterias: vi.fn(), listarProfesores: vi.fn(), asignarProfesorComision: vi.fn(), quitarProfesorComision: vi.fn(), CARGOS: ["TITULAR", "ADJUNTO", "JTP"] }));
const ada = { id: "p1", nombreCompleto: "Ada Lovelace", createdAt: "2026-01-01", deletedAt: null };
const alan = { ...ada, id: "p2", nombreCompleto: "Alan Turing" };
let stored: ComisionDetalle;
beforeEach(() => {
  vi.resetAllMocks(); auth.role = "ADMIN";
  stored = { id: "co1", cursadaId: "c1", carrera: "S", numero: 31, nombre: "S-31", activa: true, profesores: [{ id: ada.id, nombreCompleto: ada.nombreCompleto, cargo: "TITULAR" }], createdAt: "2026-01-01", deletedAt: null, cursada: { id: "c1", anio: 2026, cuatrimestre: "ANUAL", materia: { id: "m1", nombre: "Álgebra" } } };
  vi.mocked(obtenerComision).mockImplementation(async () => structuredClone(stored));
  vi.mocked(listarProfesores).mockResolvedValue({ items: [ada, alan], total: 2, page: 1, pageSize: 100 });
  vi.mocked(asignarProfesorComision).mockImplementation(async (_comisionId, profesorId, cargo) => {
    const profesor = profesorId === ada.id ? ada : alan;
    const assigned = { id: profesorId, nombreCompleto: profesor.nombreCompleto, cargo };
    stored.profesores = [...stored.profesores.filter((p) => p.id !== profesorId), assigned];
    return assigned;
  });
  vi.mocked(quitarProfesorComision).mockImplementation(async (_comisionId, profesorId) => { stored.profesores = stored.profesores.filter((p) => p.id !== profesorId); });
});
afterEach(cleanup);
async function editor() { const view = render(<EditarComision comisionId="co1" />); await screen.findByLabelText("Profesor"); await waitFor(() => expect(screen.getByLabelText("Profesor").matches(":disabled")).toBe(false)); return view; }

describe("HU11 docentes en edición administrativa de comisión", () => {
  it("precarga docentes, excluye duplicados y conserva asociaciones al recargar", async () => {
    const view = await editor();
    expect((screen.getByLabelText("Cambiar cargo de Ada Lovelace") as HTMLSelectElement).value).toBe("TITULAR");
    const selector = screen.getByLabelText("Profesor");
    expect(within(selector).queryByRole("option", { name: ada.nombreCompleto })).toBeNull();
    await userEvent.selectOptions(selector, alan.id);
    await userEvent.selectOptions(screen.getByLabelText("Cargo"), "ADJUNTO");
    await userEvent.click(screen.getByRole("button", { name: "Asignar profesor" }));
    await waitFor(() => expect(asignarProfesorComision).toHaveBeenCalledWith("co1", "p2", "ADJUNTO"));
    await screen.findByLabelText("Cambiar cargo de Alan Turing");
    expect(within(screen.getByLabelText("Profesor")).queryByRole("option", { name: alan.nombreCompleto })).toBeNull();
    view.unmount(); await editor();
    expect((screen.getByLabelText("Cambiar cargo de Alan Turing") as HTMLSelectElement).value).toBe("ADJUNTO");
  });
  it("modifica cargo y desvincula sin eliminar el profesor del catálogo", async () => {
    await editor();
    await userEvent.selectOptions(screen.getByLabelText("Cambiar cargo de Ada Lovelace"), "JTP");
    await waitFor(() => expect(asignarProfesorComision).toHaveBeenCalledWith("co1", "p1", "JTP"));
    await waitFor(() => expect((screen.getByLabelText("Cambiar cargo de Ada Lovelace") as HTMLSelectElement).value).toBe("JTP"));
    await userEvent.click(screen.getByRole("button", { name: "Quitar" }));
    await waitFor(() => expect(quitarProfesorComision).toHaveBeenCalledWith("co1", "p1"));
    await waitFor(() => expect(screen.queryByLabelText("Cambiar cargo de Ada Lovelace")).toBeNull());
    expect(within(screen.getByLabelText("Profesor")).getByRole("option", { name: ada.nombreCompleto })).toBeTruthy();
  });
  it("espera confirmación del servidor e impide doble envío", async () => {
    let confirm!: (value: ProfesorAsignado) => void;
    vi.mocked(asignarProfesorComision).mockReturnValue(new Promise((resolve) => { confirm = resolve; }));
    await editor(); await userEvent.selectOptions(screen.getByLabelText("Profesor"), alan.id);
    const plegable = screen.getByLabelText("Profesor").closest("details")!;
    expect(plegable).not.toBeNull();
    expect(plegable.open).toBe(true);
    await userEvent.dblClick(screen.getByRole("button", { name: "Asignar profesor" }));
    expect(asignarProfesorComision).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Cambiar cargo de Alan Turing")).toBeNull();
    expect(screen.queryByText("Profesor asignado correctamente.")).toBeNull();
    expect(plegable.open).toBe(true);
    expect(screen.getByLabelText("Profesor").matches(":disabled")).toBe(true);
    const datos = screen.getByLabelText("Número de comisión").closest("form")!;
    expect(within(datos).getByRole("button").matches(":disabled")).toBe(true);
    confirm({ id: alan.id, nombreCompleto: alan.nombreCompleto, cargo: "TITULAR" });
    await screen.findByLabelText("Cambiar cargo de Alan Turing");
    expect(screen.getByText("Profesor asignado correctamente.")).toBeTruthy();
    expect(plegable.open).toBe(false);
    expect(plegable.contains(screen.getByText("Profesor asignado correctamente."))).toBe(false);
    expect(plegable.contains(screen.getByLabelText("Cambiar cargo de Alan Turing"))).toBe(false);
    const summary = within(plegable).getByText("Asignar profesor", { selector: "summary" });
    expect(document.activeElement).toBe(summary);
    await userEvent.click(summary);
    expect(plegable.open).toBe(true);
    expect((screen.getByLabelText("Profesor") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText("Cargo") as HTMLSelectElement).value).toBe("TITULAR");
  });
  it("muestra error de escritura, mantiene selección y permite reintentar", async () => {
    vi.mocked(asignarProfesorComision).mockRejectedValueOnce(new Error("No disponible"));
    await editor(); await userEvent.selectOptions(screen.getByLabelText("Profesor"), alan.id);
    await userEvent.click(screen.getByRole("button", { name: "Asignar profesor" }));
    expect((await screen.findByRole("alert")).textContent).toContain("No disponible");
    expect(screen.getByLabelText("Profesor").closest("details")?.open).toBe(true);
    expect((screen.getByLabelText("Profesor") as HTMLSelectElement).value).toBe(alan.id);
    expect(screen.queryByLabelText("Cambiar cargo de Alan Turing")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Asignar profesor" }));
    await screen.findByLabelText("Cambiar cargo de Alan Turing");
  });
  it("carga todas las páginas del catálogo y muestra error con reintento", async () => {
    vi.mocked(listarProfesores).mockRejectedValueOnce(new Error("Catálogo no disponible"));
    render(<EditarComision comisionId="co1" />);
    expect((await screen.findByRole("alert")).textContent).toContain("Catálogo no disponible");
    vi.mocked(listarProfesores).mockImplementation(async ({ page } = {}) => ({ items: page === 2 ? [alan] : [ada], total: 2, page: page ?? 1, pageSize: 1 }));
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(listarProfesores).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })));
    expect(within(screen.getByLabelText("Profesor")).getByRole("option", { name: alan.nombreCompleto })).toBeTruthy();
  });
  it("no expone controles ni carga el catálogo para USER", async () => {
    auth.role = "USER"; render(<EditarComision comisionId="co1" />);
    await screen.findByLabelText("Número de comisión");
    expect(screen.queryByLabelText("Profesor")).toBeNull();
    expect(screen.queryByRole("button", { name: "Quitar" })).toBeNull();
    expect(listarProfesores).not.toHaveBeenCalled();
  });
  it("el guard administrativo impide a USER abrir el formulario por URL", () => {
    auth.role = "USER";
    render(<AdminLayout><EditarComision comisionId="co1" /></AdminLayout>);
    expect(screen.getByRole("heading", { name: "Acceso no permitido" })).toBeTruthy();
    expect(obtenerComision).not.toHaveBeenCalled();
    expect(listarProfesores).not.toHaveBeenCalled();
  });
  it("conserva cargo y asociación ante errores de actualización y desvinculación", async () => {
    vi.mocked(asignarProfesorComision).mockRejectedValueOnce(new Error("Cargo rechazado"));
    vi.mocked(quitarProfesorComision).mockRejectedValueOnce(new Error("Desvinculación rechazada"));
    await editor();
    await userEvent.selectOptions(screen.getByLabelText("Cambiar cargo de Ada Lovelace"), "ADJUNTO");
    expect((await screen.findByRole("alert")).textContent).toContain("Cargo rechazado");
    expect((screen.getByLabelText("Cambiar cargo de Ada Lovelace") as HTMLSelectElement).value).toBe("TITULAR");
    await userEvent.click(screen.getByRole("button", { name: "Quitar" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Desvinculación rechazada"));
    expect(screen.getByLabelText("Cambiar cargo de Ada Lovelace")).toBeTruthy();
    expect(within(screen.getByLabelText("Profesor")).queryByRole("option", { name: ada.nombreCompleto })).toBeNull();
  });
  it("deshabilita asignar durante carga y sin profesor seleccionado", async () => {
    vi.mocked(listarProfesores).mockReturnValue(new Promise(() => {}));
    render(<EditarComision comisionId="co1" />);
    await screen.findByLabelText("Profesor");
    expect(screen.getByLabelText("Profesor").matches(":disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Asignar profesor" }).matches(":disabled")).toBe(true);
    expect(asignarProfesorComision).not.toHaveBeenCalled();
  });
});
