import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listarComisionesPorCursada, listarCursadasPorMateria, listarMaterias, obtenerCursada, obtenerMateria } from "../src/services/academic";
import { HttpError } from "../src/services/http";

let fetchMock: ReturnType<typeof vi.fn>;
const reply = (status: number, body: unknown = {}) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const requestedPath = (input: unknown) => { const url = new URL(String(input)); return `${url.pathname}${url.search}`; };
const emptyPage = { items: [], total: 0, page: 1, pageSize: 10 };

beforeEach(() => {
  vi.stubGlobal("window", { addEventListener: vi.fn() });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3301");
  vi.stubEnv("NEXT_PUBLIC_ALLOW_LOCAL_HTTP", "true");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Cliente academic: construcción de URL y delegación en protectedGet", () => {
  it("listarMaterias sin paginación limita a nueve materias", async () => {
    fetchMock.mockResolvedValue(reply(200, emptyPage));
    await expect(listarMaterias()).resolves.toEqual(emptyPage);
    expect(requestedPath(fetchMock.mock.calls[0][0])).toBe("/materias?pageSize=9");
  });
  it("listarMaterias con page y pageSize los agrega como query", async () => {
    const page = { items: [], total: 0, page: 2, pageSize: 5 };
    fetchMock.mockResolvedValue(reply(200, page));
    await listarMaterias({ page: 2, pageSize: 5 });
    expect(requestedPath(fetchMock.mock.calls[0][0])).toBe("/materias?page=2&pageSize=5");
  });
  it("envía el año y permite páginas explícitas de cien para selectores", async () => {
    fetchMock.mockResolvedValue(reply(200, emptyPage));
    await listarMaterias({ page: 2, pageSize: 100, anioCarrera: "ELECTIVA", nivelElectiva: "4", q: "Plan %_" });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/materias");
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: "2", pageSize: "100", anioCarrera: "ELECTIVA", nivelElectiva: "4", q: "Plan %_" });
  });
  it("listarCursadasPorMateria arma la ruta anidada con el materiaId escapado", async () => {
    fetchMock.mockResolvedValue(reply(200, emptyPage));
    await listarCursadasPorMateria("mat/1", { page: 1 });
    expect(requestedPath(fetchMock.mock.calls[0][0])).toBe("/materias/mat%2F1/cursadas?page=1");
  });
  it("listarComisionesPorCursada arma la ruta anidada y acepta solo pageSize", async () => {
    fetchMock.mockResolvedValue(reply(200, emptyPage));
    await listarComisionesPorCursada("cur-1", { pageSize: 20 });
    expect(requestedPath(fetchMock.mock.calls[0][0])).toBe("/cursadas/cur-1/comisiones?pageSize=20");
  });
  it("obtenerMateria y obtenerCursada piden el detalle por id escapado", async () => {
    const materia = { id: "m/1", nombre: "Álgebra", anioCarrera: "1", nivelElectiva: null, createdAt: "2026-01-01", deletedAt: null };
    const cursada = { id: "c/1", anio: 2026, cuatrimestre: "PRIMERO", profesor: "Prof. Rossi", materia: { id: "m/1", nombre: "Álgebra" } };
    fetchMock.mockResolvedValueOnce(reply(200, materia)).mockResolvedValueOnce(reply(200, cursada));
    await expect(obtenerMateria("m/1")).resolves.toEqual(materia);
    await expect(obtenerCursada("c/1")).resolves.toEqual(cursada);
    expect(fetchMock.mock.calls.map(([url]) => requestedPath(url))).toEqual(["/materias/m%2F1", "/cursadas/c%2F1"]);
  });
  it("TASK-031: un listado sin `items` termina en HttpError(502) con mensaje en español", async () => {
    fetchMock.mockResolvedValue(reply(200, { total: 0, page: 1, pageSize: 10 }));
    const failure = await listarComisionesPorCursada("cur-1").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(HttpError);
    expect(failure).toMatchObject({ status: 502, message: "El servidor devolvió datos con un formato inesperado. Intentá nuevamente." });
  });
  it("TASK-031: un detalle de cursada sin la materia también es un 502, no un ZodError", async () => {
    fetchMock.mockResolvedValue(reply(200, { id: "c1", anio: 2026, cuatrimestre: "PRIMERO", profesor: "Prof. Rossi" }));
    await expect(obtenerCursada("c1")).rejects.toMatchObject({ name: "HttpError", status: 502 });
  });
  it("delega el error del backend tal cual (404 no dispara refresh, solo pega una vez)", async () => {
    fetchMock.mockResolvedValue(reply(404, { message: "Materia no encontrada." }));
    await expect(listarMaterias()).rejects.toMatchObject({ status: 404, message: "Materia no encontrada." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
