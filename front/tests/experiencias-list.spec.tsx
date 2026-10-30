// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExperienciasList } from "@/components/feedback/ExperienciasList";
import { listarFeedback } from "@/services/feedback";
import type { Feedback } from "@/types/feedback";
import { listarMaterias, obtenerMateria } from "@/services/materias";
const { replace, push, route } = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), route: { query: "", pathname: "/home/experiencias" } }));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => route.pathname.startsWith("/home/admin") }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname, useSearchParams: () => new URLSearchParams(route.query), useRouter: () => ({ replace, push }) }));
vi.mock("@/services/feedback", () => ({ listarFeedback: vi.fn() }));
vi.mock("@/services/materias", () => ({ listarMaterias: vi.fn(), obtenerMateria: vi.fn() }));
const materia = { id: "mat1", nombre: "Álgebra", modalidad: null, carreras: [{ carrera: "S" as const, anioCarrera: "1" as const, nivelElectiva: null }], createdAt: "2026-01-01", deletedAt: null };
const item: Feedback = { id: "f1", texto: "Buena experiencia\ncon ejemplos", anonimo: true, autor: null, propio: false, profesor: null, contexto: { comisionId: "com1", nombre: "S-21", materiaId: "mat1", materiaNombre: "Álgebra", cursadaId: "cur1", anio: 2026, cuatrimestre: "SEGUNDO" }, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
beforeEach(() => { vi.clearAllMocks(); route.query = ""; route.pathname = "/home/experiencias"; vi.mocked(obtenerMateria).mockResolvedValue(materia); vi.mocked(listarMaterias).mockResolvedValue({ items: [materia], total: 1, page: 1, pageSize: 9 }); vi.mocked(listarFeedback).mockResolvedValue({ items: [item], total: 10, page: 1, pageSize: 9 }); });
afterEach(cleanup);
describe("Experiencias generales", () => {
  it("administración consulta el feed público sin invitar a participar ni revelar identidades anónimas", async () => {
    route.pathname = "/home/admin/experiencias";
    route.query = "carrera=S&materiaId=mat1&page=2";
    vi.mocked(listarFeedback).mockResolvedValue({ items: [{ ...item, propio: true, autor: { displayName: "Autor confidencial" } }], total: 10, page: 2, pageSize: 9 });
    render(<ExperienciasList administrative />);
    expect(await screen.findByText(/Buena experiencia/)).toBeTruthy();
    expect(listarFeedback).toHaveBeenCalledWith({ page: 2, pageSize: 9, carrera: "S", materiaId: "mat1" });
    expect(screen.getByText("Anónimo")).toBeTruthy();
    expect(screen.queryByText("Autor confidencial")).toBeNull();
    expect(screen.queryByText(/Para compartir tu experiencia/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Administrar mi comentario" })).toBeNull();
    expect(document.querySelector('a[href^="/home/feedback"]')).toBeNull();
    const breadcrumb = screen.getByRole("navigation", { name: "Ubicación actual" });
    expect(breadcrumb.textContent).toMatch(/Administración.*Experiencias/);
    for (const [name, expected] of [["Álgebra", "/home/admin/materias/mat1"], [/Ver comisión/, "/home/admin/comisiones/com1"]] as const) {
      const target = new URL(screen.getByRole("link", { name }).getAttribute("href")!, "https://local.test");
      expect(target.pathname).toBe(expected);
      // TASK-admin-navigation-context: la materia abre explícitamente su gestión académica.
      expect(target.searchParams.get("returnTo")).toBe(expected.includes("/comisiones/") ? "/home/admin/experiencias?carrera=S&materiaId=mat1&page=2" : null);
    }
  });

  it("los filtros, la paginación y su limpieza permanecen en administración", async () => {
    route.pathname = "/home/admin/experiencias";
    route.query = "carrera=S&materiaId=mat1";
    render(<ExperienciasList administrative />);
    await screen.findByText(/Buena experiencia/);
    await userEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(replace).toHaveBeenLastCalledWith("/home/admin/experiencias?carrera=S&materiaId=mat1&page=2", { scroll: false });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Carrera" }), "I");
    await waitFor(() => expect(replace).toHaveBeenLastCalledWith("/home/admin/experiencias?carrera=I", { scroll: false }));
    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(replace).toHaveBeenLastCalledWith("/home/admin/experiencias", { scroll: false });
  });

  it("seleccionar materia sin carrera también conserva la ruta administrativa", async () => {
    route.pathname = "/home/admin/experiencias";
    render(<ExperienciasList administrative />);
    await userEvent.click(screen.getByText("Todas las materias"));
    await userEvent.click(await screen.findByRole("button", { name: "Álgebra" }));
    expect(replace).toHaveBeenLastCalledWith("/home/admin/experiencias?materiaId=mat1", { scroll: false });
  });

  it("combina filtros desde URL, conserva página y regreso en enlaces y administración", async () => {
    route.query = "carrera=S&materiaId=mat1&page=2";
    vi.mocked(listarFeedback).mockResolvedValue({ items: [{ ...item, propio: true }], total: 10, page: 2, pageSize: 9 });
    render(<ExperienciasList />);
    expect(await screen.findByText(/Buena experiencia/)).toBeTruthy();
    expect(listarFeedback).toHaveBeenCalledWith({ page: 2, pageSize: 9, carrera: "S", materiaId: "mat1" });
    expect(screen.getByText(/Mostrando 10–10/)).toBeTruthy();
    const href = screen.getByRole("link", { name: /Ver comisión/ }).getAttribute("href")!;
    const query = new URL(href, "http://local").searchParams;
    expect(Object.fromEntries(query)).toMatchObject({ origen: "experiencias", experienciasCarrera: "S", experienciasMateriaId: "mat1", experienciasPage: "2" });
    await userEvent.click(screen.getByRole("button", { name: "Administrar mi comentario" }));
    expect(String(push.mock.calls.at(-1)?.[0])).toContain("experienciasMateriaId=mat1");
    expect(screen.getByText("Anónimo")).toBeTruthy();
    expect(screen.queryByText(/Autor confidencial/)).toBeNull();
  });
  it("busca materias sin carrera y permite seleccionar sin descargar el catálogo", async () => {
    render(<ExperienciasList />);
    await userEvent.click(screen.getByText("Todas las materias"));
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar materia por nombre" }), "algebra");
    await waitFor(() => expect(listarMaterias).toHaveBeenLastCalledWith({ page: 1, pageSize: 9, carrera: undefined, q: "algebra" }));
    await userEvent.click(await screen.findByRole("button", { name: "Álgebra" }));
    expect(String(replace.mock.calls.at(-1)?.[0])).toBe("/home/experiencias?materiaId=mat1");
  });
  it.each([true, false])("al cambiar carrera conserva materia solo si es compatible: %s", async (compatible) => {
    route.query = "carrera=S&materiaId=mat1&page=3";
    vi.mocked(obtenerMateria).mockResolvedValue({ ...materia, carreras: compatible ? [...materia.carreras, { carrera: "I", anioCarrera: "2", nivelElectiva: null }] : materia.carreras });
    render(<ExperienciasList />);
    await screen.findByText(/Buena experiencia/);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Carrera" }), "I");
    await waitFor(() => expect(String(replace.mock.calls.at(-1)?.[0])).toBe(`/home/experiencias?carrera=I${compatible ? "&materiaId=mat1" : ""}`));
  });
  it("actualiza la consulta al cambiar la URL y mantiene filtros al paginar o limpiar", async () => {
    route.query = "carrera=S&materiaId=mat1";
    const view = render(<ExperienciasList />);
    await screen.findByText(/Buena experiencia/);
    await userEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(String(replace.mock.calls.at(-1)?.[0])).toBe("/home/experiencias?carrera=S&materiaId=mat1&page=2");
    route.query = "carrera=I";
    view.rerender(<ExperienciasList />);
    await waitFor(() => expect(listarFeedback).toHaveBeenLastCalledWith({ page: 1, pageSize: 9, carrera: "I", materiaId: undefined }));
    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(replace).toHaveBeenLastCalledWith("/home/experiencias", { scroll: false });
  });
  it("limita las opciones de materia a la carrera y maneja paginación y errores del selector", async () => {
    route.query = "carrera=I";
    vi.mocked(listarMaterias).mockRejectedValueOnce(new Error("Sin conexión"));
    render(<ExperienciasList />);
    await userEvent.click(screen.getByText("Todas las materias"));
    await userEvent.click(await screen.findByRole("button", { name: "Reintentar materias" }));
    expect(await screen.findByRole("button", { name: "Álgebra" })).toBeTruthy();
    expect(listarMaterias).toHaveBeenLastCalledWith({ page: 1, pageSize: 9, carrera: "I", q: "" });
    vi.mocked(listarMaterias).mockResolvedValue({ items: [materia], total: 10, page: 1, pageSize: 9 });
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar materia por nombre" }), "a");
    await userEvent.click(await screen.findByRole("button", { name: "Más materias" }));
    await waitFor(() => expect(listarMaterias).toHaveBeenLastCalledWith({ page: 2, pageSize: 9, carrera: "I", q: "a" }));
  });
  it("permite operar el selector por teclado, cierra con Escape y devuelve el foco", async () => {
    render(<ExperienciasList />);
    const summary = screen.getByText("Todas las materias").closest("summary")!;
    summary.focus();
    // jsdom no simula la activación nativa por Enter de <summary>; apertura nativa por clic.
    await userEvent.click(summary);
    await screen.findByRole("searchbox", { name: "Buscar materia por nombre" });
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("searchbox", { name: "Buscar materia por nombre" }));
    await userEvent.keyboard("{Escape}");
    expect(summary.closest("details")?.open).toBe(false);
    expect(document.activeElement).toBe(summary);
  });
  it("muestra vacío filtrado y permite limpiar sin cambiar automáticamente la selección", async () => {
    route.query = "carrera=Q&materiaId=mat1";
    vi.mocked(listarFeedback).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 9 });
    render(<ExperienciasList />);
    expect(await screen.findByText("No hay experiencias para estos filtros.")).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "Carrera" }) as HTMLSelectElement).value).toBe("Q");
    expect(replace).not.toHaveBeenCalled();
    await userEvent.click(screen.getAllByRole("button", { name: "Limpiar filtros" }).at(-1)!);
    expect(replace).toHaveBeenLastCalledWith("/home/experiencias", { scroll: false });
  });
  it("conserva nombre público, carrera real, destinatario y texto largo sin alterar el contenido", async () => {
    const text = `Primera línea\n${"palabra".repeat(400)}`;
    vi.mocked(listarFeedback).mockResolvedValue({ items: [{ ...item, texto: text, anonimo: false, autor: { displayName: "Nombre público" }, contexto: { ...item.contexto, carrera: "I" }, profesor: { id: "p1", nombreCompleto: "Docente de nombre extenso", cargo: "JTP" } }], total: 1, page: 1, pageSize: 9 });
    render(<ExperienciasList />);
    const article = (await screen.findByRole("article", { name: "Comentario de Nombre público" }));
    expect(article.textContent).toContain(text);
    expect(article.textContent).toContain("Ingeniería Industrial");
    expect(screen.getByText("Sobre Docente de nombre extenso")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Álgebra" }).getAttribute("href")).toContain("carrera=I");
    expect(screen.queryByRole("button", { name: "Administrar mi comentario" })).toBeNull();
  });
  it("muestra contexto y texto real, respeta anonimato y nunca enlaza al detalle privado ajeno", async () => {
    render(<ExperienciasList />);
    expect(await screen.findByText(/Buena experiencia/)).toBeTruthy();
    expect(screen.getByText("Anónimo")).toBeTruthy();
    expect(screen.getAllByText(/Álgebra/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/S-21/).length).toBeGreaterThan(0);
    const commission = screen.getByRole("link", { name: /Ver comisión/ });
    // TASK-065: la comisión conserva el regreso al listado general.
    expect(commission.getAttribute("href")).toBe("/home/materias/mat1/cursadas/cur1/comisiones/com1?origen=experiencias");
    expect(document.querySelector('a[href="/home/feedback/f1"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Administrar mi comentario" })).toBeNull();
    expect(listarFeedback).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 9 }));
  });
  it("solo el comentario propio permite administrar y la paginación usa URL", async () => {
    vi.mocked(listarFeedback).mockResolvedValue({ items: [{ ...item, propio: true }], total: 10, page: 1, pageSize: 9 });
    render(<ExperienciasList />);
    await userEvent.click(await screen.findByRole("button", { name: "Administrar mi comentario" }));
    // TASK-063: conservar el origen permite regresar al listado general después de administrar.
    expect(push).toHaveBeenCalledWith("/home/feedback/f1?origen=experiencias");
    await userEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(String(replace.mock.calls.at(-1)?.[0])).toContain("page=2");
  });
  it("distingue carga, error recuperable y ausencia de comentarios", async () => {
    vi.mocked(listarFeedback).mockRejectedValueOnce(new Error("Sin conexión"));
    render(<ExperienciasList />);
    expect(screen.getByRole("status")).toBeTruthy();
    const retry = await screen.findByRole("button", { name: /Reintentar/ });
    vi.mocked(listarFeedback).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 9 });
    await userEvent.click(retry);
    expect(await screen.findByText(/(no hay|todavía no hay).*experiencias|no hay.*comentarios/i)).toBeTruthy();
  });
});
