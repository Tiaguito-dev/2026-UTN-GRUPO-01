import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listarComisionesPorCursada, listarCursadasPorMateria, listarMaterias } from "../src/services/academic";

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
  it("listarMaterias sin paginación pide /materias sin query string", async () => {
    fetchMock.mockResolvedValue(reply(200, emptyPage));
    await expect(listarMaterias()).resolves.toEqual(emptyPage);
    expect(requestedPath(fetchMock.mock.calls[0][0])).toBe("/materias");
  });
  it("listarMaterias con page y pageSize los agrega como query", async () => {
    const page = { items: [], total: 0, page: 2, pageSize: 5 };
    fetchMock.mockResolvedValue(reply(200, page));
    await listarMaterias({ page: 2, pageSize: 5 });
    expect(requestedPath(fetchMock.mock.calls[0][0])).toBe("/materias?page=2&pageSize=5");
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
  it("delega el error del backend tal cual (404 no dispara refresh, solo pega una vez)", async () => {
    fetchMock.mockResolvedValue(reply(404, { message: "Materia no encontrada." }));
    await expect(listarMaterias()).rejects.toMatchObject({ status: 404, message: "Materia no encontrada." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
