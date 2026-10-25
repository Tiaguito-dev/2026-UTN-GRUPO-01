import { validateId } from "./academic-id.js";
import { CursadaNotFoundError } from "./errors.js";
import type { CursadaResumen } from "../domain/cursada.js";
import type { CursadaRepository } from "./ports/cursada.repository.js";
import type { MateriaRepository } from "./ports/materia.repository.js";

export interface CursadaDetalle extends CursadaResumen {
  materia: { id: string; nombre: string };
}

export class ObtenerCursada {
  constructor(
    private readonly cursadas: CursadaRepository,
    private readonly materias: MateriaRepository,
  ) {}

  async execute(id: unknown): Promise<CursadaDetalle> {
    const cursada = await this.cursadas.findById(validateId(id));
    // Una cursada de una materia dada de baja tampoco existe para la lectura (soft-delete del padre).
    const materia = cursada && (await this.materias.findById(cursada.materiaId));
    if (!cursada || !materia) throw new CursadaNotFoundError();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- descarta materiaId, no viaja en la respuesta de detalle
    const { materiaId: _, ...resumen } = cursada;
    return { ...resumen, materia: { id: materia.id, nombre: materia.nombre } };
  }
}
