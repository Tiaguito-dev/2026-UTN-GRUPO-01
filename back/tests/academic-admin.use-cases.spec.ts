import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateCrearMateriaInput } from "../src/academic/application/crear-materia-input.js";
import { validateCrearProfesorInput } from "../src/academic/application/crear-profesor-input.js";
import { validateCrearCursadaInput, ANIO_MINIMO, anioMaximo } from "../src/academic/application/crear-cursada-input.js";
import { validateCrearComisionInput } from "../src/academic/application/crear-comision-input.js";
import {
  CAMPOS_NO_PERMITIDOS,
  ComisionAlreadyExistsError,
  CursadaAlreadyExistsError,
  CursadaNotFoundError,
  InvalidAcademicInputError,
  MateriaAlreadyExistsError,
  MateriaNotFoundError,
  ProfesorNotFoundError,
} from "../src/academic/application/errors.js";
import { InvalidPaginationError } from "../src/shared/domain/errors.js";
import { fixture } from "./academic-fixture.js";

describe("CrearMateria", () => {
  it("crea la materia y la delega al puerto con el nombre recortado", async () => {
    const { crearMateria, materiaRepository } = fixture();
    const materia = await crearMateria.execute({ nombre: "  Álgebra  " });
    expect(materia).toMatchObject({ nombre: "Álgebra", deletedAt: null });
    expect(materia.id).toEqual(expect.any(String));
    expect(materiaRepository.create).toHaveBeenCalledWith({ nombre: "Álgebra" });
  });

  it("nombre duplicado tira MateriaAlreadyExistsError sin volver a crear", async () => {
    const { crearMateria, materiaRepository, addMateria } = fixture();
    addMateria("Álgebra");
    await expect(crearMateria.execute({ nombre: "Álgebra" })).rejects.toBeInstanceOf(MateriaAlreadyExistsError);
    expect(materiaRepository.create).not.toHaveBeenCalled();
  });

  it("detecta el duplicado después del trim, no sobre el texto crudo", async () => {
    const { crearMateria, addMateria } = fixture();
    addMateria("Álgebra");
    await expect(crearMateria.execute({ nombre: "  Álgebra  " })).rejects.toBeInstanceOf(MateriaAlreadyExistsError);
  });

  it("input inválido no toca el repositorio", async () => {
    const { crearMateria, materiaRepository } = fixture();
    await expect(crearMateria.execute({ nombre: "   " })).rejects.toBeInstanceOf(InvalidAcademicInputError);
    expect(materiaRepository.findByNombre).not.toHaveBeenCalled();
    expect(materiaRepository.create).not.toHaveBeenCalled();
  });
});

describe("CrearProfesor", () => {
  it("crea el profesor y lo delega al puerto con el nombre recortado", async () => {
    const { crearProfesor, profesorRepository } = fixture();
    const profesor = await crearProfesor.execute({ nombreCompleto: " Ada Lovelace " });
    expect(profesor).toMatchObject({ nombreCompleto: "Ada Lovelace", deletedAt: null });
    expect(profesorRepository.create).toHaveBeenCalledWith({ nombreCompleto: "Ada Lovelace" });
  });

  // Decisión del modelo de TASK-014/019: Profesor.nombreCompleto NO tiene restricción única.
  // Los homónimos son reales en una facultad. Si este test empieza a fallar es porque alguien
  // "arregló" un duplicado que no es un error.
  it("acepta dos profesores con el mismo nombre completo (los homónimos son válidos)", async () => {
    const { crearProfesor, profesorRepository } = fixture();
    const primero = await crearProfesor.execute({ nombreCompleto: "Juan Pérez" });
    const segundo = await crearProfesor.execute({ nombreCompleto: "Juan Pérez" });
    expect(segundo.nombreCompleto).toBe(primero.nombreCompleto);
    expect(segundo.id).not.toBe(primero.id);
    expect(profesorRepository.create).toHaveBeenCalledTimes(2);
  });

  it("input inválido no toca el repositorio", async () => {
    const { crearProfesor, profesorRepository } = fixture();
    await expect(crearProfesor.execute({ nombreCompleto: "" })).rejects.toBeInstanceOf(InvalidAcademicInputError);
    expect(profesorRepository.create).not.toHaveBeenCalled();
  });
});

