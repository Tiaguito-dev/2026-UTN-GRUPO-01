// Administrative mutations now forward an optional actor for transactional audit.
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
} from "../src/academic/application/errors.js";
import { InvalidPaginationError } from "../src/shared/domain/errors.js";
import { fixture } from "./academic-fixture.js";

describe("CrearMateria", () => {
  it("crea la materia y la delega al puerto con el nombre recortado", async () => {
    const { crearMateria, materiaRepository } = fixture();
    const materia = await crearMateria.execute({ modalidad: "ANUAL", nombre: "  Álgebra  ", carreras: [{ carrera: "S", anioCarrera: "1" }] });
    expect(materia).toMatchObject({ modalidad: "ANUAL", nombre: "Álgebra", deletedAt: null });
    expect(materia.id).toEqual(expect.any(String));
    expect(materiaRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      nombre: "Álgebra", carreras: [{ carrera: "S", anioCarrera: "1", nivelElectiva: null }] }), undefined);
  });

  it("nombre duplicado tira MateriaAlreadyExistsError sin volver a crear", async () => {
    const { crearMateria, materiaRepository, addMateria } = fixture();
    addMateria("Álgebra");
    await expect(crearMateria.execute({ modalidad: "ANUAL", nombre: "Álgebra", carreras: [{ carrera: "S", anioCarrera: "1" }] })).rejects.toBeInstanceOf(MateriaAlreadyExistsError);
    expect(materiaRepository.create).not.toHaveBeenCalled();
  });

  it("detecta el duplicado después del trim, no sobre el texto crudo", async () => {
    const { crearMateria, addMateria } = fixture();
    addMateria("Álgebra");
    await expect(crearMateria.execute({ modalidad: "ANUAL", nombre: "  Álgebra  ", carreras: [{ carrera: "S", anioCarrera: "1" }] })).rejects.toBeInstanceOf(MateriaAlreadyExistsError);
  });

  it("input inválido no toca el repositorio", async () => {
    const { crearMateria, materiaRepository } = fixture();
    await expect(crearMateria.execute({ modalidad: "ANUAL", nombre: "   ", carreras: [{ carrera: "S", anioCarrera: "1" }] })).rejects.toBeInstanceOf(InvalidAcademicInputError);
    expect(materiaRepository.findByNombre).not.toHaveBeenCalled();
    expect(materiaRepository.create).not.toHaveBeenCalled();
  });
});

describe("CrearProfesor", () => {
  it("crea el profesor y lo delega al puerto con el nombre recortado", async () => {
    const { crearProfesor, profesorRepository } = fixture();
    const profesor = await crearProfesor.execute({ nombreCompleto: " Ada Lovelace " });
    expect(profesor).toMatchObject({ nombreCompleto: "Ada Lovelace", deletedAt: null });
    expect(profesorRepository.create).toHaveBeenCalledWith({ nombreCompleto: "Ada Lovelace" }, undefined);
  });

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
    return { ...f, materia };
  }

  it("crea la cursada y la delega al puerto con los datos validados", async () => {
    const { crearCursada, cursadaRepository, materia } = conJerarquia();
    const datos = { materiaId: materia.id, anio: 2026, cuatrimestre: "PRIMERO" as const };
    const cursada = await crearCursada.execute(datos);
    expect(cursada).toMatchObject(datos);
    expect(cursadaRepository.create).toHaveBeenCalledWith(datos, undefined);
  });

  it("materia inexistente tira MateriaNotFoundError", async () => {
    const { crearCursada, cursadaRepository } = conJerarquia();
    const promesa = crearCursada.execute({ materiaId: randomUUID(), anio: 2026, cuatrimestre: "PRIMERO" });
    await expect(promesa).rejects.toBeInstanceOf(MateriaNotFoundError);
    expect(cursadaRepository.create).not.toHaveBeenCalled();
  });

  it("misma materia, año y cuatrimestre tira CursadaAlreadyExistsError", async () => {
    const { crearCursada, cursadaRepository, addCursada, materia } = conJerarquia();
    addCursada(materia.id, 2026);
    const promesa = crearCursada.execute({ materiaId: materia.id, anio: 2026, cuatrimestre: "PRIMERO" });
    await expect(promesa).rejects.toBeInstanceOf(CursadaAlreadyExistsError);
    expect(cursadaRepository.create).not.toHaveBeenCalled();
  });

  it("el otro cuatrimestre de la misma materia y año es una cursada distinta", async () => {
    const { crearCursada, addCursada, materia } = conJerarquia();
    addCursada(materia.id, 2026);
    const cursada = await crearCursada.execute({ materiaId: materia.id, anio: 2026, cuatrimestre: "SEGUNDO" });
    expect(cursada.cuatrimestre).toBe("SEGUNDO");
  });

  it("el mismo período con otra materia es una cursada distinta", async () => {
    const { crearCursada, addMateria, addCursada, materia } = conJerarquia();
    addCursada(materia.id, 2026);
    const otra = addMateria("Análisis Matemático");
    const cursada = await crearCursada.execute({ materiaId: otra.id, anio: 2026, cuatrimestre: "PRIMERO" });
    expect(cursada.materiaId).toBe(otra.id);
  });
});

