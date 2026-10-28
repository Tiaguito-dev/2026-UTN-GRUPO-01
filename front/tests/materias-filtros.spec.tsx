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
  id: "m1",
  nombre: "Álgebra",
  carreras: [{ carrera: "S" as const, anioCarrera: "2" as const, nivelElectiva: null }],
  createdAt: "2026-01-01",
  deletedAt: null,
};
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); navigation.query = ""; auth.role = "USER"; });

describe("Filtro de materias y contexto de navegación", () => {
  it("busca explícitamente y limpia texto conservando carrera, año y nivel, reiniciando página", async () => {
    navigation.query = "carrera=S&anioCarrera=ELECTIVA&nivelElectiva=4&page=3&q=Plan";
    vi.mocked(listarMaterias).mockResolvedValue({ items: [], total: 0, page: 3, pageSize: 9 });
    render(<MateriasList />);
    const input = screen.getByLabelText("Buscar por nombre");
    await userEvent.clear(input); await userEvent.type(input, "Redes %_");
    expect(navigation.replace).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    const searched = new URL(navigation.replace.mock.calls.at(-1)![0], "http://local").searchParams;
    expect(Object.fromEntries(searched)).toEqual({ q: "Redes %_", carrera: "S", anioCarrera: "ELECTIVA", nivelElectiva: "4" });
    await userEvent.click(screen.getByRole("button", { name: /Limpiar/ }));
    const cleared = new URL(navigation.replace.mock.calls.at(-1)![0], "http://local").searchParams;
    expect(Object.fromEntries(cleared)).toEqual({ carrera: "S", anioCarrera: "ELECTIVA", nivelElectiva: "4" });
  });

  it("los chips de año y electiva solo aparecen con una carrera elegida", async () => {
    navigation.query = "";
    vi.mocked(listarMaterias).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 9 });
    const view = render(<MateriasList />);
    expect(screen.queryByRole("group", { name: "Año de la carrera" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Sistemas" }));
    expect(navigation.replace).toHaveBeenCalledWith("/home/materias?carrera=S", { scroll: false });

    navigation.query = "carrera=S";
    view.rerender(<MateriasList />);
    expect(screen.getByRole("group", { name: "Año de la carrera" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Nivel de electiva" })).toBeNull();
  });

  it("habilita nivel solo para Electivas y lo elimina al elegir un año obligatorio", async () => {
    navigation.query = "carrera=S&anioCarrera=ELECTIVA&nivelElectiva=4&page=2&q=Plan";
    vi.mocked(listarMaterias).mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 9 });
    const view = render(<MateriasList />);
    expect(screen.getByRole("button", { name: "Electivas" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "4.º Nivel" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "5.º Nivel" }));
    expect(Object.fromEntries(new URL(navigation.replace.mock.calls.at(-1)![0], "http://local").searchParams)).toEqual({ carrera: "S", anioCarrera: "ELECTIVA", nivelElectiva: "5", q: "Plan" });
    await userEvent.click(screen.getByRole("button", { name: "2.º año" }));
    navigation.query = new URL(navigation.replace.mock.calls.at(-1)![0], "http://local").search;
    view.rerender(<MateriasList />);
    expect(screen.queryByRole("group", { name: "Nivel de electiva" })).toBeNull();
    expect(Object.fromEntries(new URLSearchParams(navigation.query))).toEqual({ carrera: "S", anioCarrera: "2", q: "Plan" });
  });

  it("conserva carrera, texto, nivel y página al abrir el detalle y paginar", async () => {
    navigation.query = "carrera=S&anioCarrera=ELECTIVA&nivelElectiva=4&page=2&q=Plan";
    vi.mocked(listarMaterias).mockResolvedValue({ items: [{ ...materia, carreras: [{ carrera: "S", anioCarrera: "ELECTIVA", nivelElectiva: "4" }] }], total: 22, page: 2, pageSize: 9 });
    render(<MateriasList />);
    const href = (await screen.findByRole("link", { name: /Álgebra/ })).getAttribute("href")!;
    expect(Object.fromEntries(new URL(href, "http://local").searchParams)).toEqual({ carrera: "S", anioCarrera: "ELECTIVA", nivelElectiva: "4", listadoPage: "2", q: "Plan" });
    expect(listarMaterias).toHaveBeenCalledWith({ page: 2, carrera: "S", anioCarrera: "ELECTIVA", nivelElectiva: "4", q: "Plan" });
    await userEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(Object.fromEntries(new URL(navigation.replace.mock.calls.at(-1)![0], "http://local").searchParams)).toEqual({ carrera: "S", anioCarrera: "ELECTIVA", nivelElectiva: "4", page: "3", q: "Plan" });
  });

  it("con una carrera elegida presenta grupos por año", async () => {
    const years = [null, "ELECTIVA", "5", "4", "3", "2", "1"] as const;
    navigation.query = "carrera=S";
    vi.mocked(listarMaterias).mockResolvedValue({
      items: years.map((anioCarrera, index) => ({
        ...materia,
        id: `m${index}`,
        nombre: `Materia ${index}`,
        carreras: anioCarrera ? [{ carrera: "S" as const, anioCarrera, nivelElectiva: null }] : [],
      })),
      total: 7,
      page: 1,
      pageSize: 9,
    });
    render(<MateriasList />);
    await screen.findByRole("link", { name: "Materia 0" });
    // TASK-043: the h2 may also carry the numeric year badge, so each heading contains its label in order.
    const labels = ["1.º año", "2.º año", "3.º año", "4.º año", "5.º año", "Electiva", "Sin año asignado"];
    const texts = screen.getAllByRole("heading", { level: 2 }).map(heading => heading.textContent ?? "");
    expect(texts).toHaveLength(labels.length);
    labels.forEach((label, index) => expect(texts[index]).toContain(label));
  });

  it("sin carrera elegida (Todas) muestra la lista sin grupos de año", async () => {
    navigation.query = "";
    vi.mocked(listarMaterias).mockResolvedValue({
      items: [
        { id: "m1", nombre: "Álgebra", carreras: [{ carrera: "S" as const, anioCarrera: "1" as const, nivelElectiva: null }], createdAt: "", deletedAt: null },
      ],
      total: 1,
      page: 1,
      pageSize: 9,
    });
    render(<MateriasList />);
    await screen.findByRole("link", { name: /Álgebra/ });
    expect(screen.queryAllByRole("heading", { level: 2 }).length).toBe(0);
    expect(screen.getByText("— Solo Sistemas")).toBeTruthy();
  });

  it("cambiar la carrera reinicia año y página", async () => {
    navigation.query = "carrera=S&anioCarrera=2&page=3";
    vi.mocked(listarMaterias).mockResolvedValue({ items: [], total: 0, page: 3, pageSize: 9 });
    render(<MateriasList />);
    await userEvent.click(screen.getByRole("button", { name: "Química" }));
    expect(navigation.replace).toHaveBeenLastCalledWith("/home/materias?carrera=Q", { scroll: false });
    await userEvent.click(screen.getByRole("button", { name: "Todas" }));
    expect(navigation.replace).toHaveBeenLastCalledWith("/home/materias", { scroll: false });
  });

  it("genera rutas seguras y valida exclusivamente 1 a 5 o Electiva", () => {
    expect(materiaDetailHref("m/1", "S", "ELECTIVA", 3)).toBe("/home/materias/m%2F1?carrera=S&anioCarrera=ELECTIVA&listadoPage=3");
    expect(["1", "2", "3", "4", "5", "ELECTIVA"].every(isAnioCarrera)).toBe(true);
    expect([null, "0", "6", "2026", "Electiva", 1].some(isAnioCarrera)).toBe(false);
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
    const primero = regionOf(await screen.findByRole("heading", { level: 2, name: /1\.º año/ }));
    const segundo = regionOf(screen.getByRole("heading", { level: 2, name: /2\.º año/ }));
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
    await userEvent.selectOptions(within(dialog).getByRole("listbox", { name: "Carreras" }), "S");
    await userEvent.selectOptions(within(dialog).getByLabelText("Año de la carrera"), "2");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear materia" }));

    expect(crearMateria).toHaveBeenCalledWith({ nombre: "Sintaxis", carreras: [{ carrera: "S", anioCarrera: "2", nivelElectiva: null }] });
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
    await userEvent.selectOptions(screen.getByLabelText("Año de la carrera"), "1");
    fireEvent.submit(screen.getByRole("button", { name: "Crear materia" }).closest("form")!);
    expect(screen.getByText("Elegí al menos una carrera.")).toBeTruthy();
    expect(crearMateria).not.toHaveBeenCalled();
  });

  it("crea electiva con carreras y vuelve al listado con mensaje visible", async () => {
    vi.mocked(crearMateria).mockResolvedValue(materia);
    render(<MateriaFormPage />);
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