describe("CrearCursada", () => {
  function conJerarquia() {
    const f = fixture();
    const materia = f.addMateria("Álgebra");
    const profesor = f.addProfesor("Ada Lovelace");
    return { ...f, materia, profesor };
  }

  it("crea la cursada y la delega al puerto con los datos validados", async () => {
    const { crearCursada, cursadaRepository, materia, profesor } = conJerarquia();
    const datos = { materiaId: materia.id, profesorId: profesor.id, anio: 2026, cuatrimestre: "PRIMERO" as const };
    const cursada = await crearCursada.execute(datos);
    expect(cursada).toMatchObject(datos);
    expect(cursadaRepository.create).toHaveBeenCalledWith(datos);
  });

  it("materia inexistente tira MateriaNotFoundError y no consulta el profesor", async () => {
    const { crearCursada, profesorRepository, cursadaRepository, profesor } = conJerarquia();
    const promesa = crearCursada.execute({ materiaId: randomUUID(), profesorId: profesor.id, anio: 2026, cuatrimestre: "PRIMERO" });
    await expect(promesa).rejects.toBeInstanceOf(MateriaNotFoundError);
    expect(profesorRepository.findById).not.toHaveBeenCalled();
    expect(cursadaRepository.create).not.toHaveBeenCalled();
  });

  it("profesor inexistente tira ProfesorNotFoundError (error distinto al de materia)", async () => {
    const { crearCursada, cursadaRepository, materia } = conJerarquia();
    const promesa = crearCursada.execute({ materiaId: materia.id, profesorId: randomUUID(), anio: 2026, cuatrimestre: "PRIMERO" });
    await expect(promesa).rejects.toBeInstanceOf(ProfesorNotFoundError);
    await expect(promesa).rejects.not.toBeInstanceOf(MateriaNotFoundError);
    expect(cursadaRepository.create).not.toHaveBeenCalled();
  });

  it("misma materia, año y cuatrimestre tira CursadaAlreadyExistsError", async () => {
    const { crearCursada, cursadaRepository, addCursada, materia, profesor } = conJerarquia();
    addCursada(materia.id, profesor.id, 2026);
    const promesa = crearCursada.execute({ materiaId: materia.id, profesorId: profesor.id, anio: 2026, cuatrimestre: "PRIMERO" });
    await expect(promesa).rejects.toBeInstanceOf(CursadaAlreadyExistsError);
    expect(cursadaRepository.create).not.toHaveBeenCalled();
  });

  it("el otro cuatrimestre de la misma materia y año es una cursada distinta", async () => {
    const { crearCursada, addCursada, materia, profesor } = conJerarquia();
    addCursada(materia.id, profesor.id, 2026);
    const cursada = await crearCursada.execute({ materiaId: materia.id, profesorId: profesor.id, anio: 2026, cuatrimestre: "SEGUNDO" });
    expect(cursada.cuatrimestre).toBe("SEGUNDO");
  });

  it("el mismo período con otra materia es una cursada distinta", async () => {
    const { crearCursada, addMateria, addCursada, materia, profesor } = conJerarquia();
    addCursada(materia.id, profesor.id, 2026);
    const otra = addMateria("Análisis Matemático");
    const cursada = await crearCursada.execute({ materiaId: otra.id, profesorId: profesor.id, anio: 2026, cuatrimestre: "PRIMERO" });
    expect(cursada.materiaId).toBe(otra.id);
  });
});