describe("CrearComision", () => {
  function conCursada() {
    const f = fixture();
    const materia = f.addMateria("Álgebra");
    const cursada = f.addCursada(materia.id);
    return { ...f, cursada };
  }

  it("crea la comisión activa y la delega al puerto con carrera y número", async () => {
    const { crearComision, comisionRepository, cursada } = conCursada();
    const comision = await crearComision.execute({ cursadaId: cursada.id, carrera: "S", numero: 1 });
    expect(comision).toMatchObject({ cursadaId: cursada.id, carrera: "S", numero: 1, nombre: "S-1", activa: true });
    expect(comisionRepository.create).toHaveBeenCalledWith({ cursadaId: cursada.id, carrera: "S", numero: 1 }, undefined);
  });

  it("cursada inexistente tira CursadaNotFoundError sin buscar duplicados", async () => {
    const { crearComision, comisionRepository } = conCursada();
    const promesa = crearComision.execute({ cursadaId: randomUUID(), carrera: "S", numero: 1 });
    await expect(promesa).rejects.toBeInstanceOf(CursadaNotFoundError);
    expect(comisionRepository.findByCursadaIdCarreraNumero).not.toHaveBeenCalled();
    expect(comisionRepository.create).not.toHaveBeenCalled();
  });

  it("comisión repetida en la misma cursada tira ComisionAlreadyExistsError", async () => {
    const { crearComision, comisionRepository, addComision, cursada } = conCursada();
    addComision(cursada.id, "S", 1);
    await expect(crearComision.execute({ cursadaId: cursada.id, carrera: "S", numero: 1 })).rejects.toBeInstanceOf(ComisionAlreadyExistsError);
    expect(comisionRepository.create).not.toHaveBeenCalled();
  });

  it("acepta la misma comisión en otra cursada", async () => {
    const { crearComision, addMateria, addCursada, addComision, cursada } = conCursada();
    addComision(cursada.id, "S", 1);
    const otra = addCursada(addMateria("Análisis Matemático").id);
    const comision = await crearComision.execute({ cursadaId: otra.id, carrera: "S", numero: 1 });
    expect(comision).toMatchObject({ cursadaId: otra.id, carrera: "S", numero: 1, nombre: "S-1" });
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
    expect(validateCrearMateriaInput({ modalidad: "ANUAL", nombre: "  Álgebra  ", carreras: [{ carrera: "S", anioCarrera: "1" }] }))
      .toMatchObject({ modalidad: "ANUAL", nombre: "Álgebra", carreras: [{ carrera: "S", anioCarrera: "1", nivelElectiva: null }] });
  });

  it("acepta 150 caracteres, el límite exacto del VarChar", () => {
    const nombre = "a".repeat(150);
    expect(validateCrearMateriaInput({ modalidad: "ANUAL", nombre, carreras: [{ carrera: "S", anioCarrera: "1" }] }))
      .toMatchObject({ nombre, carreras: [{ carrera: "S", anioCarrera: "1", nivelElectiva: null }] });
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
    expect(() => validateCrearMateriaInput({ nombre, carreras: [{ carrera: "S", anioCarrera: "1" }] })).toThrow(InvalidAcademicInputError);
  });

  it("rechaza un cuerpo con campos de más", () => {
    expect(() => validateCrearMateriaInput({ modalidad: "ANUAL", nombre: "Álgebra", id: randomUUID(), carreras: [{ carrera: "S", anioCarrera: "1" }] })).toThrow(CAMPOS_NO_PERMITIDOS);
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
  const base = { materiaId: randomUUID(), cuatrimestre: "PRIMERO" as const };

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

  it("rechaza materiaId cuando no es UUID", () => {
    expect(() => validateCrearCursadaInput({ ...base, anio: 2026, materiaId: "not-a-uuid" })).toThrow(InvalidAcademicInputError);
  });

  it("rechaza profesorId con CAMPOS_NO_PERMITIDOS", () => {
    expect(() => validateCrearCursadaInput({ ...base, anio: 2026, profesorId: randomUUID() })).toThrow(CAMPOS_NO_PERMITIDOS);
  });

  it("rechaza un cuerpo con campos de más", () => {
    expect(() => validateCrearCursadaInput({ ...base, anio: 2026, activa: true })).toThrow(CAMPOS_NO_PERMITIDOS);
  });
});

describe("validateCrearComisionInput", () => {
  const cursadaId = randomUUID();

  it("acepta carrera y número válidos", () => {
    expect(validateCrearComisionInput({ cursadaId, carrera: "S", numero: 1 })).toEqual({ cursadaId, carrera: "S", numero: 1 });
  });

  it("rechaza nombre libre con CAMPOS_NO_PERMITIDOS", () => {
    expect(() => validateCrearComisionInput({ cursadaId, nombre: "Comisión 1" })).toThrow(CAMPOS_NO_PERMITIDOS);
  });

  it("rechaza cursadaId que no es UUID", () => {
    expect(() => validateCrearComisionInput({ cursadaId: "not-a-uuid", carrera: "S", numero: 1 })).toThrow(InvalidAcademicInputError);
  });

  it("rechaza un cuerpo con campos de más", () => {
    expect(() => validateCrearComisionInput({ cursadaId, carrera: "S", numero: 1, activa: false })).toThrow(CAMPOS_NO_PERMITIDOS);
  });
});
