// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SugerenciasAdmin } from "@/components/comunidad/SugerenciasAdmin";
import { listarSugerencias, asignarMeGustaSugerencia, eliminarSugerencia } from "@/services/comunidad";
import type { SugerenciaAdministrativa } from "@/types/comunidad";

const { location, router } = vi.hoisted(() => ({ location: { search: "" }, router: { replace: vi.fn() } }));
vi.mock("@/services/comunidad", () => ({ listarSugerencias: vi.fn(), asignarMeGustaSugerencia: vi.fn(), eliminarSugerencia: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(location.search), useRouter: () => router, usePathname: () => "/home/admin/comunidad" }));
vi.mock("next/link", () => import("./support/next-link"));
afterEach(cleanup);
const suggestion = (id = "be6a4090-7221-4340-aacc-27715417dd1c", meGusta = false): SugerenciaAdministrativa => ({
  id, categoria: "NUEVA_FUNCIONALIDAD", contenido: "Una idea del estudiante", autor: { displayName: "María" },
  createdAt: "2026-11-18T12:00:00.000Z", meGusta,
});
const result = (items = [suggestion()], page = 1, total = items.length) => ({ items, page, pageSize: 20, total });
beforeEach(() => {
  vi.resetAllMocks(); location.search = "";
  vi.mocked(listarSugerencias).mockResolvedValue(result());
  vi.mocked(asignarMeGustaSugerencia).mockResolvedValue(suggestion(undefined, true));
  vi.mocked(eliminarSugerencia).mockResolvedValue(undefined);
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
const article = () => screen.findByRole("article", { name: "Sugerencia de María" });
describe("HU-C03 bandeja de sugerencias", () => {
  it("anuncia carga de la consulta privada", () => {
    vi.mocked(listarSugerencias).mockReturnValue(new Promise(() => {}));
    render(<SugerenciasAdmin />);
    expect(screen.getByRole("status").textContent).toMatch(/Cargando sugerencias/);
  });
  it("muestra autor, categoría, fecha, texto y acciones reales sin interpretar HTML", async () => {
    vi.mocked(listarSugerencias).mockResolvedValue(result([{ ...suggestion(), contenido: "<script>secret()</script>" }]));
    const view = render(<SugerenciasAdmin />);
    const item = await article();
    expect(within(item).getByText("María")).toBeTruthy();
    expect(within(item).getByText("Nueva funcionalidad")).toBeTruthy();
    expect(within(item).getByText(/18 de noviembre de 2026/)).toBeTruthy();
    expect(within(item).getByText("<script>secret()</script>")).toBeTruthy();
    expect(view.container.querySelector("script")).toBeNull();
    expect(within(item).getByRole("button", { name: "Me gusta" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(item).getByRole("button", { name: "Eliminar sugerencia" })).toBeTruthy();
  });
  it("recupera un error de listado con Reintentar", async () => {
    vi.mocked(listarSugerencias).mockRejectedValueOnce(new Error("Temporal")).mockResolvedValue(result());
    render(<SugerenciasAdmin />); expect((await screen.findByRole("alert")).textContent).toContain("No pudimos cargar");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" })); await article();
    expect(listarSugerencias).toHaveBeenCalledTimes(2);
  });
  it.each([false, true])("muestra vacío según el filtro %s", async likes => {
    location.search = likes ? "?soloMeGusta=true" : "";
    vi.mocked(listarSugerencias).mockResolvedValue(result([]));
    render(<SugerenciasAdmin />);
    expect(await screen.findByText(likes ? "No hay sugerencias marcadas con Me gusta." : "Todavía no hay sugerencias para mostrar.")).toBeTruthy();
  });
  it("conserva otros parámetros y reinicia paginación al filtrar", async () => {
    location.search = "?page=2&actualizada=1";
    vi.mocked(listarSugerencias).mockResolvedValue(result([suggestion()], 2, 21));
    render(<SugerenciasAdmin />); await article();
    fireEvent.click(screen.getByRole("group", { name: "Filtrar sugerencias" }).querySelectorAll("button")[1]!);
    expect(router.replace).toHaveBeenCalledWith("/home/admin/comunidad?actualizada=1&soloMeGusta=true", { scroll: false });
  });
  it("usa la paginación por URL existente", async () => {
    vi.mocked(listarSugerencias).mockResolvedValue(result([suggestion()], 1, 21));
    render(<SugerenciasAdmin />); await article();
    fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(router.replace).toHaveBeenCalledWith("/home/admin/comunidad?page=2", { scroll: false });
  });
  it.each([false, true])("asigna el inverso de %s y refresca solo la bandeja", async liked => {
    vi.mocked(listarSugerencias).mockResolvedValueOnce(result([suggestion(undefined, liked)])).mockResolvedValue(result([suggestion(undefined, !liked)]));
    render(<SugerenciasAdmin />); const item = await article();
    fireEvent.click(within(item).getByRole("button", { name: "Me gusta" }));
    await waitFor(() => expect(listarSugerencias).toHaveBeenCalledTimes(2));
    expect(asignarMeGustaSugerencia).toHaveBeenCalledExactlyOnceWith(suggestion().id, !liked);
    expect(within(await article()).getByRole("button", { name: "Me gusta" }).getAttribute("aria-pressed")).toBe(String(!liked));
  });
  it("bloquea dobles clics mientras se guarda y muestra un error sin éxito ficticio", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(asignarMeGustaSugerencia).mockReturnValue(new Promise((_, fail) => { reject = fail; }));
    render(<SugerenciasAdmin />); const button = within(await article()).getByRole("button", { name: "Me gusta" });
    fireEvent.click(button); fireEvent.click(button);
    expect(asignarMeGustaSugerencia).toHaveBeenCalledTimes(1); expect(button).toHaveProperty("disabled", true);
    reject(new Error("internal")); expect(await screen.findByText("No pudimos actualizar Me gusta. Intentá nuevamente.")).toBeTruthy();
    expect(button.getAttribute("aria-pressed")).toBe("false"); expect(screen.queryByText("Se actualizó Me gusta.")).toBeNull();
  });
  it("requiere confirmación y Cancelar conserva sugerencia y foco", async () => {
    render(<SugerenciasAdmin />); const opener = within(await article()).getByRole("button", { name: "Eliminar sugerencia" });
    opener.focus(); fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Eliminar sugerencia" });
    expect(eliminarSugerencia).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBe(document.activeElement);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(opener); expect(eliminarSugerencia).not.toHaveBeenCalled();
  });
  it("confirmar elimina y refresca sin recargar la página", async () => {
    vi.mocked(listarSugerencias).mockResolvedValueOnce(result()).mockResolvedValue(result([]));
    render(<SugerenciasAdmin />); fireEvent.click(within(await article()).getByRole("button", { name: "Eliminar sugerencia" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar eliminación" }));
    expect(await screen.findByText("La sugerencia se eliminó correctamente.")).toBeTruthy();
    expect(eliminarSugerencia).toHaveBeenCalledExactlyOnceWith(suggestion().id);
    expect(await screen.findByText("Todavía no hay sugerencias para mostrar.")).toBeTruthy();
  });
  it("un error de eliminación conserva el diálogo para reintentar", async () => {
    vi.mocked(eliminarSugerencia).mockRejectedValueOnce(new Error("temporary"));
    render(<SugerenciasAdmin />); fireEvent.click(within(await article()).getByRole("button", { name: "Eliminar sugerencia" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar eliminación" }));
    expect(await screen.findByText("No pudimos eliminar la sugerencia. Intentá nuevamente.")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar eliminación" }));
    expect(await screen.findByText("La sugerencia se eliminó correctamente.")).toBeTruthy();
    expect(eliminarSugerencia).toHaveBeenCalledTimes(2);
  });
  it("corrige una última página vacía tras una eliminación concurrente", async () => {
    location.search = "?page=3&soloMeGusta=true";
    vi.mocked(listarSugerencias).mockResolvedValue(result([], 3, 20));
    render(<SugerenciasAdmin />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/home/admin/comunidad?soloMeGusta=true", { scroll: false }));
  });
  it("una respuesta anterior no cambia la URL del filtro nuevo", async () => {
    let resolveOld!: (value: ReturnType<typeof result>) => void;
    location.search = "?page=3";
    vi.mocked(listarSugerencias).mockReturnValueOnce(new Promise(done => { resolveOld = done; })).mockResolvedValue(result([]));
    const view = render(<SugerenciasAdmin />);
    location.search = "?soloMeGusta=true"; view.rerender(<SugerenciasAdmin />);
    await screen.findByText("No hay sugerencias marcadas con Me gusta.");
    resolveOld(result([], 3, 0)); await waitFor(() => expect(listarSugerencias).toHaveBeenCalledTimes(2));
    expect(router.replace).not.toHaveBeenCalled();
  });
});
