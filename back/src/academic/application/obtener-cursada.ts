import { validateId } from "./academic-id.js";
import { CursadaNotFoundError } from "./errors.js";
import { resumirCursada, type CursadaConProfesor } from "./listar-cursadas-por-materia.js";
import type { CursadaRepository } from "./ports/cursada.repository.js";
import type { MateriaRepository } from "./ports/materia.repository.js";
import type { ProfesorRepository } from "./ports/profesor.repository.js";

export interface CursadaDetalle extends CursadaConProfesor {
  materia: { id: string; nombre: string };
}

export class ObtenerCursada {
  constructor(
    private readonly cursadas: CursadaRepository,
    private readonly materias: MateriaRepository,
    private readonly profesores: ProfesorRepository,
  ) {}

  async execute(id: unknown): Promise<CursadaDetalle> {
    const cursada = await this.cursadas.findById(validateId(id));
    // Una cursada de una materia dada de baja tampoco existe para la lectura (soft-delete del padre).
    const materia = cursada && (await this.materias.findById(cursada.materiaId));
    if (!cursada || !materia) throw new CursadaNotFoundError();
    return { ...(await resumirCursada(cursada, this.profesores)), materia: { id: materia.id, nombre: materia.nombre } };
  }
}
