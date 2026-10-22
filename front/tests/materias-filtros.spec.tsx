// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MateriasList } from "@/components/academic/MateriasList";
import { MateriaForm } from "@/components/admin/MateriaForm";
import { crearMateria, actualizarMateria, listarMaterias } from "@/services/materias";
import { materiaDetailHref, materiaListHref, isAnioCarrera } from "@/validations/materias";

const { navigation } = vi.hoisted(() => ({ navigation: { query: "", replace: vi.fn(), push: vi.fn() } }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useRouter: () => navigation, useSearchParams: () => new URLSearchParams(navigation.query) }));
vi.mock("@/services/materias", () => ({ listarMaterias: vi.fn(), crearMateria: vi.fn(), actualizarMateria: vi.fn() }));
const materia = { id: "m1", nombre: "Álgebra", anioCarrera: "2" as const, createdAt: "2026-01-01", nivelElectiva: null, deletedAt: null };
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); navigation.query = ""; });

describe("Filtro de materias y contexto de navegación", () => {
  it("busca explícitamente y limpia texto conservando año y nivel, reiniciando página", async () => {
    navigation.query = "anioCarrera=ELECTIVA&nivelElectiva=4&page=3&q=Plan";
    vi.mocked(listarMaterias).mockResolvedValue({ items: [], total: 0, page: 3, pageSize: 9 });
    render(<MateriasList />);
    const input = screen.getByLabelText("Buscar por nombre");
    await userEvent.clear(input); await userEvent.type(input, "Redes %_");
    expect(navigation.replace).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    const searched = new URL(navigation.replace.mock.calls.at(-1)![0], "http://local").searchParams;
    expect(Object.fromEntries(searched)).toEqual({ q: "Redes %_", anioCarrera: "ELECTIVA", nivelElectiva: "4" });
    await userEvent.click(screen.getByRole("button", { name: /Limpiar/ }));
    const cleared = new URL(navigation.replace.mock.calls.at(-1)![0], "http://local").searchParams;
    expect(Object.fromEntries(cleared)).toEqual({ anioCarrera: "ELECTIVA", nivelElectiva: "4" });
  });
  it("habilita nivel solo para Electivas y lo elimina al elegir un año obligatorio", async () => {
    navigation.query = "anioCarrera=ELECTIVA&nivelElectiva=4&page=2&q=Plan";
    vi.mocked(listarMaterias).mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 9 });
    const view = render(<MateriasList />);
    expect(screen.getByRole("button", { name: "Electivas" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "4.º Nivel" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "5.º Nivel" }));
    expect(Object.fromEntries(new URL(navigation.replace.mock.calls.at(-1)![0], "http://local").searchParams)).toEqual({ anioCarrera: "ELECTIVA", nivelElectiva: "5", q: "Plan" });
    await userEvent.click(screen.getByRole("button", { name: "2.º año" }));
    navigation.query = new URL(navigation.replace.mock.calls.at(-1)![0], "http://local").search;
    view.rerender(<MateriasList />);
    expect(screen.queryByRole("group", { name: "Nivel de electiva" })).toBeNull();
    expect(Object.fromEntries(new URLSearchParams(navigation.query))).toEqual({ anioCarrera: "2", q: "Plan" });
  });
  it("conserva texto, nivel y página al abrir el detalle y paginar", async () => {
    navigation.query = "anioCarrera=ELECTIVA&nivelElectiva=4&page=2&q=Plan";
    vi.mocked(listarMaterias).mockResolvedValue({ items: [{ ...materia, anioCarrera: "ELECTIVA", nivelElectiva: "4" }], total: 22, page: 2, pageSize: 9 });
    render(<MateriasList />);
    const href = (await screen.findByRole("link", { name: "Álgebra" })).getAttribute("href")!;
    expect(Object.fromEntries(new URL(href, "http://local").searchParams)).toEqual({ anioCarrera: "ELECTIVA", nivelElectiva: "4", listadoPage: "2", q: "Plan" });
    expect(listarMaterias).toHaveBeenCalledWith({ page: 2, anioCarrera: "ELECTIVA", nivelElectiva: "4", q: "Plan" });
    await userEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(Object.fromEntries(new URL(navigation.replace.mock.calls.at(-1)![0], "http://local").searchParams)).toEqual({ anioCarrera: "ELECTIVA", nivelElectiva: "4", page: "3", q: "Plan" });
  });
  it("presenta grupos del primero al quinto, luego Electiva y materias heredadas", async () => {
    const years = [null, "ELECTIVA", "5", "4", "3", "2", "1"] as const;
    vi.mocked(listarMaterias).mockResolvedValue({ items: years.map((anioCarrera, index) => ({ ...materia, id: `m${index}`, nombre: `Materia ${index}`, anioCarrera })), total: 7, page: 1, pageSize: 9 });
    render(<MateriasList />);
    await screen.findByRole("link", { name: "Materia 0" });
    expect(screen.getAllByRole("heading", { level: 2 }).map(heading => heading.textContent)).toEqual(["1.º año", "2.º año", "3.º año", "4.º año", "5.º año", "Electiva", "Sin año asignado"]);
  });
  it("carga el filtro y la página desde URL, conservándolos en el vínculo al detalle", async () => {
    navigation.query = "anioCarrera=2&page=2";
    vi.mocked(listarMaterias).mockResolvedValue({ items: [materia], total: 12, page: 2, pageSize: 9 });
    render(<MateriasList />);
    expect(screen.getByRole("button", { name: "2.º año" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Todos los años" }).getAttribute("aria-pressed")).toBe("false");
    expect((await screen.findByRole("link", { name: "Álgebra" })).getAttribute("href")).toBe("/home/materias/m1?anioCarrera=2&listadoPage=2");
    expect(listarMaterias).toHaveBeenCalledWith({ page: 2, anioCarrera: "2" });
    expect(materiaListHref("2", 2)).toBe("/home/materias?anioCarrera=2&page=2");
  });
  it("cambiar el año reinicia la página y permite volver a todos", async () => {
    navigation.query = "anioCarrera=2&page=3";
    vi.mocked(listarMaterias).mockResolvedValue({ items: [], total: 0, page: 3, pageSize: 9 });
    render(<MateriasList />);
    await userEvent.click(screen.getByRole("button", { name: "Electivas" }));
    expect(navigation.replace).toHaveBeenLastCalledWith("/home/materias?anioCarrera=ELECTIVA", { scroll: false });
    await userEvent.click(screen.getByRole("button", { name: "Todos los años" }));
    expect(navigation.replace).toHaveBeenLastCalledWith("/home/materias", { scroll: false });
  });
  it("pagina sin perder el año elegido", async () => {
    navigation.query = "anioCarrera=2";
    vi.mocked(listarMaterias).mockResolvedValue({ items: [materia], total: 12, page: 1, pageSize: 9 });
    render(<MateriasList />);
    await userEvent.click(await screen.findByRole("button", { name: "Página siguiente" }));
    expect(navigation.replace).toHaveBeenCalledWith("/home/materias?anioCarrera=2&page=2", { scroll: false });
  });
  it("genera rutas seguras y valida exclusivamente 1 a 5 o Electiva", () => {
    expect(materiaDetailHref("m/1", "ELECTIVA", 3)).toBe("/home/materias/m%2F1?anioCarrera=ELECTIVA&listadoPage=3");
    expect(["1", "2", "3", "4", "5", "ELECTIVA"].every(isAnioCarrera)).toBe(true);
    expect([null, "0", "6", "2026", "Electiva", 1].some(isAnioCarrera)).toBe(false);
  });
});

describe("Formulario de materia", () => {
  it("exige año antes de llamar al backend y enfoca el control", async () => {
    render(<MateriaForm />);
    await userEvent.type(screen.getByLabelText("Nombre de la materia"), "Materia");
    fireEvent.submit(screen.getByRole("button", { name: "Crear materia" }).closest("form")!);
    expect(screen.getByLabelText("Año de la carrera").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(screen.getByLabelText("Año de la carrera"));
    expect(crearMateria).not.toHaveBeenCalled();
  });
  it("crea electiva y vuelve al listado con mensaje visible", async () => {
    vi.mocked(crearMateria).mockResolvedValue(materia);
    render(<MateriaForm />);
    await userEvent.type(screen.getByLabelText("Nombre de la materia"), "Materia");
    await userEvent.selectOptions(screen.getByLabelText("Año de la carrera"), "ELECTIVA");
    await userEvent.click(screen.getByRole("button", { name: "Crear materia" }));
    expect(crearMateria).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nivel de electiva").getAttribute("aria-invalid")).toBe("true");
    await userEvent.selectOptions(screen.getByLabelText("Nivel de electiva"), "4");
    await userEvent.click(screen.getByRole("button", { name: "Crear materia" }));
    expect(crearMateria).toHaveBeenCalledWith({ nombre: "Materia", anioCarrera: "ELECTIVA", nivelElectiva: "4" });
    expect(navigation.push.mock.calls[0][0]).toMatch(/^\/home\/materias\?successMessage=/);
  });
  it("no envía una edición sin cambios y luego envía solo el año modificado", async () => {
    vi.mocked(actualizarMateria).mockResolvedValue(materia);
    render(<MateriaForm materia={materia} detailHref="/home/materias/m1?anioCarrera=2" />);
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(actualizarMateria).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("No hay cambios");
    await userEvent.selectOptions(screen.getByLabelText("Año de la carrera"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(actualizarMateria).toHaveBeenCalledWith("m1", { anioCarrera: "3" });
    expect(navigation.push.mock.calls[0][0]).toMatch(/^\/home\/materias\/m1\?anioCarrera=2&successMessage=/);
  });
});
