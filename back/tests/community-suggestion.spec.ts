import { describe, expect, it, vi } from "vitest";
import { RegistrarSugerencia } from "../src/community/application/registrar-sugerencia.js";

const userId = "62dc473d-7eb5-42c2-b979-335718582030";
const input = { solicitudId: "de9faf0b-06c7-4b45-aa8b-f7eb810a44e3", categoria: "OTROS", contenido: "Una sugerencia para mejorar la plataforma." };
const receipt = { id: "be6a4090-7221-4340-aacc-27715417dd1c", createdAt: new Date("2026-11-18T10:00:00Z") };
function fixture() { const repository = { registrar: vi.fn().mockResolvedValue(receipt) }; return { repository, service: new RegistrarSugerencia(repository) }; }

describe("HU-C02 registrar sugerencia privada", () => {
  it.each(["MEJORA_PLATAFORMA", "NUEVA_FUNCIONALIDAD", "REPORTAR_ERROR", "CORRECCION_ACADEMICA", "OTROS"])("acepta %s y conserva clave, autor de sesión y saltos internos", async categoria => {
    const { repository, service } = fixture();
    await expect(service.execute({ ...input, categoria, contenido: " Primera idea.\n\nSegunda idea. " }, userId)).resolves.toEqual(receipt);
    expect(repository.registrar).toHaveBeenCalledExactlyOnceWith({ ...input, categoria, contenido: "Primera idea.\n\nSegunda idea." }, userId);
  });
  it.each([null, [], {}, { ...input, solicitudId: "invalid" }, { ...input, categoria: "" }, { ...input, categoria: "OTRA" }, { ...input, contenido: " " }, { ...input, contenido: "x".repeat(5001) }, { ...input, contenido: 42 }, { ...input, usuarioId: userId }, { ...input, createdAt: "2000-01-01" }, { ...input, id: receipt.id }])("rechaza campos inválidos o autoría del cliente sin escribir: %j", async body => {
    const { repository, service } = fixture();
    await expect(service.execute(body, userId)).rejects.toMatchObject({ httpStatus: 400 });
    expect(repository.registrar).not.toHaveBeenCalled();
  });
  it.each(["", "invalid", undefined, null])("rechaza usuario de sesión inválido: %s", async invalidUser => {
    const { repository, service } = fixture();
    await expect(service.execute(input, invalidUser)).rejects.toMatchObject({ httpStatus: 400 });
    expect(repository.registrar).not.toHaveBeenCalled();
  });
  it("admite el límite de 5000 caracteres", async () => {
    const { repository, service } = fixture();
    await expect(service.execute({ ...input, contenido: "x".repeat(5000) }, userId)).resolves.toEqual(receipt);
    expect(repository.registrar).toHaveBeenCalledTimes(1);
  });
  it("propaga un fallo de registro sin responder éxito ficticio", async () => {
    const { repository, service } = fixture(); const failure = new Error("database unavailable"); repository.registrar.mockRejectedValue(failure);
    await expect(service.execute(input, userId)).rejects.toBe(failure);
  });
});
