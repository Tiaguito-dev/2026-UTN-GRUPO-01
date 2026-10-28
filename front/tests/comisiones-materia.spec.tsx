// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComisionesMateria } from "@/components/academic/ComisionesMateria";
import { listarComisionesPorCursada, listarCursadasPorMateria } from "@/services/academic";

const { navigation, auth } = vi.hoisted(() => ({ navigation: { query: "", replace: vi.fn() }, auth: { role: "USER" } }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(navigation.query), useRouter: () => ({ replace: navigation.replace }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { role: auth.role } }) }));
vi.mock("@/services/academic", () => ({ listarCursadasPorMateria: vi.fn(), listarComisionesPorCursada: vi.fn() }));
vi.mock("@/components/academic/CursadasList", () => ({ CursadasList: () => <button className="button" type="button">Nueva cursada</button> }));

const periods = [
  { id: "old", anio: 2025, comisiones: 1, profesores: 0, carreras: ["S" as const] },
  { id: "first", anio: 2024, comisiones: 1, profesores: 0, carreras: ["S" as const] },
  { id: "recent", anio: 2026, comisiones: 1, profesores: 0, carreras: ["S" as const] },
];
const commission = { id: "com1", cursadaId: "recent", carrera: "S" as const, numero: 21, nombre: "S-21", activa: true, profesores: [], createdAt: "2026-01-01", deletedAt: null };
beforeEach(() => {
  vi.clearAllMocks(); navigation.query = "carrera=S&anioCarrera=2&listadoPage=2&q=Plan"; auth.role = "USER";
  vi.mocked(listarCursadasPorMateria).mockResolvedValue({ items: periods, total: 3, page: 1, pageSize: 100 });
  vi.mocked(listarComisionesPorCursada).mockResolvedValue({ items: [commission], total: 1, page: 1, pageSize: 9 });
});
afterEach(cleanup);

