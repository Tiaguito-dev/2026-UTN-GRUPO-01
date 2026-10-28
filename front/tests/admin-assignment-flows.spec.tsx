// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComisionDetail } from "@/components/academic/ComisionDetail";
import { asignarProfesorComision, listarComisionesPorCursada, listarProfesores } from "@/services/academic";
import { obtenerDetalleAdministrativo } from "@/services/admin-detail";
import { obtenerMateria } from "@/services/materias";

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useRouter: () => nav, useSearchParams: () => new URLSearchParams() }));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => true }));
vi.mock("@/components/feedback/ComisionFeedback", () => ({ ComisionFeedback: () => <div>Experiencias</div> }));
vi.mock("@/components/admin/AdminAudit", () => ({ AdminAudit: () => null }));
vi.mock("@/components/admin/AcademicDeleteAction", () => ({ AcademicDeleteAction: () => null }));
vi.mock("@/services/admin-detail", () => ({ obtenerDetalleAdministrativo: vi.fn() }));
vi.mock("@/services/materias", () => ({ obtenerMateria: vi.fn() }));
vi.mock("@/services/academic", () => ({ asignarProfesorComision: vi.fn(), listarComisionesPorCursada: vi.fn(), listarProfesores: vi.fn(), quitarProfesorComision: vi.fn(), obtenerComision: vi.fn(), CARGOS: ["TITULAR", "ADJUNTO", "JTP"] }));
const date = "2026-01-01T00:00:00.000Z";
const profesor = { id: "p1", nombreCompleto: "Ada Lovelace", createdAt: date, deletedAt: null };
const assignment = { id: "p1", nombreCompleto: profesor.nombreCompleto, cargo: "JTP" as const };
const comision = { id: "co1", cursadaId: "c1", carrera: "S" as const, numero: 31, nombre: "S-31", activa: true, profesores: [], createdAt: date, deletedAt: null, cursada: { id: "c1", anio: 2026, cuatrimestre: "ANUAL" as const, materia: { id: "m1", nombre: "Álgebra" } } };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(obtenerDetalleAdministrativo).mockResolvedValue({ registro: comision, auditoria: { id: "co1", createdAt: date, createdBy: null, updatedAt: null, updatedBy: null, deletedAt: null, deletedBy: null }, historial: { items: [], total: 0, page: 1, pageSize: 3 } });
  vi.mocked(listarComisionesPorCursada).mockResolvedValue({ items: [comision], total: 1, page: 1, pageSize: 100 });
  vi.mocked(listarProfesores).mockResolvedValue({ items: [profesor], total: 1, page: 1, pageSize: 100 });
  vi.mocked(obtenerMateria).mockResolvedValue({ id: "m1", nombre: "Álgebra", carreras: [{ carrera: "S", anioCarrera: "2", nivelElectiva: null }], createdAt: date, deletedAt: null });
});
afterEach(cleanup);

describe("Alta de asignación docente dentro de su sección", () => {
  it("conserva docente y cargo tras error; espera éxito sin duplicar y refresca equipo visible", async () => {
    let resolve!: (value: typeof assignment) => void;
    vi.mocked(asignarProfesorComision).mockRejectedValueOnce(new Error("Intentá nuevamente")).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render(<ComisionDetail comisionId="co1" administrative />);
    await userEvent.click(await screen.findByText("Gestionar equipo docente"));
    await screen.findByRole("option", { name: profesor.nombreCompleto });
    await userEvent.selectOptions(screen.getByLabelText("Profesor"), "p1");
    await userEvent.selectOptions(screen.getByLabelText("Cargo"), "JTP");
    await userEvent.click(screen.getByRole("button", { name: "Asignar profesor" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Intentá nuevamente");
    expect((screen.getByLabelText("Profesor") as HTMLSelectElement).value).toBe("p1");
    expect((screen.getByLabelText("Cargo") as HTMLSelectElement).value).toBe("JTP");
    expect(nav.push).not.toHaveBeenCalled();
    const form = screen.getByLabelText("Profesor").closest("form")!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(asignarProfesorComision).toHaveBeenCalledTimes(2);
    expect(obtenerDetalleAdministrativo).toHaveBeenCalledTimes(1);
    vi.mocked(obtenerDetalleAdministrativo).mockResolvedValue({ registro: { ...comision, profesores: [assignment] }, auditoria: { id: "co1", createdAt: date, createdBy: null, updatedAt: null, updatedBy: null, deletedAt: null, deletedBy: null }, historial: { items: [], total: 0, page: 1, pageSize: 3 } });
    await act(async () => resolve(assignment));
    await screen.findByText("El profesor se asignó correctamente.");
    const team = screen.getByRole("heading", { name: "Equipo docente" }).closest("section")!;
    await waitFor(() => expect(within(team).getByRole("link", { name: profesor.nombreCompleto })).toBeTruthy());
    expect(screen.queryByRole("option", { name: profesor.nombreCompleto })).toBeNull();
    expect(asignarProfesorComision).toHaveBeenLastCalledWith("co1", "p1", "JTP");
    expect(nav.push).not.toHaveBeenCalled();
  }, 15_000);
});
