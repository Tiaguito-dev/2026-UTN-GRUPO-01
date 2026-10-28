// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AltaProfesor } from "@/components/admin/AltaProfesor";
import { AltaCursada } from "@/components/admin/AltaCursada";
import { MateriaFormPage } from "@/components/admin/MateriaFormPage";
import { crearProfesor, crearCursada, listarMaterias } from "@/services/academic";
import { crearMateria, actualizarMateria } from "@/services/materias";

const nav = vi.hoisted(() => ({ query: "", push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(nav.query), useRouter: () => nav }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("@/services/academic", () => ({ crearProfesor: vi.fn(), crearCursada: vi.fn(), listarMaterias: vi.fn() }));
vi.mock("@/services/materias", () => ({ crearMateria: vi.fn(), actualizarMateria: vi.fn() }));
const date = "2026-01-01T00:00:00.000Z";
const materia = { id: "m1", nombre: "Álgebra", modalidad: "ANUAL" as const, carreras: [{ carrera: "S" as const, anioCarrera: "2" as const, nivelElectiva: null }], createdAt: date, deletedAt: null };
const profesor = { id: "p1", nombreCompleto: "Ada Lovelace", createdAt: date, deletedAt: null };
beforeEach(() => {
  vi.clearAllMocks(); nav.query = "";
  vi.mocked(listarMaterias).mockResolvedValue({ items: [materia], total: 1, page: 1, pageSize: 100 });
  vi.mocked(crearProfesor).mockResolvedValue(profesor);
  vi.mocked(crearCursada).mockResolvedValue({ id: "c1", materiaId: "m1", anio: 2026, cuatrimestre: "ANUAL", createdAt: date, deletedAt: null });
  vi.mocked(crearMateria).mockResolvedValue(materia);
});
afterEach(cleanup);
function destination() { return new URL(String(nav.push.mock.calls.at(-1)?.[0]), "https://local.test"); }

describe("Retorno de altas administrativas por punto de entrada", () => {
  it("alta directa de profesor regresa a profesores con confirmación", async () => {
    render(<AltaProfesor />);
    await userEvent.type(screen.getByLabelText("Nombre completo"), profesor.nombreCompleto);
    await userEvent.click(screen.getByRole("button", { name: "Crear profesor" }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledTimes(1));
    expect(destination().pathname).toBe("/home/admin/profesores");
    expect(destination().searchParams.get("successMessage")).toContain("Profesor creado");
  });
  it("conserva búsqueda y página de profesores e informa cuando el alta no coincide", async () => {
    nav.query = new URLSearchParams({ returnTo: "/home/admin/profesores?q=Rossi&page=2" }).toString();
    render(<AltaProfesor />);
    await userEvent.type(screen.getByLabelText("Nombre completo"), profesor.nombreCompleto);
    await userEvent.click(screen.getByRole("button", { name: "Crear profesor" }));
    await waitFor(() => expect(nav.push).toHaveBeenCalled());
    expect(destination().pathname).toBe("/home/admin/profesores");
    expect(destination().searchParams.get("q")).toBe("Rossi");
    expect(destination().searchParams.get("page")).toBe("2");
    expect(destination().searchParams.get("creationOutsideFilters")).toBe("1");
  });
  it("espera confirmación; error conserva campos y reintento hace una sola operación", async () => {
    let resolve!: (value: typeof profesor) => void;
    vi.mocked(crearProfesor).mockRejectedValueOnce(new Error("Servicio no disponible")).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render(<AltaProfesor />);
    const input = screen.getByLabelText("Nombre completo") as HTMLInputElement;
    await userEvent.type(input, profesor.nombreCompleto);
    await userEvent.click(screen.getByRole("button", { name: "Crear profesor" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Servicio no disponible");
    expect(input.value).toBe(profesor.nombreCompleto);
    expect(nav.push).not.toHaveBeenCalled();
    const form = input.closest("form")!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(crearProfesor).toHaveBeenCalledTimes(2);
    expect(nav.push).not.toHaveBeenCalled();
    await act(async () => resolve(profesor));
    await waitFor(() => expect(nav.push).toHaveBeenCalledTimes(1));
  });
  it.each([
    ["", "/home/admin/cursadas"],
    [new URLSearchParams({ materiaId: "m1" }).toString(), "/home/admin/cursadas"],
    [new URLSearchParams({ returnTo: "/home/admin/cursadas?materiaId=m1&page=2" }).toString(), "/home/admin/cursadas"],
  ])("alta de período devuelve a su sección administrativa (%s)", async (query, path) => {
    nav.query = query;
    render(<AltaCursada />);
    await screen.findByRole("option", { name: materia.nombre });
    await userEvent.selectOptions(screen.getByLabelText("Materia"), "m1");
    await userEvent.type(screen.getByLabelText("Año"), "2026");
    await userEvent.selectOptions(screen.getByLabelText("Período"), "ANUAL");
    await userEvent.click(screen.getByRole("button", { name: "Crear cursada" }));
    await waitFor(() => expect(nav.push).toHaveBeenCalled());
    expect(destination().pathname).toBe(path);
    expect(destination().searchParams.get("materiaId")).toBe("m1");
    expect(destination().searchParams.get("successMessage")).toContain("Cursada creada");
  });
  it("alta de materia conserva filtros incompatibles y edición vuelve al detalle", async () => {
    nav.query = new URLSearchParams({ returnTo: "/home/admin/materias?carrera=Q&anioCarrera=3" }).toString();
    const view = render(<MateriaFormPage />);
    await userEvent.type(screen.getByLabelText("Nombre de la materia"), materia.nombre);
    await userEvent.selectOptions(screen.getByLabelText("Modalidad"), "ANUAL");
    await userEvent.selectOptions(screen.getByLabelText("Carreras"), "S");
    await userEvent.selectOptions(screen.getByLabelText("Año de la carrera"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Crear materia" }));
    await waitFor(() => expect(nav.push).toHaveBeenCalled());
    expect(destination().pathname).toBe("/home/admin/materias");
    expect(destination().searchParams.get("carrera")).toBe("Q");
    expect(destination().searchParams.get("creationOutsideFilters")).toBe("1");
    view.unmount(); nav.push.mockClear();
    vi.mocked(actualizarMateria).mockResolvedValue({ ...materia, nombre: "Nueva Álgebra" });
    render(<MateriaFormPage materia={materia} />);
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(actualizarMateria).not.toHaveBeenCalled();
    expect(nav.push).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText("Nombre de la materia"));
    await userEvent.type(screen.getByLabelText("Nombre de la materia"), "Nueva Álgebra");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(nav.push).toHaveBeenCalled());
    expect(destination().pathname).toBe("/home/admin/materias/m1");
    expect(destination().searchParams.get("returnTo")).toBe("/home/admin/materias?carrera=Q&anioCarrera=3");
  });
});
