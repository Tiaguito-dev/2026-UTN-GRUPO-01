import type { Cursada } from "../domain/cursada.js";
import { validateCrearCursadaInput } from "./crear-cursada-input.js";
import { CursadaAlreadyExistsError, MateriaNotFoundError } from "./errors.js";
import type { CursadaRepository } from "./ports/cursada.repository.js";
import type { MateriaRepository } from "./ports/materia.repository.js";

export class CrearCursada {
  constructor(
    private readonly materias: MateriaRepository,
    private readonly cursadas: CursadaRepository,
  ) {}

  async execute(input: unknown): Promise<Cursada> {
    const datos = validateCrearCursadaInput(input);
    if (!(await this.materias.findById(datos.materiaId))) throw new MateriaNotFoundError();
    const existente = await this.cursadas.findByPeriodo(datos.materiaId, datos.anio);
    if (existente) throw new CursadaAlreadyExistsError();
    return this.cursadas.create(datos);
  }
}
