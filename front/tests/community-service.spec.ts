import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerNormas } from "@/services/comunidad";
import { normasConvivenciaSchema } from "@/services/schemas";

const { protectedGet } = vi.hoisted(() => ({ protectedGet: vi.fn() }));
vi.mock("@/services/auth", () => ({ getAuthService: () => ({ protectedGet }) }));
const document = { id: "vigentes", titulo: "Construyamos una comunidad que sume", introduccion: "Mensaje introductorio.",
  normas: ["Primera norma.", "Segunda norma."], cierre: "De estudiantes, para estudiantes.",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" };
beforeEach(() => { vi.resetAllMocks(); });

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
