import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { validateCrearMateriaInput } from "../src/academic/application/crear-materia-input.js";
import { ListarHistorialMateria } from "../src/academic/application/listar-historial-materia.js";
import { CAMPOS_NO_PERMITIDOS, InvalidAcademicInputError, MateriaAlreadyExistsError, MateriaNotFoundError } from "../src/academic/application/errors.js";
import { InvalidPaginationError } from "../src/shared/domain/errors.js";
import { fixture } from "./academic-fixture.js";

describe("Materias: contrato de carreras y filtros", () => {
  it.each(["3", "4", "5"])("acepta electiva de nivel %s", nivelElectiva => {
    expect(validateCrearMateriaInput({ modalidad: "ANUAL", nombre: "Electiva", carreras: [{ carrera: "S", anioCarrera: "ELECTIVA", nivelElectiva }] }))
      .toMatchObject({ carreras: [{ nivelElectiva }] });
  });

  it.each(["1", "2", "3", "4", "5"])("acepta %s al crear", anioCarrera => {
    expect(validateCrearMateriaInput({ modalidad: "ANUAL", nombre: "Materia", carreras: [{ carrera: "S", anioCarrera }] }))
      .toMatchObject({ nombre: "Materia", carreras: [{ carrera: "S", anioCarrera, nivelElectiva: null }] });
  });

  it("rechaza formas de entrada legadas al crear con 400 CAMPOS_NO_PERMITIDOS", () => {
    expect(() => validateCrearMateriaInput({ modalidad: "ANUAL", nombre: "Materia", anioCarrera: "1" })).toThrow(CAMPOS_NO_PERMITIDOS);
  });

  it.each([undefined, null, "", "0", "6", "2026", "Electiva", 1, [], ["1"]])("rechaza año inválido %j en carrera", async anioCarrera => {
    expect(() => validateCrearMateriaInput({ modalidad: "ANUAL", nombre: "Materia", carreras: [{ carrera: "S", anioCarrera }] }))
      .toThrow(InvalidAcademicInputError);
  });

  // TASK-060: academic year is independent from career; elective level still requires Electiva.
  it("acepta año sin carrera y rechaza nivel sin año Electiva", async () => {
    const f = fixture();
    await f.listarMaterias.execute({ anioCarrera: "ELECTIVA", nivelElectiva: "4" });
    expect(f.materiaRepository.findAll).toHaveBeenCalledWith({ page: 1, pageSize: 9 }, { anioCarrera: "ELECTIVA", nivelElectiva: "4", q: undefined });
    vi.mocked(f.materiaRepository.findAll).mockClear();
    await expect(f.listarMaterias.execute({ nivelElectiva: "4" })).rejects.toBeInstanceOf(InvalidAcademicInputError);
    expect(f.materiaRepository.findAll).not.toHaveBeenCalled();
  });

  it("delega filtro por carrera y paginación al puerto, sin filtrar después del corte", async () => {
    const f = fixture();
    await f.listarMaterias.execute({ carrera: "S", anioCarrera: "ELECTIVA", page: "2" });
    expect(f.materiaRepository.findAll).toHaveBeenCalledWith({ page: 2, pageSize: 9 }, { carrera: "S", anioCarrera: "ELECTIVA", q: undefined });
  });

  it("permite cien materias para selectores y conserva nueve por defecto", async () => {
    const f = fixture();
    await f.listarMaterias.execute({});
    expect(f.materiaRepository.findAll).toHaveBeenLastCalledWith({ page: 1, pageSize: 9 }, { q: undefined });
    await f.listarMaterias.execute({ pageSize: 100 });
    expect(f.materiaRepository.findAll).toHaveBeenLastCalledWith({ page: 1, pageSize: 100 }, { q: undefined });
  });

  it("rechaza páginas mayores de cien antes de consultar", async () => {
    const f = fixture();
    await expect(f.listarMaterias.execute({ pageSize: 101 })).rejects.toBeInstanceOf(InvalidPaginationError);
    expect(f.materiaRepository.findAll).not.toHaveBeenCalled();
  });

  it("recorta búsqueda y combina filtros con carrera sin perder el nivel", async () => {
    const f = fixture();
    await f.listarMaterias.execute({ carrera: "S", q: "  Plan %_  ", anioCarrera: "ELECTIVA", nivelElectiva: "4" });
    expect(f.materiaRepository.findAll).toHaveBeenCalledWith({ page: 1, pageSize: 9 }, { carrera: "S", q: "Plan %_", anioCarrera: "ELECTIVA", nivelElectiva: "4" });
  });

  it.each([{ q: "x".repeat(151) }, { q: "texto\n" }, { carrera: "S", nivelElectiva: "4", anioCarrera: "2" }])("rechaza consulta inválida antes del repositorio: %j", async query => {
    const f = fixture();
    await expect(f.listarMaterias.execute(query)).rejects.toBeInstanceOf(InvalidAcademicInputError);
    expect(f.materiaRepository.findAll).not.toHaveBeenCalled();
  });

  it("delega carrera junto con año, nivel y búsqueda", async () => {
    const f = fixture();
    await f.listarMaterias.execute({ carrera: "Q", anioCarrera: "ELECTIVA", nivelElectiva: "4", q: " Plan " });
    expect(f.materiaRepository.findAll).toHaveBeenCalledWith({ page: 1, pageSize: 9 }, { carrera: "Q", anioCarrera: "ELECTIVA", nivelElectiva: "4", q: "Plan" });
  });

  it.each([["X"], ["q"], [""], [["Q", "S"]], [1]])("rechaza carrera inválida %j antes de consultar", async carrera => {
    const f = fixture();
    await expect(f.listarMaterias.execute({ carrera })).rejects.toBeInstanceOf(InvalidAcademicInputError);
    expect(f.materiaRepository.findAll).not.toHaveBeenCalled();
  });

  it("con carrera mantiene la regla de nivel solo para Electivas", async () => {
    const f = fixture();
    await expect(f.listarMaterias.execute({ carrera: "S", anioCarrera: "2", nivelElectiva: "4" })).rejects.toBeInstanceOf(InvalidAcademicInputError);
    expect(f.materiaRepository.findAll).not.toHaveBeenCalled();
  });

  it("rechaza campos legados al editar con 400 CAMPOS_NO_PERMITIDOS", async () => {
    const f = fixture();
    const materia = f.addMateria("Materia");
    await expect(f.actualizarMateria.execute(materia.id, { anioCarrera: "1" }, randomUUID())).rejects.toThrow(CAMPOS_NO_PERMITIDOS);
  });

  it("edita las carreras sin exigir nombre y conserva actor para auditoría", async () => {
    const f = fixture();
    const materia = f.addMateria("Materia");
    const actor = randomUUID();
    const carreras = [{ carrera: "S" as const, anioCarrera: "ELECTIVA" as const, nivelElectiva: "3" as const }];
    await expect(f.actualizarMateria.execute(materia.id, { carreras }, actor)).resolves.toMatchObject({ nombre: "Materia", carreras });
    expect(f.materiaRepository.update).toHaveBeenCalledWith(materia.id, { carreras }, actor);
  });

  it("permite editar el nombre conservando carreras", async () => {
    const f = fixture();
    const materia = f.addMateria("Viejo");
    const actor = randomUUID();
    await expect(f.actualizarMateria.execute(materia.id, { nombre: "Nuevo" }, actor)).resolves.toMatchObject({ nombre: "Nuevo" });
    expect(f.materiaRepository.update).toHaveBeenCalledWith(materia.id, { nombre: "Nuevo" }, actor);
  });

  it("rechaza edición duplicada sin actualizar", async () => {
    const f = fixture();
    const materia = f.addMateria("Primera"); f.addMateria("Otra");
    await expect(f.actualizarMateria.execute(materia.id, { nombre: "Otra" }, randomUUID())).rejects.toBeInstanceOf(MateriaAlreadyExistsError);
    expect(f.materiaRepository.update).not.toHaveBeenCalled();
  });

  it("el historial usa páginas de tres y valida existencia", async () => {
    const f = fixture(); const materia = f.addMateria("Materia");
    const historial = new ListarHistorialMateria(f.materiaRepository);
    await historial.execute(materia.id, undefined);
    expect(f.materiaRepository.findHistorial).toHaveBeenCalledWith(materia.id, { page: 1, pageSize: 3 });
    await expect(historial.execute(materia.id, { pageSize: 4 })).rejects.toBeInstanceOf(InvalidPaginationError);
    await expect(historial.execute(randomUUID(), undefined)).rejects.toBeInstanceOf(MateriaNotFoundError);
  });
});
