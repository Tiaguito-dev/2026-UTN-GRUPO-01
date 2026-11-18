import { describe, expect, it, vi } from "vitest";
import { ConsultarNormas } from "../src/community/application/consultar-normas.js";

const document = {
  id: "vigentes", titulo: "Construyamos una comunidad que sume", introduccion: "Mensaje de los administradores.",
  normas: ["Compartí experiencias reales.", "Respetá la privacidad."], cierre: "De estudiantes, para estudiantes.",
  createdAt: new Date("2026-01-01T00:00:00.000Z"), updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

describe("HU-C01 consulta de normas vigentes", () => {
  it("devuelve el documento persistido con su orden y fechas, sin guardar una copia ni resembrar", async () => {
    const repository = { obtenerVigentes: vi.fn().mockResolvedValue(document), actualizarVigentes: vi.fn() };
    await expect(new ConsultarNormas(repository).execute()).resolves.toEqual(document);
    expect(repository.obtenerVigentes).toHaveBeenCalledExactlyOnceWith();
    expect(repository.actualizarVigentes).not.toHaveBeenCalled();
  });

  it("informa que las normas no están disponibles cuando todavía no existe el documento", async () => {
    const repository = { obtenerVigentes: vi.fn().mockResolvedValue(null), actualizarVigentes: vi.fn() };
    await expect(new ConsultarNormas(repository).execute()).rejects.toMatchObject({ httpStatus: 404 });
    expect(repository.actualizarVigentes).not.toHaveBeenCalled();
  });

  it("no disfraza una falla de persistencia como documento vacío ni responde con un texto hardcodeado", async () => {
    const unavailable = new Error("database unavailable");
    const repository = { obtenerVigentes: vi.fn().mockRejectedValue(unavailable), actualizarVigentes: vi.fn() };
    await expect(new ConsultarNormas(repository).execute()).rejects.toBe(unavailable);
    expect(repository.actualizarVigentes).not.toHaveBeenCalled();
  });
});
