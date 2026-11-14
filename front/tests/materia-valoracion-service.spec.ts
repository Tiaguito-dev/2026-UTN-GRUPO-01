import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { actualizarMateria, crearMateria, listarMaterias, obtenerMateria } from "../src/services/materias";

const materia = { id: "m1", nombre: "Álgebra", modalidad: "ANUAL" as const, carreras: [], createdAt: "2026-01-01", deletedAt: null };
const input = { nombre: "Álgebra", modalidad: "ANUAL" as const, carreras: [] };
let fetchMock: ReturnType<typeof vi.fn>;
function respond(body: unknown) {
  fetchMock.mockImplementation((url: unknown) => Promise.resolve(new Response(JSON.stringify(
    new URL(String(url)).pathname === "/auth/me" ? { id: "u1", email: "a@b.com", displayName: "Admin", role: "ADMIN" } : body,
  ), { status: 200, headers: { "Content-Type": "application/json" } })));
}
beforeEach(() => {
  vi.stubGlobal("window", { addEventListener: vi.fn() });
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3301");
  vi.stubEnv("NEXT_PUBLIC_ALLOW_LOCAL_HTTP", "true");
  fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Lecturas de materias con valoración", () => {
  it.each([{ promedio: null, cantidad: 0 }, { promedio: 1, cantidad: 1 }, { promedio: 5, cantidad: 2 }, { promedio: 4.3, cantidad: 12 }])("conserva %j en listado y detalle sin otras solicitudes", async valoracion => {
    const item = { ...materia, valoracion };
    respond({ items: [item], total: 1, page: 2, pageSize: 9 });
    await expect(listarMaterias({ carrera: "S", anioCarrera: "2", q: "Álgebra", page: 2 })).resolves.toEqual({ items: [item], total: 1, page: 2, pageSize: 9 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(Object.fromEntries(url.searchParams)).toEqual({ carrera: "S", anioCarrera: "2", q: "Álgebra", page: "2", pageSize: "9" });
    respond(item);
    await expect(obtenerMateria("m/1")).resolves.toEqual(item);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetchMock.mock.calls[1][0])).pathname).toBe("/materias/m%2F1");
  });
  it.each([undefined, null, {}, { promedio: null, cantidad: 1 }, { promedio: 3, cantidad: 0 }, { promedio: 0, cantidad: 1 }, { promedio: 6, cantidad: 1 }, { promedio: "4.3", cantidad: 1 }, { promedio: 4, cantidad: -1 }, { promedio: 4, cantidad: 1.5 }, { promedio: 4, cantidad: "1" }, { promedio: 4, cantidad: Number.MAX_SAFE_INTEGER + 1 }])("rechaza un resumen ausente o incoherente %j", async valoracion => {
    const item = { ...materia, valoracion };
    respond(item);
    await expect(obtenerMateria("m1")).rejects.toMatchObject({ status: 502 });
    respond({ items: [item], total: 1, page: 1, pageSize: 9 });
    await expect(listarMaterias()).rejects.toMatchObject({ status: 502 });
  });
  it("preserva altas y actualizaciones administrativas sin valoracion", async () => {
    respond(materia);
    await expect(crearMateria(input)).resolves.toEqual(materia);
    await expect(actualizarMateria("m1", { nombre: "Álgebra" })).resolves.toEqual(materia);
    const mutations = fetchMock.mock.calls.filter(([, options]) => options?.method === "POST" || options?.method === "PATCH");
    expect(mutations.map(([, options]) => JSON.parse(options.body))).toEqual([input, { nombre: "Álgebra" }]);
  });
  it("el contrato de lectura conserva únicamente el resumen sin identidades", async () => {
    respond({ ...materia, usuarioId: "privado", valoracion: { promedio: 4.3, cantidad: 12, usuarios: ["privado"] } });
    await expect(obtenerMateria("m1")).resolves.toEqual({ ...materia, valoracion: { promedio: 4.3, cantidad: 12 } });
  });
});
