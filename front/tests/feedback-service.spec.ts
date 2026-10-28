import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  listarFeedback, listarFeedbackComision, obtenerFeedbackPropio, crearFeedback, obtenerFeedback,
  actualizarFeedback, eliminarFeedback, listarHistorialFeedback,
} from "../src/services/feedback";

const item = {
  id: "f1", texto: "Buena experiencia", anonimo: true, autor: null, propio: false,
  profesor: { id: "p1", nombreCompleto: "Ada", cargo: "TITULAR" },
  contexto: { comisionId: "c1", nombre: "S-1", materiaId: "m1", materiaNombre: "Álgebra", cursadaId: "cu1", anio: 2025, cuatrimestre: "PRIMERO" },
  createdAt: "2026-10-26T12:00:00.000Z", updatedAt: "2026-10-26T12:00:00.000Z",
};
const reply = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubGlobal("window", { addEventListener: vi.fn() });
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3301");
  vi.stubEnv("NEXT_PUBLIC_ALLOW_LOCAL_HTTP", "true");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function businessCalls() {
  return fetchMock.mock.calls.filter(([url]) => new URL(String(url)).pathname !== "/auth/me");
}
function respond(body: unknown, status = 200) {
  fetchMock.mockImplementation((url: unknown) => Promise.resolve(new URL(String(url)).pathname === "/auth/me"
    ? reply({ id: "u1", email: "test@alu.frlp.utn.edu.ar", displayName: "Persona", role: "USER" })
    : reply(body, status)));
}

describe("Cliente de feedback", () => {
  it("envía carrera y materia combinadas junto con la página del listado general", async () => {
    respond({ items: [item], total: 20, page: 2, pageSize: 9 });
    await listarFeedback({ carrera: "I", materiaId: "mat1", page: 2 });
    const url = new URL(String(businessCalls()[0][0]));
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: "2", pageSize: "9", carrera: "I", materiaId: "mat1" });
  });
  // TASK-061: the transversal feed keeps the same typed/redacted item contract.
  it("consulta Experiencias generales con nueve elementos y página explícita", async () => {
    const page = { items: [item], total: 10, page: 2, pageSize: 9 };
    respond(page);
    await expect(listarFeedback({ page: 2 })).resolves.toEqual(page);
    const url = new URL(String(businessCalls()[0][0]));
    expect(url.pathname).toBe("/feedback");
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: "2", pageSize: "9" });
  });
  it("pagina por comisión con máximo predeterminado de nueve y escapa identificadores", async () => {
    const page = { items: [item], total: 1, page: 2, pageSize: 9 };
    respond(page);
    await expect(listarFeedbackComision("com/1", { page: 2 })).resolves.toEqual(page);
    const url = new URL(String(businessCalls()[0][0]));
    expect(url.pathname).toBe("/comisiones/com%2F1/feedback");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("pageSize")).toBe("9");
  });
  it("el comentario propio puede no existir", async () => {
    respond(null);
    await expect(obtenerFeedbackPropio("c1")).resolves.toBeNull();
  });
  it("publica texto y anonimato sin enviar autoría y conserva protección CSRF", async () => {
    respond({ ...item, propio: true }, 201);
    await crearFeedback("c1", { texto: "Buena experiencia", anonimo: true, profesorId: "p1" });
    const [url, options] = businessCalls()[0];
    expect(new URL(String(url)).pathname).toBe("/comisiones/c1/feedback");
    expect(options).toMatchObject({ method: "POST", credentials: "include", headers: { "X-CSRF-Protection": "1" } });
    expect(JSON.parse(options.body)).toEqual({ texto: "Buena experiencia", anonimo: true, profesorId: "p1" });
  });
  it("edita únicamente los campos recibidos y elimina con DELETE", async () => {
    respond(item);
    await actualizarFeedback("f/1", { anonimo: false });
    expect(businessCalls()[0][1]).toMatchObject({ method: "PATCH", body: JSON.stringify({ anonimo: false }) });
    respond(undefined, 204);
    await expect(eliminarFeedback("f/1")).resolves.toBeUndefined();
    expect(businessCalls().at(-1)?.[1]).toMatchObject({ method: "DELETE" });
  });
  it("valida el detalle y rechaza respuestas con tipos inesperados", async () => {
    respond(item);
    await expect(obtenerFeedback("f1")).resolves.toEqual(item);
    respond({ ...item, anonimo: "sí" });
    await expect(obtenerFeedback("f1")).rejects.toMatchObject({ status: 502 });
  });
  it("historial siempre solicita tres elementos", async () => {
    respond({ items: [], total: 0, page: 1, pageSize: 3 });
    await listarHistorialFeedback("f1", {});
    for (const [url] of businessCalls()) expect(new URL(String(url)).searchParams.get("pageSize")).toBe("3");
  });
  it("muestra errores del servidor al publicar", async () => {
    respond({ message: "Ya publicaste en esta comisión." }, 409);
    await expect(crearFeedback("c1", { texto: "Otra opinión", anonimo: true })).rejects.toMatchObject({ status: 409, message: "Ya publicaste en esta comisión." });
  });
});
