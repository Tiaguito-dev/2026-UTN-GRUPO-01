import type { Cursada } from "../domain/cursada.js";
import { validateCrearCursadaInput } from "./crear-cursada-input.js";
import { CursadaAlreadyExistsError, MateriaNotFoundError, ProfesorNotFoundError } from "./errors.js";
import type { CursadaRepository } from "./ports/cursada.repository.js";
import type { MateriaRepository } from "./ports/materia.repository.js";
import type { ProfesorRepository } from "./ports/profesor.repository.js";

export class CrearCursada {
  constructor(
    private readonly materias: MateriaRepository,
    private readonly profesores: ProfesorRepository,
    private readonly cursadas: CursadaRepository,
  ) {}

  async execute(input: unknown): Promise<Cursada> {
    const datos = validateCrearCursadaInput(input);
    if (!(await this.materias.findById(datos.materiaId))) throw new MateriaNotFoundError();
    if (!(await this.profesores.findById(datos.profesorId))) throw new ProfesorNotFoundError();
    const existente = await this.cursadas.findByPeriodo(datos.materiaId, datos.anio, datos.cuatrimestre);
    if (existente) throw new CursadaAlreadyExistsError();
    return this.cursadas.create(datos);
  }
}
