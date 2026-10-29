import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  asignarProfesorComision,
  crearComision,
  crearCursada,
  listarComisionesPorCursada,
  listarCursadasPorMateria,
  listarMaterias,
  obtenerComision,
  obtenerCursada,
  obtenerMateria,
  quitarProfesorComision,
} from "../src/services/academic";
import { HttpError } from "../src/services/http";

let fetchMock: ReturnType<typeof vi.fn>;
const reply = (status: number, body: unknown = {}) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const requestedPath = (input: unknown) => {
  const url = new URL(String(input));
  return `${url.pathname}${url.search}`;
};
const emptyPage = { items: [], total: 0, page: 1, pageSize: 10 };

beforeEach(() => {
  vi.stubGlobal("window", { addEventListener: vi.fn() });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3301");
  vi.stubEnv("NEXT_PUBLIC_ALLOW_LOCAL_HTTP", "true");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

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
  it("envía la carrera y el año, y permite páginas explícitas de cien para selectores", async () => {
    fetchMock.mockResolvedValue(reply(200, emptyPage));
    await listarMaterias({ page: 2, pageSize: 100, carrera: "S", anioCarrera: "ELECTIVA", nivelElectiva: "4", q: "Plan %_" });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/materias");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: "2",
      pageSize: "100",
      carrera: "S",
      anioCarrera: "ELECTIVA",
      nivelElectiva: "4",
      q: "Plan %_",
    });
  });
  // TASK-060: a year (including elective level) is useful without choosing a career.
  it("envía año y nivel independientes de la carrera sin eliminarlos del query", async () => {
    fetchMock.mockResolvedValue(reply(200, emptyPage));
    await listarMaterias({ anioCarrera: "ELECTIVA", nivelElectiva: "4", q: "Óptica" });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(Object.fromEntries(url.searchParams)).toEqual({ anioCarrera: "ELECTIVA", nivelElectiva: "4", q: "Óptica", pageSize: "9" });
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
  it("envía carrera junto con la paginación de comisiones al servidor", async () => {
    fetchMock.mockResolvedValue(reply(200, emptyPage));
    await listarComisionesPorCursada("cur-1", { carrera: "I", page: 2, pageSize: 9 });
    expect(requestedPath(fetchMock.mock.calls[0][0])).toBe("/cursadas/cur-1/comisiones?page=2&pageSize=9&carrera=I");
  });
  it("obtenerMateria y obtenerCursada piden el detalle por id escapado", async () => {
    const materia = {
      id: "m/1",
      nombre: "Álgebra",
      carreras: [{ carrera: "S", anioCarrera: "1", nivelElectiva: null }],
      createdAt: "2026-01-01",
      deletedAt: null,
    };
    const cursada = {
      id: "c/1",
      anio: 2026,
      materia: { id: "m/1", nombre: "Álgebra" },
    };
    fetchMock.mockResolvedValueOnce(reply(200, materia)).mockResolvedValueOnce(reply(200, cursada));
    await expect(obtenerMateria("m/1")).resolves.toEqual(materia);
    await expect(obtenerCursada("c/1")).resolves.toEqual(cursada);
    expect(fetchMock.mock.calls.map(([url]) => requestedPath(url))).toEqual(["/materias/m%2F1", "/cursadas/c%2F1"]);
  });
  it("obtenerComision pide el detalle por id escapado", async () => {
    const comision = {
      id: "com/1",
      cursadaId: "cur-1",
      carrera: "S",
      numero: 31,
      nombre: "S-31",
      activa: true,
      profesores: [{ id: "p1", nombreCompleto: "Prof. Rossi", cargo: "TITULAR" }],
      createdAt: "2026-01-01",
      deletedAt: null,
      cursada: { id: "cur-1", anio: 2026, materia: { id: "m1", nombre: "Álgebra" } },
    };
    fetchMock.mockResolvedValueOnce(reply(200, comision));
    await expect(obtenerComision("com/1")).resolves.toEqual(comision);
    expect(requestedPath(fetchMock.mock.calls[0][0])).toBe("/comisiones/com%2F1");
  });
  it("asignarProfesorComision y quitarProfesorComision usan PUT y DELETE", async () => {
    const me = { id: "u1", email: "a@b.com", displayName: "Admin", role: "ADMIN" };
    const asignado = { id: "p1", nombreCompleto: "Prof. Rossi", cargo: "JTP" };
    fetchMock
      .mockResolvedValueOnce(reply(200, me))
      .mockResolvedValueOnce(reply(200, asignado))
      .mockResolvedValueOnce(reply(200, me))
      .mockResolvedValueOnce(reply(204));
    await expect(asignarProfesorComision("c1", "p1", "JTP")).resolves.toEqual(asignado);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "PUT", body: JSON.stringify({ cargo: "JTP" }) });
    await expect(quitarProfesorComision("c1", "p1")).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[3][1]).toMatchObject({ method: "DELETE" });
  });
  it("crearCursada envía los datos sin profesor", async () => {
    const cursada = { id: "c1", materiaId: "m1", anio: 2026, createdAt: "", deletedAt: null };
    fetchMock.mockResolvedValueOnce(reply(200, cursada));
    await expect(crearCursada({ materiaId: "m1", anio: 2026, cuatrimestre: "ANUAL" })).resolves.toEqual(cursada);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ materiaId: "m1", anio: 2026, cuatrimestre: "ANUAL" }),
    });
  });
  it("crearComision envía carrera y número", async () => {
    const comision = {
      id: "com1",
      cursadaId: "cur1",
      carrera: "S",
      numero: 31,
      nombre: "S-31",
      activa: true,
      profesores: [],
      createdAt: "",
      deletedAt: null,
    };
    fetchMock.mockResolvedValueOnce(reply(200, comision));
    await expect(crearComision({ cursadaId: "cur1", carrera: "S", numero: 31 })).resolves.toEqual(comision);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ cursadaId: "cur1", carrera: "S", numero: 31 }),
    });
  });
  it("TASK-031: un listado sin `items` termina en HttpError(502) con mensaje en español", async () => {
    fetchMock.mockResolvedValue(reply(200, { total: 0, page: 1, pageSize: 10 }));
    const failure = await listarComisionesPorCursada("cur-1").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(HttpError);
    expect(failure).toMatchObject({
      status: 502,
      message: "El servidor devolvió datos con un formato inesperado. Intentá nuevamente.",
    });
  });
  it("TASK-031: un detalle de cursada sin la materia también es un 502, no un ZodError", async () => {
    fetchMock.mockResolvedValue(reply(200, { id: "c1", anio: 2026 }));
    await expect(obtenerCursada("c1")).rejects.toMatchObject({ name: "HttpError", status: 502 });
  });
  it("delega el error del backend tal cual (404 no dispara refresh, solo pega una vez)", async () => {
    fetchMock.mockResolvedValue(reply(404, { message: "Materia no encontrada." }));
    await expect(listarMaterias()).rejects.toMatchObject({ status: 404, message: "Materia no encontrada." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
