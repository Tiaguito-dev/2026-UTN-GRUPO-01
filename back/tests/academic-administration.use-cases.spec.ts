import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { EliminarAcademico } from "../src/academic/application/eliminar-academico.js";
import { ListarHistorialAcademico } from "../src/academic/application/listar-historial-academico.js";
import { ListarProfesores } from "../src/academic/application/listar-profesores.js";
import type { ProfesorRepository } from "../src/academic/application/ports/profesor.repository.js";

describe("Administración académica TASK-070", () => {
  it("valida filtros de profesores y los entrega antes de paginar", async () => {
    const findAll = vi.fn().mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 9 });
    const listar = new ListarProfesores({ findAll } as unknown as ProfesorRepository);
    await listar.execute({ q: "  GARCÍA%_  ", page: 2, pageSize: 9 });
    expect(findAll).toHaveBeenCalledWith({ page: 2, pageSize: 9 }, { q: "GARCÍA%_" });
    for (const q of ["a".repeat(151), "a\u0000b", ["uno", "dos"]]) {
      await expect(listar.execute({ q })).rejects.toMatchObject({ httpStatus: 400 });
    }
    expect(findAll).toHaveBeenCalledTimes(1);
  });

  it("baja con entidad, UUID y actor válidos delega una sola operación atómica", async () => {
    const repository = { eliminar: vi.fn().mockResolvedValue(undefined), historial: vi.fn() };
    const eliminar = new EliminarAcademico(repository);
    const id = randomUUID(); const actorId = randomUUID();
    await eliminar.execute("profesor", id, actorId);
    expect(repository.eliminar).toHaveBeenCalledExactlyOnceWith("profesor", id, actorId);
    await expect(eliminar.execute("profesor", "no-uuid", actorId)).rejects.toMatchObject({ httpStatus: 400 });
    await expect(eliminar.execute("profesor", id, undefined)).rejects.toMatchObject({ httpStatus: expect.any(Number) });
    expect(repository.eliminar).toHaveBeenCalledTimes(1);
  });

  it("historial pide tres registros, valida paginación y UUID antes del puerto", async () => {
    const repository = { eliminar: vi.fn(), historial: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 3 }) };
    const historial = new ListarHistorialAcademico(repository);
    const id = randomUUID();
    await historial.execute("comision", id, undefined);
    expect(repository.historial).toHaveBeenCalledWith("comision", id, { page: 1, pageSize: 3 });
    await expect(historial.execute("comision", id, { page: 0 })).rejects.toMatchObject({ httpStatus: 400 });
    await expect(historial.execute("comision", "no-uuid", {})).rejects.toMatchObject({ httpStatus: 400 });
    expect(repository.historial).toHaveBeenCalledTimes(1);
  });
});
