import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateId } from "../src/academic/application/academic-id.js";
import { MateriaNotFoundError, CursadaNotFoundError, InvalidIdError } from "../src/academic/application/errors.js";
import { validatePagination } from "../src/shared/domain/pagination-input.js";
import { InvalidPaginationError } from "../src/shared/domain/errors.js";
import { fixture } from "./academic-fixture.js";

describe("ListarMaterias", () => {
  it("usa paginación default cuando no se envía input", async () => {
    const { listarMaterias, addMateria } = fixture();
    addMateria("Álgebra"); addMateria("Análisis");
    const result = await listarMaterias.execute(undefined);
    expect(result).toMatchObject({ page: 1, pageSize: 20, total: 2 });
    expect(result.items).toHaveLength(2);
  });

  it("respeta paginación explícita", async () => {
    const { listarMaterias, addMateria } = fixture();
    const [first, second] = [addMateria("Álgebra"), addMateria("Análisis")];
    const result = await listarMaterias.execute({ page: 2, pageSize: 1 });
    expect(result).toMatchObject({ page: 2, pageSize: 1, total: 2 });
    expect(result.items).toEqual([second]);
    expect(first).toBeTruthy();
  });

  it("pageSize fuera de rango tira InvalidPaginationError sin consultar el repositorio", async () => {
    const { listarMaterias, materiaRepository } = fixture();
    await expect(listarMaterias.execute({ pageSize: 101 })).rejects.toBeInstanceOf(InvalidPaginationError);
    expect(materiaRepository.findAll).not.toHaveBeenCalled();
  });
});

describe("ListarCursadasPorMateria", () => {
  it("resuelve el profesor por nombre y proyecta solo id/anio/cuatrimestre/profesor", async () => {
    const { listarCursadasPorMateria, addMateria, addProfesor, addCursada } = fixture();
    const materia = addMateria("Álgebra");
    const profesor = addProfesor("Ada Lovelace");
    const cursada = addCursada(materia.id, profesor.id, 2025);
    const result = await listarCursadasPorMateria.execute(materia.id, undefined);
    expect(result.items).toEqual([{ id: cursada.id, anio: 2025, cuatrimestre: "PRIMERO", profesor: "Ada Lovelace" }]);
    expect(Object.keys(result.items[0]!).sort()).toEqual(["anio", "cuatrimestre", "id", "profesor"]);
  });

  it("materiaId no-UUID tira InvalidIdError sin tocar los repositorios", async () => {
    const { listarCursadasPorMateria, materiaRepository, cursadaRepository } = fixture();
    await expect(listarCursadasPorMateria.execute("not-a-uuid", undefined)).rejects.toBeInstanceOf(InvalidIdError);
    expect(materiaRepository.findById).not.toHaveBeenCalled();
    expect(cursadaRepository.findByMateriaId).not.toHaveBeenCalled();
  });

  it("materiaId válido pero inexistente tira MateriaNotFoundError", async () => {
    const { listarCursadasPorMateria, cursadaRepository } = fixture();
    await expect(listarCursadasPorMateria.execute(randomUUID(), undefined)).rejects.toBeInstanceOf(MateriaNotFoundError);
    expect(cursadaRepository.findByMateriaId).not.toHaveBeenCalled();
  });

  it("devuelve profesor vacío cuando el profesor referenciado no existe", async () => {
    const { listarCursadasPorMateria, addMateria, addCursada } = fixture();
    const materia = addMateria("Álgebra");
    addCursada(materia.id, randomUUID());
    const result = await listarCursadasPorMateria.execute(materia.id, undefined);
    expect(result.items[0]?.profesor).toBe("");
  });
});

describe("ListarComisionesPorCursada", () => {
  it("lista las comisiones de una cursada existente", async () => {
    const { listarComisionesPorCursada, addMateria, addProfesor, addCursada, addComision } = fixture();
    const materia = addMateria("Álgebra");
    const profesor = addProfesor("Ada Lovelace");
    const cursada = addCursada(materia.id, profesor.id);
    const comision = addComision(cursada.id, "Comisión A");
    const result = await listarComisionesPorCursada.execute(cursada.id, undefined);
    expect(result.items).toEqual([comision]);
  });

  it("cursadaId no-UUID tira InvalidIdError sin tocar los repositorios", async () => {
    const { listarComisionesPorCursada, cursadaRepository, comisionRepository } = fixture();
    await expect(listarComisionesPorCursada.execute("not-a-uuid", undefined)).rejects.toBeInstanceOf(InvalidIdError);
    expect(cursadaRepository.findById).not.toHaveBeenCalled();
    expect(comisionRepository.findByCursadaId).not.toHaveBeenCalled();
  });

  it("cursadaId válido pero inexistente tira CursadaNotFoundError", async () => {
    const { listarComisionesPorCursada, comisionRepository } = fixture();
    await expect(listarComisionesPorCursada.execute(randomUUID(), undefined)).rejects.toBeInstanceOf(CursadaNotFoundError);
    expect(comisionRepository.findByCursadaId).not.toHaveBeenCalled();
  });
});

describe("validateId", () => {
  it("acepta un UUID válido y lo devuelve igual", () => {
    const id = randomUUID();
    expect(validateId(id)).toBe(id);
  });

  it("rechaza un string que no es UUID", () => {
    expect(() => validateId("not-a-uuid")).toThrow(InvalidIdError);
  });

  it.each([
    (uuid: string) => `evil${uuid}`,
    (uuid: string) => `${uuid}evil`,
    (uuid: string) => ` ${uuid}`,
    (uuid: string) => `${uuid}\n`,
  ])("rechaza un UUID válido con basura pegada alrededor", (spoof) => {
    expect(() => validateId(spoof(randomUUID()))).toThrow(InvalidIdError);
  });
});

describe("validatePagination", () => {
  it("sin input usa page=1 y pageSize=20", () => {
    expect(validatePagination(undefined)).toEqual({ page: 1, pageSize: 20 });
  });

  it("page=0 tira InvalidPaginationError", () => {
    expect(() => validatePagination({ page: 0 })).toThrow(InvalidPaginationError);
  });

  it("pageSize=101 tira InvalidPaginationError", () => {
    expect(() => validatePagination({ pageSize: 101 })).toThrow(InvalidPaginationError);
  });

  it("pageSize=100 pasa en el límite exacto", () => {
    expect(validatePagination({ pageSize: 100 })).toEqual({ page: 1, pageSize: 100 });
  });
});
