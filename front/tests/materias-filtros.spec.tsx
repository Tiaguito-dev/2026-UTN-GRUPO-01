// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MateriasList } from "@/components/academic/MateriasList";
import { MateriaFormPage } from "@/components/admin/MateriaFormPage";
import { crearMateria, actualizarMateria, listarMaterias } from "@/services/materias";
import { materiaDetailHref, materiaListHref, isAnioCarrera } from "@/validations/materias";
import { regionOf } from "./support/region";

const { navigation, auth } = vi.hoisted(() => ({ navigation: { query: "", replace: vi.fn(), push: vi.fn() }, auth: { role: "USER" } }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useRouter: () => navigation, useSearchParams: () => new URLSearchParams(navigation.query) }));
vi.mock("@/services/materias", () => ({ listarMaterias: vi.fn(), crearMateria: vi.fn(), actualizarMateria: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { role: auth.role } }) }));
const materia = {
  modalidad: "ANUAL" as const,
  id: "m1",
  nombre: "Álgebra",
  carreras: [{ carrera: "S" as const, anioCarrera: "2" as const, nivelElectiva: null }],
  createdAt: "2026-01-01",
  deletedAt: null,
};
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); navigation.query = ""; auth.role = "USER"; });

// TASK-060: compact native filters are independent; results project unique page items by year.
describe("Catálogo de materias, filtros independientes y grupos", () => {
  it("año funciona sin carrera y cambia reiniciando solo la página", async () => {
    navigation.query = "anioCarrera=2&page=3&q=Plan";
    vi.mocked(listarMaterias).mockResolvedValue({ items: [], total: 0, page: 3, pageSize: 9 });
    render(<MateriasList />);
    const year = screen.getByRole("combobox", { name: "Año de la carrera" });
    expect((year as HTMLSelectElement).value).toBe("2");
    expect(screen.getByRole("combobox", { name: "Carrera" })).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Buscar por nombre" })).toBeTruthy();
    await waitFor(() => expect(listarMaterias).toHaveBeenCalledWith(expect.objectContaining({ anioCarrera: "2", carrera: undefined, page: 3, q: "Plan" })));
    expect(await screen.findByRole("button", { name: "Limpiar búsqueda y filtros" })).toBeTruthy();
    await userEvent.selectOptions(year, "3");
    expect(Object.fromEntries(new URL(navigation.replace.mock.calls.at(-1)![0], "http://local").searchParams)).toEqual({ anioCarrera: "3", q: "Plan" });
  });
  it("busca por envío explícito y Limpiar filtros borra los tres criterios y página", async () => {
    navigation.query = "carrera=S&anioCarrera=2&page=3&q=Plan";
    vi.mocked(listarMaterias).mockResolvedValue({ items: [], total: 0, page: 3, pageSize: 9 });
    render(<MateriasList />);
    const input = screen.getByLabelText("Buscar por nombre");
    await userEvent.clear(input); await userEvent.type(input, "Redes %_");
    expect(navigation.replace).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(Object.fromEntries(new URL(navigation.replace.mock.calls.at(-1)![0], "http://local").searchParams)).toEqual({ q: "Redes %_", carrera: "S", anioCarrera: "2" });
    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(navigation.replace).toHaveBeenLastCalledWith("/home/materias", { scroll: false });
  });
  it("cambiar o quitar carrera conserva año y búsqueda reiniciando página", async () => {
    navigation.query = "carrera=S&anioCarrera=2&page=3&q=Plan";
    vi.mocked(listarMaterias).mockResolvedValue({ items: [], total: 0, page: 3, pageSize: 9 });
    render(<MateriasList />);
    const career = screen.getByRole("combobox", { name: "Carrera" });
    await userEvent.selectOptions(career, "Q");
    expect(Object.fromEntries(new URL(navigation.replace.mock.calls.at(-1)![0], "http://local").searchParams)).toEqual({ carrera: "Q", anioCarrera: "2", q: "Plan" });
    await userEvent.selectOptions(career, "");
    expect(Object.fromEntries(new URL(navigation.replace.mock.calls.at(-1)![0], "http://local").searchParams)).toEqual({ anioCarrera: "2", q: "Plan" });
  });
  it("agrupa sin carrera; materia compartida aparece por año pero cuenta una sola vez", async () => {
    const shared = { ...materia, carreras: [{ carrera: "S" as const, anioCarrera: "1" as const, nivelElectiva: null }, { carrera: "Q" as const, anioCarrera: "2" as const, nivelElectiva: null }] };
    vi.mocked(listarMaterias).mockResolvedValue({ items: [shared], total: 1, page: 1, pageSize: 9 });
    render(<MateriasList />);
    const first = regionOf(await screen.findByRole("heading", { level: 2, name: /Primer año/ }));
    const second = regionOf(screen.getByRole("heading", { level: 2, name: /Segundo año/ }));
    expect(within(first).getByRole("link", { name: /Álgebra/ }).getAttribute("href")).toContain("/home/materias/m1");
    expect(within(first).getByText(/Sistemas/)).toBeTruthy();
    expect(within(first).queryByText(/Química/)).toBeNull();
    expect(within(second).getByText(/Química/)).toBeTruthy();
    expect(within(second).getByText(/Química.*2\.º año/)).toBeTruthy();
    expect(within(second).queryByText(/Sistemas/)).toBeNull();
    expect(screen.getAllByRole("link", { name: /Álgebra/ })).toHaveLength(2);
    expect(screen.getByText(/Mostrando 1–1 de 1/)).toBeTruthy();
    expect(screen.getByText(/se cuenta una sola vez/)).toBeTruthy();
  });
  it("año independiente proyecta solo asociaciones relevantes y Electivas muestra su nivel", async () => {
    navigation.query = "anioCarrera=ELECTIVA";
    vi.mocked(listarMaterias).mockResolvedValue({ items: [{ ...materia, carreras: [
      { carrera: "S", anioCarrera: "ELECTIVA", nivelElectiva: "4" }, { carrera: "Q", anioCarrera: "2", nivelElectiva: null },
    ] }], total: 1, page: 1, pageSize: 9 });
    render(<MateriasList />);
    const group = (await screen.findByRole("heading", { level: 2, name: /Electivas/ })).closest("section")!;
    expect(within(group).getByText(/Sistemas.*Electiva.*Nivel 4/)).toBeTruthy();
    expect(within(group).queryByText(/Química/)).toBeNull();
    expect(screen.queryByRole("heading", { level: 2, name: /Segundo año/ })).toBeNull();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
  });
  it("mantiene enlaces nativos y contexto al navegar y paginar nueve materias únicas", async () => {
    navigation.query = "anioCarrera=2&page=2&q=Plan";
    const items = [materia, ...Array.from({ length: 8 }, (_, index) => ({ ...materia, id: `otra${index}`, nombre: `Materia ${index}` }))];
    vi.mocked(listarMaterias).mockResolvedValue({ items, total: 22, page: 2, pageSize: 9 });
    render(<MateriasList />);
    const link = await screen.findByRole("link", { name: /Álgebra/ });
    expect(link.tagName).toBe("A");
    expect(Object.fromEntries(new URL(link.getAttribute("href")!, "http://local").searchParams)).toMatchObject({ anioCarrera: "2", listadoPage: "2", q: "Plan" });
    expect(screen.getByText(/Mostrando 10–18 de 22/)).toBeTruthy();
    const summary = screen.getByText(/22 materias/).textContent ?? "";
    expect(summary).toContain("Todas las carreras");
    expect(summary).toContain("Segundo año");
    expect(summary).toContain("Plan");
    await userEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(Object.fromEntries(new URL(navigation.replace.mock.calls.at(-1)![0], "http://local").searchParams)).toEqual({ anioCarrera: "2", page: "3", q: "Plan" });
  });
  it("genera rutas seguras y valida exclusivamente 1 a 5 o Electiva", () => {
    expect(materiaDetailHref("m/1", "S", "ELECTIVA", 3)).toBe("/home/materias/m%2F1?carrera=S&anioCarrera=ELECTIVA&listadoPage=3");
    expect(materiaListHref(undefined, "2", 1)).toBe("/home/materias?anioCarrera=2");
    expect(["1", "2", "3", "4", "5", "ELECTIVA"].every(isAnioCarrera)).toBe(true);
    expect([null, "0", "6", "2026", "Electiva", 1].some(isAnioCarrera)).toBe(false);
  });
  it("ordena alfabéticamente cada grupo visible y reúne carreras del mismo año en una fila", async () => {
    const carreras = [{ carrera: "S" as const, anioCarrera: "2" as const, nivelElectiva: null }, { carrera: "Q" as const, anioCarrera: "2" as const, nivelElectiva: null }];
    vi.mocked(listarMaterias).mockResolvedValue({ items: [{ ...materia, id: "z", nombre: "Zoología", carreras }, { ...materia, id: "a", nombre: "Álgebra", carreras }], total: 2, page: 1, pageSize: 9 });
    render(<MateriasList />);
    const group = (await screen.findByRole("heading", { name: "Segundo año" })).closest("section")!;
    const links = within(group).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links.map(link => link.textContent)).toEqual([expect.stringContaining("Álgebra"), expect.stringContaining("Zoología")]);
    expect(links[0].textContent).toContain("Sistemas · 2.º año");
    expect(links[0].textContent).toContain("Química · 2.º año");
  });
});
describe("Listado de materias, rediseño (TASK-043)", () => {
  // jsdom does not implement showModal()/close(); same stub as ui-dialog.spec.tsx.
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
      this.querySelector<HTMLElement>("button, input, select, textarea, a[href]")?.focus();
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  });

  const dialogClosed = () => {
    const dialog = document.querySelector("dialog");
    return dialog === null || !dialog.open;
  };

  it("cada grupo de año tiene su h2 y la cantidad de materias", async () => {
    navigation.query = "carrera=S";
    const de = (id: string, anioCarrera: "1" | "2") => ({ ...materia, id, nombre: `Materia ${id}`, carreras: [{ carrera: "S" as const, anioCarrera, nivelElectiva: null }] });
    vi.mocked(listarMaterias).mockResolvedValue({ items: [de("a", "1"), de("b", "1"), de("c", "2"), de("d", "2"), de("e", "2")], total: 5, page: 1, pageSize: 9 });
    render(<MateriasList />);
    const primero = regionOf(await screen.findByRole("heading", { level: 2, name: /Primer año/ }));
    const segundo = regionOf(screen.getByRole("heading", { level: 2, name: /Segundo año/ }));
    expect(within(primero).getByText("2 materias")).toBeTruthy();
    expect(within(segundo).getByText("3 materias")).toBeTruthy();
  });

  it("un usuario común no ve Nueva materia", async () => {
    vi.mocked(listarMaterias).mockResolvedValue({ items: [materia], total: 1, page: 1, pageSize: 9 });
    render(<MateriasList />);
    await screen.findByRole("link", { name: /Álgebra/ });
    expect(screen.queryByRole("button", { name: "Nueva materia" })).toBeNull();
  });

  it("ADMIN: Nueva materia abre el diálogo; al crear, cierra, avisa y recarga el listado", async () => {
    auth.role = "ADMIN";
    vi.mocked(listarMaterias).mockResolvedValue({ items: [materia], total: 1, page: 1, pageSize: 9 });
    vi.mocked(crearMateria).mockResolvedValue({ ...materia, id: "m2", nombre: "Sintaxis" });
    render(<MateriasList />);
    await screen.findByRole("link", { name: /Álgebra/ });
    const pedidos = vi.mocked(listarMaterias).mock.calls.length;

    await userEvent.click(screen.getByRole("button", { name: "Nueva materia" }));
    const dialog = screen.getByRole("dialog", { name: "Nueva materia" });
    expect((dialog as HTMLDialogElement).open).toBe(true);

    await userEvent.type(within(dialog).getByLabelText("Nombre de la materia"), "Sintaxis");
    await userEvent.selectOptions(within(dialog).getByLabelText("Modalidad"), "ANUAL");
    await userEvent.selectOptions(within(dialog).getByRole("listbox", { name: "Carreras" }), "S");
    await userEvent.selectOptions(within(dialog).getByLabelText("Año de la carrera"), "2");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear materia" }));

    expect(crearMateria).toHaveBeenCalledWith({ nombre: "Sintaxis", modalidad: "ANUAL", carreras: [{ carrera: "S", anioCarrera: "2", nivelElectiva: null }] });
    await waitFor(() => expect(dialogClosed()).toBe(true));
    await waitFor(() => expect(screen.getAllByRole("status").some((status) => status.textContent?.includes("Sintaxis"))).toBe(true));
    await waitFor(() => expect(vi.mocked(listarMaterias).mock.calls.length).toBeGreaterThan(pedidos));
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("ADMIN: Cancelar cierra el diálogo sin crear ni recargar", async () => {
    auth.role = "ADMIN";
    vi.mocked(listarMaterias).mockResolvedValue({ items: [materia], total: 1, page: 1, pageSize: 9 });
    render(<MateriasList />);
    await screen.findByRole("link", { name: /Álgebra/ });
    const pedidos = vi.mocked(listarMaterias).mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: "Nueva materia" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Nueva materia" })).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(dialogClosed()).toBe(true));
    expect(crearMateria).not.toHaveBeenCalled();
    expect(vi.mocked(listarMaterias).mock.calls.length).toBe(pedidos);
  });
});

