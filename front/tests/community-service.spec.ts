import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerNormas, actualizarNormas, registrarSugerencia, listarSugerencias, asignarMeGustaSugerencia, eliminarSugerencia } from "@/services/comunidad";
import { normasConvivenciaSchema, sugerenciaRegistradaSchema, sugerenciaAdministrativaSchema, sugerenciasAdministrativasSchema } from "@/services/schemas";

const { protectedGet, protectedPost, me, requestJson } = vi.hoisted(() => ({ protectedGet: vi.fn(), protectedPost: vi.fn(), me: vi.fn(), requestJson: vi.fn() }));
vi.mock("@/services/auth", () => ({ getAuthService: () => ({ protectedGet, protectedPost, me }) }));
vi.mock("@/services/http", async () => ({ ...await vi.importActual<typeof import("@/services/http")>("@/services/http"), requestJson }));
const document = { id: "vigentes", titulo: "Construyamos una comunidad que sume", introduccion: "Mensaje introductorio.",
  normas: ["Primera norma.", "Segunda norma."], cierre: "De estudiantes, para estudiantes.",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" };
beforeEach(() => { vi.resetAllMocks(); });

describe("HU-C03 contrato de administración privada", () => {
  const item = { id: "be6a4090-7221-4340-aacc-27715417dd1c", categoria: "OTROS", contenido: "Idea privada", meGusta: true, autor: { displayName: "María" }, createdAt: "2026-11-18T10:00:00.000Z" };
  it("consulta página y filtro explícitos mediante GET protegido", async () => {
    protectedGet.mockResolvedValue({ items: [item], total: 1, page: 2, pageSize: 7 });
    await listarSugerencias({ page: 2, pageSize: 7, soloMeGusta: true });
    expect(protectedGet).toHaveBeenCalledExactlyOnceWith("/comunidad/sugerencias?page=2&pageSize=7&soloMeGusta=true", sugerenciasAdministrativasSchema);
  });
  it("consulta todas y veinte elementos por defecto", async () => {
    await listarSugerencias({ page: 1 });
    expect(protectedGet).toHaveBeenCalledWith("/comunidad/sugerencias?page=1&pageSize=20&soloMeGusta=false", sugerenciasAdministrativasSchema);
  });
  it.each([true, false])("PUT asigna %s y valida el DTO sin repetir escritura", async meGusta => {
    me.mockResolvedValue({ role: "ADMIN" }); requestJson.mockResolvedValue({ ...item, meGusta });
    await expect(asignarMeGustaSugerencia(item.id, meGusta)).resolves.toEqual({ ...item, meGusta });
    expect(requestJson).toHaveBeenCalledExactlyOnceWith(`/comunidad/sugerencias/${item.id}/me-gusta`, { method: "PUT", body: { meGusta } });
  });
  it("DELETE verifica sesión y admite 204 sin respuesta", async () => {
    me.mockResolvedValue({ role: "ADMIN" }); requestJson.mockResolvedValue(undefined);
    await expect(eliminarSugerencia(item.id)).resolves.toBeUndefined();
    expect(requestJson).toHaveBeenCalledExactlyOnceWith(`/comunidad/sugerencias/${item.id}`, { method: "DELETE" });
  });
  it("no escribe si falla verificar sesión", async () => {
    me.mockRejectedValue(new Error("session"));
    await expect(eliminarSugerencia(item.id)).rejects.toThrow("session");
    await expect(asignarMeGustaSugerencia(item.id, true)).rejects.toThrow("session");
    expect(requestJson).not.toHaveBeenCalled();
  });
  it("propaga fallo de DELETE sin reintento automático", async () => {
    me.mockResolvedValue({ role: "ADMIN" }); requestJson.mockRejectedValue(new Error("write"));
    await expect(eliminarSugerencia(item.id)).rejects.toThrow("write"); expect(requestJson).toHaveBeenCalledTimes(1);
  });
  it.each([{ meGusta: "true" }, { autor: { email: "private" } }, { categoria: "INVALIDA" }, { createdAt: "invalid" }, { id: "invalid" }])("rechaza DTO incompleto o inválido: %j", invalid => {
    expect(sugerenciaAdministrativaSchema.safeParse({ ...item, ...invalid }).success).toBe(false);
  });
  it("una respuesta corrupta de PUT no confirma éxito", async () => {
    me.mockResolvedValue({ role: "ADMIN" }); requestJson.mockResolvedValue({ ...item, meGusta: 1 });
    await expect(asignarMeGustaSugerencia(item.id, true)).rejects.toThrow();
  });
});

describe("HU-C01 contrato de consulta de Comunidad", () => {
  it("delega lectura autenticada al endpoint vigente con el esquema de respuesta", async () => {
    protectedGet.mockResolvedValue(document);
    await expect(obtenerNormas()).resolves.toEqual(document);
    expect(protectedGet).toHaveBeenCalledExactlyOnceWith("/comunidad/normas", normasConvivenciaSchema);
  });
  it("acepta contenido persistido y mantiene el orden de las normas", () => {
    expect(normasConvivenciaSchema.parse(document)).toEqual(document);
  });
  it.each([
    { id: "otro" }, { titulo: "" }, { introduccion: "" }, { cierre: "" }, { normas: [] }, { normas: [""] },
    { normas: "texto" }, { normas: [42] }, { createdAt: "fecha inválida" }, { updatedAt: null },
  ])("rechaza una respuesta incompleta o inválida: %j", invalid => {
    expect(normasConvivenciaSchema.safeParse({ ...document, ...invalid }).success).toBe(false);
  });
  it("no oculta errores de transporte con contenido de ejemplo", async () => {
    const error = new Error("unavailable"); protectedGet.mockRejectedValue(error);
    await expect(obtenerNormas()).rejects.toBe(error);
  });
});

describe("HU-C04 transporte de actualización administrativa", () => {
  const input = { titulo: document.titulo, introduccion: document.introduccion, normas: document.normas, cierre: document.cierre };
  it("comprueba sesión antes del único PUT y valida el documento público devuelto", async () => {
    me.mockResolvedValue({ role: "ADMIN" }); requestJson.mockResolvedValue(document);
    await expect(actualizarNormas(input)).resolves.toEqual(document);
    expect(me).toHaveBeenCalledTimes(1);
    expect(requestJson).toHaveBeenCalledExactlyOnceWith("/comunidad/normas", { method: "PUT", body: input });
    expect(me.mock.invocationCallOrder[0]).toBeLessThan(requestJson.mock.invocationCallOrder[0]!);
  });
  it("no envía la mutación si no puede comprobar la sesión", async () => {
    me.mockRejectedValue(new Error("session unavailable"));
    await expect(actualizarNormas(input)).rejects.toThrow("session unavailable");
    expect(requestJson).not.toHaveBeenCalled();
  });
  it("conserva un fallo de escritura sin reintentar automáticamente", async () => {
    me.mockResolvedValue({ role: "ADMIN" }); requestJson.mockRejectedValue(new Error("write unavailable"));
    await expect(actualizarNormas(input)).rejects.toThrow("write unavailable");
    expect(requestJson).toHaveBeenCalledTimes(1);
  });
  it("rechaza una respuesta de actualización que no cumple el contrato", async () => {
    me.mockResolvedValue({ role: "ADMIN" }); requestJson.mockResolvedValue({ ...document, normas: [] });
    await expect(actualizarNormas(input)).rejects.toThrow();
  });
});

describe("HU-C02 transporte de registro privado", () => {
  const input = { solicitudId: "de9faf0b-06c7-4b45-aa8b-f7eb810a44e3", categoria: "OTROS" as const, contenido: "Una mejora privada." };
  const receipt = { id: "be6a4090-7221-4340-aacc-27715417dd1c", createdAt: "2026-11-18T10:00:00.000Z" };
  it("delega el POST protegido con clave y sin autor provisto por el cliente", async () => {
    protectedPost.mockResolvedValue(receipt); await expect(registrarSugerencia(input)).resolves.toEqual(receipt);
    expect(protectedPost).toHaveBeenCalledExactlyOnceWith("/comunidad/sugerencias", input, sugerenciaRegistradaSchema);
    expect(requestJson).not.toHaveBeenCalled();
  });
  it("acepta el recibo mínimo válido", () => { expect(sugerenciaRegistradaSchema.parse(receipt)).toEqual(receipt); });
  it.each([{ id: "invalid" }, { createdAt: "invalid" }, { id: undefined }, { createdAt: undefined }])("rechaza un recibo inválido: %j", invalid => {
    expect(sugerenciaRegistradaSchema.safeParse({ ...receipt, ...invalid }).success).toBe(false);
  });
  it("propaga el fallo de registro sin producir un agradecimiento ficticio", async () => {
    protectedPost.mockRejectedValue(new Error("unavailable")); await expect(registrarSugerencia(input)).rejects.toThrow("unavailable");
  });
});
