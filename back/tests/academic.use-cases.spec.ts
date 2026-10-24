import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateId } from "../src/academic/application/academic-id.js";
import { MateriaNotFoundError, CursadaNotFoundError, InvalidIdError } from "../src/academic/application/errors.js";
import { validatePagination } from "../src/shared/domain/pagination-input.js";
import { InvalidPaginationError } from "../src/shared/domain/errors.js";
import { ObtenerMateria } from "../src/academic/application/obtener-materia.js";
import { ObtenerCursada } from "../src/academic/application/obtener-cursada.js";
import { fixture } from "./academic-fixture.js";

describe("ListarMaterias", () => {
  it("usa paginación default cuando no se envía input", async () => {
    const { listarMaterias, addMateria } = fixture();
    addMateria("Álgebra"); addMateria("Análisis");
    const result = await listarMaterias.execute(undefined);
    expect(result).toMatchObject({ page: 1, pageSize: 9, total: 2 });
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

describe("ObtenerMateria", () => {
  it("devuelve la materia con la misma forma que un ítem del listado", async () => {
    const { materiaRepository, addMateria } = fixture();
    const materia = addMateria("Álgebra", "1");
    await expect(new ObtenerMateria(materiaRepository).execute(materia.id)).resolves.toEqual(materia);
  });

  it("id no-UUID tira InvalidIdError sin tocar el repositorio", async () => {
    const { materiaRepository } = fixture();
    await expect(new ObtenerMateria(materiaRepository).execute("not-a-uuid")).rejects.toBeInstanceOf(InvalidIdError);
    expect(materiaRepository.findById).not.toHaveBeenCalled();
  });

  it("id válido pero inexistente tira MateriaNotFoundError", async () => {
    const { materiaRepository } = fixture();
    await expect(new ObtenerMateria(materiaRepository).execute(randomUUID())).rejects.toBeInstanceOf(MateriaNotFoundError);
  });

  it("una materia dada de baja tira MateriaNotFoundError", async () => {
    const { materiaRepository, addMateria } = fixture();
    const materia = addMateria("Álgebra");
    materia.deletedAt = new Date();
    await expect(new ObtenerMateria(materiaRepository).execute(materia.id)).rejects.toBeInstanceOf(MateriaNotFoundError);
  });
});

describe("ObtenerCursada", () => {
  const obtener = (f: ReturnType<typeof fixture>) => new ObtenerCursada(f.cursadaRepository, f.materiaRepository, f.profesorRepository);

  it("devuelve el resumen de la cursada más la materia, y nada más", async () => {
    const f = fixture();
    const materia = f.addMateria("Álgebra");
    const profesor = f.addProfesor("Ada Lovelace");
    const cursada = f.addCursada(materia.id, profesor.id, 2025);
    await expect(obtener(f).execute(cursada.id)).resolves.toStrictEqual({
      id: cursada.id, anio: 2025, cuatrimestre: "PRIMERO", profesor: "Ada Lovelace", materia: { id: materia.id, nombre: "Álgebra" },
    });
  });

  it("id no-UUID tira InvalidIdError sin tocar los repositorios", async () => {
    const f = fixture();
    await expect(obtener(f).execute("not-a-uuid")).rejects.toBeInstanceOf(InvalidIdError);
    expect(f.cursadaRepository.findById).not.toHaveBeenCalled();
  });

  it("id válido pero inexistente tira CursadaNotFoundError", async () => {
    const f = fixture();
    await expect(obtener(f).execute(randomUUID())).rejects.toBeInstanceOf(CursadaNotFoundError);
  });

  it("una cursada dada de baja tira CursadaNotFoundError", async () => {
    const f = fixture();
    const cursada = f.addCursada(f.addMateria("Álgebra").id, f.addProfesor("Ada Lovelace").id);
    cursada.deletedAt = new Date();
    await expect(obtener(f).execute(cursada.id)).rejects.toBeInstanceOf(CursadaNotFoundError);
  });

  it("una cursada cuya materia está dada de baja tira CursadaNotFoundError", async () => {
    const f = fixture();
    const materia = f.addMateria("Álgebra");
    const cursada = f.addCursada(materia.id, f.addProfesor("Ada Lovelace").id);
    materia.deletedAt = new Date();
    await expect(obtener(f).execute(cursada.id)).rejects.toBeInstanceOf(CursadaNotFoundError);
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
