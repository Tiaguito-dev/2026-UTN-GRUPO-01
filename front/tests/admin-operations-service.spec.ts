import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eliminarAcademico } from "@/services/admin-academic";
import { listarProfesores } from "@/services/academic";
import { cambiarEstadoUsuario, listarUsuarios } from "@/services/users";
import { listarHistorialAdministrativo } from "@/services/admin-history";
import { HttpError } from "@/services/http";

const { me, protectedGet } = vi.hoisted(() => ({ me: vi.fn(async () => ({})), protectedGet: vi.fn<(path: string, schema: unknown) => Promise<unknown>>().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 9 }) }));
vi.mock("@/services/auth", () => ({ getAuthService: () => ({ me, protectedGet }) }));
const fetchMock = vi.fn();
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", fetchMock); vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3301"); vi.stubEnv("NEXT_PUBLIC_ALLOW_LOCAL_HTTP", "true"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Contratos administrativos TASK-070", () => {
  it("envía filtros remotos explícitos de usuario y profesor con su página", async () => {
    await listarUsuarios({ page: 2, pageSize: 9, q: "Ána %_", rol: "ADMIN", estado: "INACTIVO" });
    const userQuery = new URL(protectedGet.mock.calls[0]![0], "http://local").searchParams;
    expect(Object.fromEntries(userQuery)).toEqual({ page: "2", pageSize: "9", q: "Ána %_", rol: "ADMIN", estado: "INACTIVO" });
    await listarProfesores({ page: 3, pageSize: 9, q: "García" });
    expect(Object.fromEntries(new URL(protectedGet.mock.calls[1]![0], "http://local").searchParams)).toEqual({ page: "3", pageSize: "9", q: "García" });
  });
  it.each(["materias", "profesores", "cursadas", "comisiones"] as const)("baja %s con DELETE autenticado sin cuerpo", async (kind) => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await eliminarAcademico(kind, "id/1");
    expect(me).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]).toMatchObject([`http://localhost:3301/${kind}/id%2F1`, { method: "DELETE", credentials: "include", headers: { "X-CSRF-Protection": "1" } }]);
    expect(fetchMock.mock.calls[0]![1]).not.toHaveProperty("body");
  });
  it("estado usa booleano explícito y valida disabledAt de la respuesta", async () => {
    const result = { id: "u1", displayName: "Ana", email: "ana@utn.edu", role: "USER", createdAt: "2026-01-01", disabledAt: "2026-01-02" };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }));
    await expect(cambiarEstadoUsuario("u1", false)).resolves.toEqual(result);
    expect(fetchMock.mock.calls[0]).toMatchObject(["http://localhost:3301/users/u1/estado", { method: "PATCH", body: JSON.stringify({ activo: false }) }]);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ...result, disabledAt: false }), { status: 200 }));
    await expect(cambiarEstadoUsuario("u1", true)).rejects.toBeInstanceOf(HttpError);
  });
  it("conserva errores 409 de relaciones en vez de simular una baja exitosa", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: "Quitá primero las asignaciones vigentes." }), { status: 409 }));
    await expect(eliminarAcademico("profesores", "p1")).rejects.toMatchObject({ status: 409, message: "Quitá primero las asignaciones vigentes." });
  });
  it.each(["profesores", "cursadas", "comisiones", "users"] as const)("historial %s siempre solicita tres eventos por página", async (kind) => {
    await listarHistorialAdministrativo(kind, "id/1", { page: 2 });
    expect(protectedGet).toHaveBeenCalledWith(`/${kind}/id%2F1/historial?page=2&pageSize=3`, expect.anything());
  });
});
