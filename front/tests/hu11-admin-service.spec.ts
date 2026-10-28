import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { actualizarProfesor, actualizarCursada, actualizarComision } from "@/services/admin-academic";
import { HttpError } from "@/services/http";

const { me } = vi.hoisted(() => ({ me: vi.fn(async () => ({})) }));
vi.mock("@/services/auth", () => ({ getAuthService: () => ({ me }) }));
const fetchMock = vi.fn();
const date = "2026-01-01T00:00:00.000Z";
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3301"); vi.stubEnv("NEXT_PUBLIC_ALLOW_LOCAL_HTTP", "true");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("HU11 cliente PATCH", () => {
  it.each([
    { call: () => actualizarProfesor("p1", { nombreCompleto: "Ada" }), path: "/profesores/p1", body: { nombreCompleto: "Ada" }, response: { id: "p1", nombreCompleto: "Ada", createdAt: date, deletedAt: null } },
    { call: () => actualizarCursada("c1", { anio: 2026 }), path: "/cursadas/c1", body: { anio: 2026 }, response: { id: "c1", materiaId: "m1", anio: 2026, cuatrimestre: "PRIMERO", createdAt: date, deletedAt: null } },
    { call: () => actualizarComision("co1", { numero: 31 }), path: "/comisiones/co1", body: { numero: 31 }, response: { id: "co1", cursadaId: "c1", carrera: "S", numero: 31, nombre: "S-31", activa: true, profesores: [], createdAt: date, deletedAt: null } },
  ])("envía PATCH autenticado y valida respuesta $path", async ({ call, path, body, response }) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    await expect(call()).resolves.toMatchObject(response);
    expect(me).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(String(url)).pathname).toBe(path);
    expect(init).toMatchObject({ method: "PATCH", credentials: "include", body: JSON.stringify(body) });
    expect(init.headers).toMatchObject({ "X-CSRF-Protection": "1", "Content-Type": "application/json" });
  });
  it("rechaza una respuesta mal formada en vez de incorporarla al estado", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "p1" }), { status: 200 }));
    await expect(actualizarProfesor("p1", { nombreCompleto: "Ada" })).rejects.toBeInstanceOf(HttpError);
  });
});
