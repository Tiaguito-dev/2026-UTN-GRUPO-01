import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateCrearMateriaInput } from "../src/academic/application/crear-materia-input.js";
import { ActualizarMateria } from "../src/academic/application/actualizar-materia.js";
import { ListarHistorialMateria } from "../src/academic/application/listar-historial-materia.js";
import { InvalidAcademicInputError, MateriaAlreadyExistsError, MateriaNotFoundError } from "../src/academic/application/errors.js";
import { InvalidPaginationError } from "../src/shared/domain/errors.js";
import { fixture } from "./academic-fixture.js";

describe("Materias: contrato del año de carrera", () => {
  it.each(["3", "4", "5"])("acepta electiva de nivel %s", nivelElectiva => {
    expect(validateCrearMateriaInput({ nombre: "Electiva", anioCarrera: "ELECTIVA", nivelElectiva })).toMatchObject({ nivelElectiva });
  });
  it.each(["1", "2", "3", "4", "5"])("acepta %s al crear", anioCarrera => {
    expect(validateCrearMateriaInput({ nombre: "Materia", anioCarrera })).toEqual({ nombre: "Materia", anioCarrera, nivelElectiva: null });
  });
  it.each([undefined, null, "", "0", "6", "2026", "Electiva", 1, [], ["1"]])("rechaza año inválido %j en alta y edición", async anioCarrera => {
    const f = fixture();
    const materia = f.addMateria("Materia", "1");
    expect(() => validateCrearMateriaInput({ nombre: "Materia", anioCarrera })).toThrow(InvalidAcademicInputError);
    // Undefined representa omisión válida en PATCH; no permite borrar la clasificación.
    if (anioCarrera !== undefined) {
      await expect(new ActualizarMateria(f.materiaRepository).execute(materia.id, { anioCarrera }, randomUUID())).rejects.toBeInstanceOf(InvalidAcademicInputError);
      expect(f.materiaRepository.update).not.toHaveBeenCalled();
    }
  });
  it.each(["0", "6", "Electiva", ["1", "2"]])("rechaza filtro inválido %j antes de consultar", async anioCarrera => {
    const f = fixture();
    await expect(f.listarMaterias.execute({ anioCarrera })).rejects.toBeInstanceOf(InvalidAcademicInputError);
    expect(f.materiaRepository.findAll).not.toHaveBeenCalled();
  });
  it("delega filtro y paginación al puerto, sin filtrar después del corte", async () => {
    const f = fixture();
    await f.listarMaterias.execute({ anioCarrera: "ELECTIVA", page: "2" });
    expect(f.materiaRepository.findAll).toHaveBeenCalledWith({ page: 2, pageSize: 9 }, { anioCarrera: "ELECTIVA", q: undefined });
  });
  it("no permite más de nueve materias por página", async () => {
    await expect(fixture().listarMaterias.execute({ pageSize: 10 })).rejects.toBeInstanceOf(InvalidPaginationError);
  });
  it("recorta búsqueda y combina filtros sin perder el nivel", async () => {
    const f = fixture();
    await f.listarMaterias.execute({ q: "  Plan %_  ", anioCarrera: "ELECTIVA", nivelElectiva: "4" });
    expect(f.materiaRepository.findAll).toHaveBeenCalledWith({ page: 1, pageSize: 9 }, { q: "Plan %_", anioCarrera: "ELECTIVA", nivelElectiva: "4" });
  });
  it.each([{ q: "x".repeat(151) }, { q: "texto\n" }, { nivelElectiva: "4", anioCarrera: "2" }])("rechaza consulta inválida antes del repositorio: %j", async query => {
    const f = fixture();
    await expect(f.listarMaterias.execute(query)).rejects.toBeInstanceOf(InvalidAcademicInputError);
    expect(f.materiaRepository.findAll).not.toHaveBeenCalled();
  });
  it("edita solo el año sin exigir nombre y conserva actor para auditoría", async () => {
    const f = fixture();
    const materia = f.addMateria("Materia", "1");
    const actor = randomUUID();
    await expect(new ActualizarMateria(f.materiaRepository).execute(materia.id, { anioCarrera: "ELECTIVA", nivelElectiva: "3" }, actor)).resolves.toMatchObject({ nombre: "Materia", anioCarrera: "ELECTIVA" });
    expect(f.materiaRepository.update).toHaveBeenCalledWith(materia.id, { anioCarrera: "ELECTIVA", nivelElectiva: "3" }, actor);
  });
  it("exige clasificar una materia heredada al editar", async () => {
    const f = fixture();
    const materia = f.addMateria("Heredada");
    await expect(new ActualizarMateria(f.materiaRepository).execute(materia.id, { nombre: "Nuevo" }, randomUUID())).rejects.toBeInstanceOf(InvalidAcademicInputError);
  });
  it("rechaza edición duplicada sin actualizar", async () => {
    const f = fixture();
    const materia = f.addMateria("Primera", "1"); f.addMateria("Otra", "2");
    await expect(new ActualizarMateria(f.materiaRepository).execute(materia.id, { nombre: "Otra" }, randomUUID())).rejects.toBeInstanceOf(MateriaAlreadyExistsError);
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