describe("CrearComision", () => {
  function conCursada() {
    const f = fixture();
    const materia = f.addMateria("Álgebra");
    const profesor = f.addProfesor("Ada Lovelace");
    const cursada = f.addCursada(materia.id, profesor.id);
    return { ...f, cursada };
  }

  it("crea la comisión activa y la delega al puerto con el nombre recortado", async () => {
    const { crearComision, comisionRepository, cursada } = conCursada();
    const comision = await crearComision.execute({ cursadaId: cursada.id, nombre: " Comisión 1 - Mañana " });
    expect(comision).toMatchObject({ cursadaId: cursada.id, nombre: "Comisión 1 - Mañana", activa: true });
    expect(comisionRepository.create).toHaveBeenCalledWith({ cursadaId: cursada.id, nombre: "Comisión 1 - Mañana" });
  });

  it("cursada inexistente tira CursadaNotFoundError sin buscar duplicados", async () => {
    const { crearComision, comisionRepository } = conCursada();
    const promesa = crearComision.execute({ cursadaId: randomUUID(), nombre: "Comisión 1" });
    await expect(promesa).rejects.toBeInstanceOf(CursadaNotFoundError);
    expect(comisionRepository.findByCursadaIdAndNombre).not.toHaveBeenCalled();
    expect(comisionRepository.create).not.toHaveBeenCalled();
  });

  it("nombre repetido en la misma cursada tira ComisionAlreadyExistsError", async () => {
    const { crearComision, comisionRepository, addComision, cursada } = conCursada();
    addComision(cursada.id, "Comisión 1");
    await expect(crearComision.execute({ cursadaId: cursada.id, nombre: "Comisión 1" })).rejects.toBeInstanceOf(ComisionAlreadyExistsError);
    expect(comisionRepository.create).not.toHaveBeenCalled();
  });

  // Decisión 6 de TASK-019: la unicidad es (cursadaId, nombre), no global.
  it("acepta el mismo nombre de comisión en otra cursada", async () => {
    const { crearComision, addMateria, addProfesor, addCursada, addComision, cursada } = conCursada();
    addComision(cursada.id, "Comisión 1 - Mañana");
    const otra = addCursada(addMateria("Análisis Matemático").id, addProfesor("Alan Turing").id);
    const comision = await crearComision.execute({ cursadaId: otra.id, nombre: "Comisión 1 - Mañana" });
    expect(comision).toMatchObject({ cursadaId: otra.id, nombre: "Comisión 1 - Mañana" });
  });
});

describe("ListarProfesores", () => {
  it("usa paginación default cuando no se envía input", async () => {
    const { listarProfesores, addProfesor } = fixture();
    addProfesor("Ada Lovelace");
    addProfesor("Alan Turing");
    const result = await listarProfesores.execute(undefined);
    expect(result).toMatchObject({ page: 1, pageSize: 20, total: 2 });
    expect(result.items).toHaveLength(2);
  });

  it("respeta paginación explícita", async () => {
    const { listarProfesores, addProfesor } = fixture();
    addProfesor("Ada Lovelace");
    const segundo = addProfesor("Alan Turing");
    const result = await listarProfesores.execute({ page: 2, pageSize: 1 });
    expect(result).toMatchObject({ page: 2, pageSize: 1, total: 2 });
    expect(result.items).toEqual([segundo]);
  });

  it("pageSize fuera de rango tira InvalidPaginationError sin consultar el repositorio", async () => {
    const { listarProfesores, profesorRepository } = fixture();
    await expect(listarProfesores.execute({ pageSize: 101 })).rejects.toBeInstanceOf(InvalidPaginationError);
    expect(profesorRepository.findAll).not.toHaveBeenCalled();
  });
});

describe("validateCrearMateriaInput", () => {
  it("recorta el nombre", () => {
    expect(validateCrearMateriaInput({ nombre: "  Álgebra  " })).toEqual({ nombre: "Álgebra" });
  });

  it("acepta 150 caracteres, el límite exacto del VarChar", () => {
    const nombre = "a".repeat(150);
    expect(validateCrearMateriaInput({ nombre })).toEqual({ nombre });
  });

  it.each([
    ["vacío", ""],
    ["solo espacios", "   "],
    ["con salto de línea", "Álgebra\nLineal"],
    ["con tabulación", "Álgebra\tI"],
    ["con carácter DEL", "Álgebra\u007F"],
    ["más largo que el VarChar", "a".repeat(151)],
    ["no string", 42],
    ["faltante", undefined],
  ])("rechaza el nombre %s", (_caso, nombre) => {
    expect(() => validateCrearMateriaInput({ nombre })).toThrow(InvalidAcademicInputError);
  });

  it("rechaza un cuerpo con campos de más", () => {
    expect(() => validateCrearMateriaInput({ nombre: "Álgebra", id: randomUUID() })).toThrow(CAMPOS_NO_PERMITIDOS);
  });
});