describe("Comisiones directamente en materia", () => {
  it("distingue períodos del mismo año y consulta únicamente la cursada seleccionada", async () => {
    navigation.query += "&cursadaId=first";
    vi.mocked(listarCursadasPorMateria).mockResolvedValue({ items: [
      { ...periods[1], anio: 2026, cuatrimestre: "PRIMERO" },
      { ...periods[2], anio: 2026, cuatrimestre: "SEGUNDO" },
    ], total: 2, page: 1, pageSize: 100 });
    const view = render(<ComisionesMateria materiaId="mat1" materiaNombre="Álgebra" />);
    await screen.findByRole("link", { name: /S-21/ });
    expect(screen.getByRole("option", { name: "1er cuatrimestre 2026" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "2do cuatrimestre 2026" })).toBeTruthy();
    expect(listarComisionesPorCursada).toHaveBeenLastCalledWith("first", { page: 1, pageSize: 9 });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Cursada" }), "recent");
    navigation.query = new URL(String(navigation.replace.mock.calls.at(-1)?.[0]), "http://local").search.slice(1);
    view.rerender(<ComisionesMateria materiaId="mat1" materiaNombre="Álgebra" />);
    await waitFor(() => expect(listarComisionesPorCursada).toHaveBeenLastCalledWith("recent", { page: 1, pageSize: 9 }));
    expect((await screen.findByRole("link", { name: /S-21/ })).getAttribute("href")).toContain("/cursadas/recent/");
  });
  it("selecciona el período más reciente y enlaza directamente a comentarios sin pantalla de cursada", async () => {
    render(<ComisionesMateria materiaId="mat1" materiaNombre="Álgebra" />);
    const link = await screen.findByRole("link", { name: /S-21/ });
    const url = new URL(link.getAttribute("href")!, "http://localhost");
    expect(url.pathname).toBe("/home/materias/mat1/cursadas/recent/comisiones/com1");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ carrera: "S", anioCarrera: "2", listadoPage: "2", q: "Plan" });
    expect(listarComisionesPorCursada).toHaveBeenCalledWith("recent", expect.objectContaining({ page: 1, pageSize: 9 }));
    expect(screen.queryByRole("link", { name: "Nueva comisión" })).toBeNull();
  });
  it("restaura período y página desde URL, y cambiar período reinicia solo la página de comisiones", async () => {
    navigation.query += "&cursadaId=old&comisionesPage=3";
    render(<ComisionesMateria materiaId="mat1" materiaNombre="Álgebra" />);
    await screen.findByRole("link", { name: /S-21/ });
    expect(listarComisionesPorCursada).toHaveBeenCalledWith("old", expect.objectContaining({ page: 3, pageSize: 9 }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "recent");
    const url = new URL(String(navigation.replace.mock.calls.at(-1)?.[0]), "http://localhost");
    expect(url.pathname).toBe("/home/materias/mat1");
    expect(url.searchParams.get("cursadaId")).toBe("recent");
    expect(url.searchParams.get("comisionesPage")).toBeNull();
    expect(url.searchParams.get("listadoPage")).toBe("2");
    expect(url.searchParams.get("q")).toBe("Plan");
  });
  it("pagina las comisiones en el servidor y mantiene el período seleccionado", async () => {
    vi.mocked(listarComisionesPorCursada).mockResolvedValue({ items: [commission], total: 10, page: 1, pageSize: 9 });
    render(<ComisionesMateria materiaId="mat1" materiaNombre="Álgebra" />);
    await screen.findByRole("link", { name: /S-21/ });
    await userEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    const url = new URL(String(navigation.replace.mock.calls.at(-1)?.[0]), "http://localhost");
    expect(url.searchParams.get("cursadaId")).toBe("recent");
    expect(url.searchParams.get("comisionesPage")).toBe("2");
  });
  it("descarta una respuesta tardía del período anterior al cambiar la cursada", async () => {
    let finishPrevious!: (value: Awaited<ReturnType<typeof listarComisionesPorCursada>>) => void;
    vi.mocked(listarComisionesPorCursada).mockImplementation((id) => id === "recent" ? new Promise((resolve) => { finishPrevious = resolve; }) : Promise.resolve({ items: [{ ...commission, id: "old-com", cursadaId: "old", nombre: "S-19" }], total: 1, page: 1, pageSize: 9 }));
    const view = render(<ComisionesMateria materiaId="mat1" materiaNombre="Álgebra" />);
    await screen.findByText("Cargando comisiones…");
    navigation.query += "&cursadaId=old";
    view.rerender(<ComisionesMateria materiaId="mat1" materiaNombre="Álgebra" />);
    expect(await screen.findByRole("link", { name: /S-19/ })).toBeTruthy();
    await act(async () => finishPrevious({ items: [commission], total: 1, page: 1, pageSize: 9 }));
    expect(screen.queryByRole("link", { name: /S-21/ })).toBeNull();
    expect(screen.getByRole("link", { name: /S-19/ })).toBeTruthy();
  });
  it("permite recuperar un error de comisiones y distingue un período sin comisiones", async () => {
    vi.mocked(listarComisionesPorCursada).mockRejectedValueOnce(new Error("Sin conexión"));
    render(<ComisionesMateria materiaId="mat1" materiaNombre="Álgebra" />);
    const retry = await screen.findByRole("button", { name: "Reintentar comisiones" });
    vi.mocked(listarComisionesPorCursada).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 9 });
    await userEvent.click(retry);
    expect(await screen.findByText(/no tiene comisiones cargadas/i)).toBeTruthy();
  });
  it("distingue ausencia de cursadas, carga y error recuperable", async () => {
    vi.mocked(listarCursadasPorMateria).mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 100 });
    const view = render(<ComisionesMateria materiaId="mat1" materiaNombre="Álgebra" />);
    expect(await screen.findByText(/no tiene (cursadas|períodos)/i)).toBeTruthy();
    expect(listarComisionesPorCursada).not.toHaveBeenCalled();
    view.unmount();
    vi.mocked(listarCursadasPorMateria).mockRejectedValueOnce(new Error("Sin conexión"));
    render(<ComisionesMateria materiaId="mat1" materiaNombre="Álgebra" />);
    expect(screen.getByRole("status")).toBeTruthy();
    const retry = await screen.findByRole("button", { name: /Reintentar/ });
    await userEvent.click(retry);
    await waitFor(() => expect(screen.getByRole("link", { name: /S-21/ })).toBeTruthy());
  });
  it("ADMIN conserva alta de comisión con período elegido y gestión de cursadas", async () => {
    auth.role = "ADMIN";
    render(<ComisionesMateria materiaId="mat1" materiaNombre="Álgebra" />);
    const create = await screen.findByRole("link", { name: "Nueva comisión" });
    expect(create.getAttribute("href")).toContain("cursadaId=recent");
    await userEvent.click(screen.getByText("Gestionar períodos"));
    expect(screen.getByRole("button", { name: "Nueva cursada" })).toBeTruthy();
  });
});