describe("Formulario de materia", () => {
  it("exige al menos una carrera antes de llamar al backend", async () => {
    render(<MateriaFormPage />);
    await userEvent.type(screen.getByLabelText("Nombre de la materia"), "Materia");
    await userEvent.selectOptions(screen.getByLabelText("Modalidad"), "ANUAL");
    await userEvent.selectOptions(screen.getByLabelText("Año de la carrera"), "1");
    fireEvent.submit(screen.getByRole("button", { name: "Crear materia" }).closest("form")!);
    expect(screen.getByText("Elegí al menos una carrera.")).toBeTruthy();
    expect(crearMateria).not.toHaveBeenCalled();
  });

  it("crea electiva con carreras y vuelve al listado con mensaje visible", async () => {
    vi.mocked(crearMateria).mockResolvedValue(materia);
    render(<MateriaFormPage />);
    await userEvent.selectOptions(screen.getByLabelText("Modalidad"), "ANUAL");
    await userEvent.type(screen.getByLabelText("Nombre de la materia"), "Materia");
    await userEvent.selectOptions(screen.getByRole("listbox", { name: "Carreras" }), "S");
    await userEvent.selectOptions(screen.getByLabelText("Año de la carrera"), "ELECTIVA");
    await userEvent.click(screen.getByRole("button", { name: "Crear materia" }));
    expect(crearMateria).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nivel de electiva").getAttribute("aria-invalid")).toBe("true");
    await userEvent.selectOptions(screen.getByLabelText("Nivel de electiva"), "4");
    await userEvent.click(screen.getByRole("button", { name: "Crear materia" }));
    expect(crearMateria).toHaveBeenCalledWith({
      nombre: "Materia",
      modalidad: "ANUAL",
      carreras: [{ carrera: "S", anioCarrera: "ELECTIVA", nivelElectiva: "4" }],
    });
    expect(navigation.push.mock.calls[0][0]).toMatch(/^\/home\/materias\?successMessage=/);
  });

  it("no envía una edición sin cambios y luego envía carreras modificadas", async () => {
    vi.mocked(actualizarMateria).mockResolvedValue(materia);
    render(<MateriaFormPage materia={materia} detailHref="/home/materias/m1?carrera=S&anioCarrera=2" />);
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(actualizarMateria).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("No hay cambios");
    await userEvent.selectOptions(screen.getByLabelText("Año de la carrera"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(actualizarMateria).toHaveBeenCalledWith("m1", {
      carreras: [{ carrera: "S", anioCarrera: "3", nivelElectiva: null }],
    });
    expect(navigation.push.mock.calls[0][0]).toMatch(/^\/home\/materias\/m1\?carrera=S&anioCarrera=2&successMessage=/);
  });
});
