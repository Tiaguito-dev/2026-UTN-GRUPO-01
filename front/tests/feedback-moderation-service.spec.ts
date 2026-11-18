import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listarFeedback, listarFeedbackPropios, listarFeedbackModeracion, ocultarFeedback, restaurarFeedback, solicitarRevisionFeedback, moderarFeedback, actualizarFeedback } from "../src/services/feedback";
import { crearReporteFeedback, listarReportesFeedback, obtenerReporteFeedback, resolverReporteFeedback } from "../src/services/feedback-reportes";

const item = { id: "f1", texto: "Experiencia", puntuacion: 4, anonimo: true, autor: null, propio: true, profesor: null,
  contexto: { comisionId: "c1", nombre: "S-1", materiaId: "m1", materiaNombre: "Materia", cursadaId: "cu1", anio: 2026, cuatrimestre: null }, createdAt: "2026-11-17", updatedAt: "2026-11-17",
  estadoModeracion: "APROBADO", versionModeracion: 4, requiereRevisionHumana: false, motivoRechazo: null, ocultoAutor: false, ocultoAdministracion: false, ocultoReportes: false };
const receipt = { id: "r1", feedbackId: "f1", versionReportada: 4, motivo: "SPAM", descripcion: null, estado: "ABIERTO", createdAt: "2026-11-17", resolvedAt: null };
let fetchMock: ReturnType<typeof vi.fn>;
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function respond(body: unknown, status = 200) { fetchMock.mockImplementation((url: unknown) => Promise.resolve(new URL(String(url)).pathname === "/auth/me" ? reply({ id: "u1", email: "user@alu.frlp.utn.edu.ar", displayName: "User", role: "USER" }) : reply(body, status))); }
function calls() { return fetchMock.mock.calls.filter(([url]) => new URL(String(url)).pathname !== "/auth/me"); }
beforeEach(() => { vi.stubGlobal("window", { addEventListener: vi.fn() }); vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3301"); vi.stubEnv("NEXT_PUBLIC_ALLOW_LOCAL_HTTP", "true"); fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("T6 contratos de moderación", () => {
  it("pagina propias de nueve y conserva estado y causas simultáneas", async () => {
    respond({ items: [{ ...item, ocultoAutor: true, ocultoAdministracion: true, ocultoReportes: true }], page: 2, pageSize: 9, total: 10 });
    const result = await listarFeedbackPropios({ page: 2 });
    expect(new URL(String(calls()[0][0])).pathname).toBe("/feedback/propios"); expect(new URL(String(calls()[0][0])).search).toBe("?page=2&pageSize=9");
    expect(result.items[0]).toMatchObject({ ocultoAutor: true, ocultoAdministracion: true, ocultoReportes: true, versionModeracion: 4 });
  });
  it("el cliente comunitario descarta metadatos privados e identidad no contratada", async () => {
    respond({ items: [{ ...item, denunciante: { id: "private", displayName: "Private" } }], page: 1, pageSize: 9, total: 1 });
    const result = await listarFeedback(); expect(result.items[0]).not.toHaveProperty("denunciante"); expect(result.items[0]).not.toHaveProperty("estadoModeracion");
  });
  it.each([[ocultarFeedback, "ocultar"], [restaurarFeedback, "restaurar"], [solicitarRevisionFeedback, "revision"]] as const)("envía versión y protección CSRF en %s", async (operation, route) => {
    respond(item); await operation("f/1", 4); const [url, options] = calls()[0];
    expect(new URL(String(url)).pathname).toBe(`/feedback/f%2F1/${route}`); expect(options).toMatchObject({ method: "POST", credentials: "include", headers: { "X-CSRF-Protection": "1" } }); expect(JSON.parse(options.body)).toEqual({ versionEsperada: 4 });
  });
  it("PATCH transporta solo diferencia y versión del formulario", async () => { respond(item); await actualizarFeedback("f1", { texto: "Corregida", versionEsperada: 4 }); expect(JSON.parse(calls()[0][1].body)).toEqual({ texto: "Corregida", versionEsperada: 4 }); });
  it("bandeja administrativa filtra estado y nueve registros", async () => { respond({ items: [item], page: 1, pageSize: 9, total: 1 }); await listarFeedbackModeracion({ estado: "RECHAZADO" }); expect(new URL(String(calls()[0][0])).searchParams.get("estado")).toBe("RECHAZADO"); });
  it("restitución preventiva es explícita, justificada y versionada", async () => { respond(item); await moderarFeedback("f1", { accion: "RESTITUCION_REPORTES", versionEsperada: 4, motivo: "Verificado" }); expect(JSON.parse(calls()[0][1].body)).toEqual({ accion: "RESTITUCION_REPORTES", versionEsperada: 4, motivo: "Verificado" }); });
});
describe("T6 contratos de reportes", () => {
  it("reporta únicamente motivo y descripción y recibo seguro", async () => { respond({ ...receipt, denuncianteId: "secret", denunciante: { id: "secret", displayName: "Private" } }, 201); const result = await crearReporteFeedback("f/1", { motivo: "SPAM", descripcion: "Duplicado" }); expect(result).not.toHaveProperty("denuncianteId"); expect(JSON.parse(calls()[0][1].body)).toEqual({ motivo: "SPAM", descripcion: "Duplicado" }); expect(new URL(String(calls()[0][0])).pathname).toBe("/feedback/f%2F1/reportes"); });
  it.each([403, 404, 409, 422, 429])("propaga HTTP %s sin reintentar mutaciones ambiguas", async (status) => { respond({ message: "Revisá la solicitud" }, status); await expect(crearReporteFeedback("f1", { motivo: "OTRO" })).rejects.toMatchObject({ status }); expect(calls()).toHaveLength(1); });
  it("filtros ADMIN se envían antes de paginar", async () => { respond({ items: [], page: 2, pageSize: 9, total: 0 }); await listarReportesFeedback({ page: 2, estado: "ABIERTO", motivo: "SPAM", ocultoReportes: true }); const query = new URL(String(calls()[0][0])).searchParams; expect(Object.fromEntries(query)).toMatchObject({ page: "2", pageSize: "9", estado: "ABIERTO", motivo: "SPAM", ocultoReportes: "true" }); });
  it("detalle solicita tres resoluciones y preserva errores de autorización", async () => { respond({ message: "Acceso denegado" }, 403); await expect(obtenerReporteFeedback("r/1", { page: 2 })).rejects.toMatchObject({ status: 403 }); expect(new URL(String(calls()[0][0])).search).toBe("?page=2&pageSize=3"); });
  it("desestimar requiere justificación y no ejecuta restitución", async () => { respond({ ...receipt, estado: "DESESTIMADO", denuncianteId: "u2", historialId: "h1", administradorId: "admin", justificacion: "Revisado" }); await resolverReporteFeedback("r1", { estado: "DESESTIMADO", motivo: "Revisado" }); expect(calls()).toHaveLength(1); expect(new URL(String(calls()[0][0])).pathname).toBe("/admin/feedback-reportes/r1/resolucion"); expect(JSON.parse(calls()[0][1].body)).toEqual({ estado: "DESESTIMADO", motivo: "Revisado" }); });
});
