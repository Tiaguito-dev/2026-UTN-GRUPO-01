import { describe, expect, it, vi } from "vitest";
import { ActualizarNormas } from "../src/community/application/actualizar-normas.js";
import { Prisma } from "../src/generated/prisma/client.js";
import { PrismaNormasRepository } from "../src/community/infrastructure/prisma-normas.repository.js";
import type { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";

const actor = "3df93a67-e694-4bc3-bc6a-42a6283060b6";
const input = { titulo: "Comunidad respetuosa", introduccion: "Introducción del equipo.", normas: ["Primera norma", "Segunda norma"], cierre: "Gracias por participar." };
const document = { ...input, id: "vigentes", createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-11-18T10:00:00Z") };
function fixture() { const repository = { obtenerVigentes: vi.fn(), actualizarVigentes: vi.fn().mockResolvedValue(document) }; return { repository, service: new ActualizarNormas(repository) }; }

describe("HU-C04 actualización de normas", () => {
  it("valida y recorta bordes conservando saltos internos y orden, tomando el actor del argumento de sesión", async () => {
    const { repository, service } = fixture();
    await expect(service.execute({ titulo: ` ${input.titulo} `, introduccion: " Párrafo uno.\n\nPárrafo dos. ", normas: [" Norma final primero ", " Norma inicial después "], cierre: ` ${input.cierre} ` }, actor)).resolves.toEqual(document);
    expect(repository.actualizarVigentes).toHaveBeenCalledExactlyOnceWith({ titulo: input.titulo, introduccion: "Párrafo uno.\n\nPárrafo dos.", normas: ["Norma final primero", "Norma inicial después"], cierre: input.cierre }, actor);
    expect(repository.obtenerVigentes).not.toHaveBeenCalled();
  });
  it.each([null, [], {}, { ...input, titulo: " " }, { ...input, titulo: "x".repeat(161) }, { ...input, introduccion: "\n " }, { ...input, cierre: " " }, { ...input, normas: [] }, { ...input, normas: [" "] }, { ...input, normas: [42] }, { ...input, normas: "texto" }, { ...input, actualizadoPorId: actor }, { ...input, createdAt: "2000-01-01" }, { ...input, id: "otro" }])("rechaza un documento inválido o propiedades ajenas sin escribir: %j", async body => {
    const { repository, service } = fixture();
    await expect(service.execute(body, actor)).rejects.toMatchObject({ httpStatus: 400 });
    expect(repository.actualizarVigentes).not.toHaveBeenCalled();
  });
  it("conserva la falla de persistencia para manejo global sin simular un guardado exitoso", async () => {
    const { repository, service } = fixture(); const failure = new Error("database failure");
    repository.actualizarVigentes.mockRejectedValue(failure);
    await expect(service.execute(input, actor)).rejects.toBe(failure);
  });
  it.each(["", "invalid", undefined, null])("rechaza actor ausente o inválido antes de la escritura: %s", async invalidActor => {
    const { repository, service } = fixture();
    await expect(service.execute(input, invalidActor)).rejects.toMatchObject({ httpStatus: 400 });
    expect(repository.actualizarVigentes).not.toHaveBeenCalled();
  });
  it("el repositorio traduce P2025 a documento no disponible sin crear uno nuevo", async () => {
    const update = vi.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "6.19.3" }));
    const prisma = { normasConvivencia: { update } } as unknown as PrismaService;
    await expect(new PrismaNormasRepository(prisma).actualizarVigentes(input, actor)).rejects.toMatchObject({ httpStatus: 404 });
    expect(update).toHaveBeenCalledTimes(1);
  });
});