describe("validateCrearProfesorInput", () => {
  it("recorta el nombre completo", () => {
    expect(validateCrearProfesorInput({ nombreCompleto: " Ada Lovelace " })).toEqual({ nombreCompleto: "Ada Lovelace" });
  });

  it("acepta 150 caracteres, el límite exacto del VarChar", () => {
    const nombreCompleto = "a".repeat(150);
    expect(validateCrearProfesorInput({ nombreCompleto })).toEqual({ nombreCompleto });
  });

  it.each([
    ["vacío", ""],
    ["solo espacios", " \t "],
    ["con caracteres de control", "Ada\u0000Lovelace"],
    ["más largo que el VarChar", "a".repeat(151)],
    ["faltante", undefined],
  ])("rechaza el nombre completo %s", (_caso, nombreCompleto) => {
    expect(() => validateCrearProfesorInput({ nombreCompleto })).toThrow(InvalidAcademicInputError);
  });

  it("rechaza un cuerpo con campos de más", () => {
    expect(() => validateCrearProfesorInput({ nombreCompleto: "Ada Lovelace", nombre: "Ada" })).toThrow(CAMPOS_NO_PERMITIDOS);
  });
});

describe("validateCrearCursadaInput", () => {
  const base = { materiaId: randomUUID(), profesorId: randomUUID(), cuatrimestre: "PRIMERO" as const };

  it.each([ANIO_MINIMO, anioMaximo()])("acepta el año %i, límite exacto del rango", (anio) => {
    expect(validateCrearCursadaInput({ ...base, anio })).toEqual({ ...base, anio });
  });

  it.each([
    ["anterior al mínimo", ANIO_MINIMO - 1],
    ["posterior al máximo", anioMaximo() + 1],
    ["no entero", 2026.5],
    ["string", "2026"],
    ["faltante", undefined],
  ])("rechaza el año %s", (_caso, anio) => {
    expect(() => validateCrearCursadaInput({ ...base, anio })).toThrow(InvalidAcademicInputError);
  });

  it("el año máximo es el siguiente al actual", () => {
    expect(anioMaximo(new Date("2031-06-15T00:00:00Z"))).toBe(2032);
  });

  it.each(["PRIMERO", "SEGUNDO"])("acepta el cuatrimestre %s", (cuatrimestre) => {
    expect(validateCrearCursadaInput({ ...base, cuatrimestre, anio: 2026 })).toMatchObject({ cuatrimestre });
  });

  it.each(["TERCERO", "primero", "", 1, undefined])("rechaza el cuatrimestre %s", (cuatrimestre) => {
    expect(() => validateCrearCursadaInput({ ...base, cuatrimestre, anio: 2026 })).toThrow(InvalidAcademicInputError);
  });

  it.each(["materiaId", "profesorId"])("rechaza %s cuando no es UUID", (campo) => {
    expect(() => validateCrearCursadaInput({ ...base, anio: 2026, [campo]: "not-a-uuid" })).toThrow(InvalidAcademicInputError);
  });

  it("rechaza un cuerpo con campos de más", () => {
    expect(() => validateCrearCursadaInput({ ...base, anio: 2026, activa: true })).toThrow(CAMPOS_NO_PERMITIDOS);
  });
});

describe("validateCrearComisionInput", () => {
  const cursadaId = randomUUID();

  it("recorta el nombre", () => {
    expect(validateCrearComisionInput({ cursadaId, nombre: "  Comisión 1  " })).toEqual({ cursadaId, nombre: "Comisión 1" });
  });

  it("acepta 100 caracteres, el límite exacto del VarChar", () => {
    const nombre = "a".repeat(100);
    expect(validateCrearComisionInput({ cursadaId, nombre })).toEqual({ cursadaId, nombre });
  });

  it.each([
    ["vacío", ""],
    ["solo espacios", "  "],
    ["con caracteres de control", "Comisión\r1"],
    ["más largo que el VarChar", "a".repeat(101)],
    ["faltante", undefined],
  ])("rechaza el nombre %s", (_caso, nombre) => {
    expect(() => validateCrearComisionInput({ cursadaId, nombre })).toThrow(InvalidAcademicInputError);
  });

  it("rechaza cursadaId que no es UUID", () => {
    expect(() => validateCrearComisionInput({ cursadaId: "not-a-uuid", nombre: "Comisión 1" })).toThrow(InvalidAcademicInputError);
  });

  it("rechaza un cuerpo con campos de más", () => {
    expect(() => validateCrearComisionInput({ cursadaId, nombre: "Comisión 1", activa: false })).toThrow(CAMPOS_NO_PERMITIDOS);
  });
});
