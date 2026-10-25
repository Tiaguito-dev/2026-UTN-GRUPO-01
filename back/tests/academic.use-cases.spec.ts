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
  it("proyecta el resumen sin campos internos", async () => {
    const { listarCursadasPorMateria, addMateria, addCursada } = fixture();
    const materia = addMateria("Álgebra");
    const cursada = addCursada(materia.id, 2025);
    const result = await listarCursadasPorMateria.execute(materia.id, undefined);
    expect(result.items).toEqual([{ id: cursada.id, anio: 2025, cuatrimestre: "PRIMERO", comisiones: 0, profesores: 0, carreras: [] }]);
    expect(Object.keys(result.items[0]!).sort()).toEqual(["anio", "carreras", "comisiones", "cuatrimestre", "id", "profesores"]);
  });

  it("filtra comisiones inactivas y dadas de baja al calcular el resumen", async () => {
    const f = fixture();
    const materia = f.addMateria("Análisis II", "2");
    const cursada = f.addCursada(materia.id);
    const [ada, alan] = [f.addProfesor("Ada Lovelace"), f.addProfesor("Alan Turing")];
    const q1 = f.addComision(cursada.id, "Q", 1);
    const s1 = f.addComision(cursada.id, "S", 1);
    f.addComision(cursada.id, "M", 1).activa = false;
    f.addComision(cursada.id, "I", 1).deletedAt = new Date();
    f.asignaciones.set(`${q1.id}:${ada.id}`, "TITULAR");
    f.asignaciones.set(`${s1.id}:${ada.id}`, "ADJUNTO");
    f.asignaciones.set(`${s1.id}:${alan.id}`, "JTP");
    const result = await f.listarCursadasPorMateria.execute(materia.id, undefined);
    expect(result.items).toEqual([{ id: cursada.id, anio: 2026, cuatrimestre: "PRIMERO", comisiones: 2, profesores: 2, carreras: ["S", "Q"] }]);
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
});

describe("ListarComisionesPorCursada", () => {
  it("lista las comisiones de una cursada existente", async () => {
    const { listarComisionesPorCursada, addMateria, addCursada, addComision } = fixture();
    const materia = addMateria("Álgebra");
    const cursada = addCursada(materia.id);
    const comision = addComision(cursada.id, "S", 1);
    const result = await listarComisionesPorCursada.execute(cursada.id, undefined);
    expect(result.items).toEqual([comision]);
  });

  it("cursadaId no-UUID tira InvalidIdError sin consultar el repositorio", async () => {
    const { listarComisionesPorCursada, comisionRepository } = fixture();
    await expect(listarComisionesPorCursada.execute("not-a-uuid", undefined)).rejects.toBeInstanceOf(InvalidIdError);
    expect(comisionRepository.findByCursadaId).not.toHaveBeenCalled();
  });

  it("cursadaId válido pero inexistente tira CursadaNotFoundError", async () => {
    const { listarComisionesPorCursada, comisionRepository } = fixture();
    await expect(listarComisionesPorCursada.execute(randomUUID(), undefined)).rejects.toBeInstanceOf(CursadaNotFoundError);
    expect(comisionRepository.findByCursadaId).not.toHaveBeenCalled();
  });

  it("cursadaId de cursada dada de baja tira CursadaNotFoundError", async () => {
    const { listarComisionesPorCursada, comisionRepository, addMateria, addCursada } = fixture();
    const cursada = addCursada(addMateria("Álgebra").id);
    cursada.deletedAt = new Date();
    await expect(listarComisionesPorCursada.execute(cursada.id, undefined)).rejects.toBeInstanceOf(CursadaNotFoundError);
    expect(comisionRepository.findByCursadaId).not.toHaveBeenCalled();
  });
});

describe("ObtenerMateria", () => {
  it("devuelve la materia encontrada por id", async () => {
    const { materiaRepository, addMateria } = fixture();
    const materia = addMateria("Álgebra");
    const result = await new ObtenerMateria(materiaRepository).execute(materia.id);
    expect(result).toEqual(materia);
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
  const obtener = (f: ReturnType<typeof fixture>) => new ObtenerCursada(f.cursadaRepository, f.materiaRepository);

  it("devuelve el resumen de la cursada más la materia, y nada más", async () => {
    const f = fixture();
    const materia = f.addMateria("Álgebra");
    const cursada = f.addCursada(materia.id, 2025);
    f.addComision(cursada.id, "S", 1);
    await expect(obtener(f).execute(cursada.id)).resolves.toStrictEqual({
      id: cursada.id, anio: 2025, cuatrimestre: "PRIMERO", comisiones: 1, profesores: 0, carreras: ["S"],
      materia: { id: materia.id, nombre: "Álgebra" },
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
    const cursada = f.addCursada(f.addMateria("Álgebra").id);
    cursada.deletedAt = new Date();
    await expect(obtener(f).execute(cursada.id)).rejects.toBeInstanceOf(CursadaNotFoundError);
  });

  it("una cursada cuya materia está dada de baja tira CursadaNotFoundError", async () => {
    const f = fixture();
    const materia = f.addMateria("Álgebra");
    const cursada = f.addCursada(materia.id);
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
  it("acepta paginación válida", () => {
    expect(validatePagination({ page: 2, pageSize: 10 })).toEqual({ page: 2, pageSize: 10 });
  });

  it("convierte strings numéricos", () => {
    expect(validatePagination({ page: "3", pageSize: "5" })).toEqual({ page: 3, pageSize: 5 });
  });

  it("aplica defaults cuando faltan campos", () => {
    expect(validatePagination({})).toEqual({ page: 1, pageSize: 20 });
    expect(validatePagination(undefined)).toEqual({ page: 1, pageSize: 20 });
  });

  it.each([
    ["página 0", { page: 0 }],
    ["página negativa", { page: -1 }],
    ["página decimal", { page: 1.5 }],
    ["pageSize 0", { pageSize: 0 }],
    ["pageSize negativo", { pageSize: -5 }],
    ["pageSize mayor que 100", { pageSize: 101 }],
    ["página no numérica", { page: "abc" }],
  ])("rechaza %s con InvalidPaginationError", (_caso, input) => {
    expect(() => validatePagination(input)).toThrow(InvalidPaginationError);
  });
});
