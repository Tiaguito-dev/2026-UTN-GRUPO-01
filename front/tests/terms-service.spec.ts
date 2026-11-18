import { afterEach, describe, expect, it, vi } from "vitest";
import { obtenerTerminosCondiciones } from "@/services/terminos";
import { requestJson } from "@/services/http";
vi.mock("@/services/http", async importOriginal => ({ ...await importOriginal<typeof import("@/services/http")>(), requestJson: vi.fn() }));
afterEach(() => vi.clearAllMocks());
describe("Documento público de términos", () => {
  it("consulta GET público y conserva versión y contenido del backend", async () => {
    const document = { version: "terminos-v1", secciones: [{ titulo: "Propósito", parrafos: ["Experiencias académicas"] }] };
    vi.mocked(requestJson).mockResolvedValue(document);
    await expect(obtenerTerminosCondiciones()).resolves.toEqual(document);
    expect(requestJson).toHaveBeenCalledExactlyOnceWith("/auth/terms", { method: "GET" });
  });
  it.each([
    { version: "", secciones: [{ titulo: "Propósito", parrafos: ["Texto"] }] },
    { version: "v1", secciones: [] },
    { version: "v1", secciones: [{ titulo: "", parrafos: ["Texto"] }] },
    { version: "v1", secciones: [{ titulo: "Propósito", parrafos: [] }] },
    { version: "v1", secciones: [{ titulo: "Propósito", parrafos: [""] }] },
  ])("rechaza documentos incompletos antes de permitir consentir: %j", async document => {
    vi.mocked(requestJson).mockResolvedValue(document);
    await expect(obtenerTerminosCondiciones()).rejects.toMatchObject({ status: 502 });
  });
});
