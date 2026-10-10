import type { PaginatedResult } from "../../shared/domain/pagination.js";
import { validatePagination } from "../../shared/domain/pagination-input.js";
import { validateId } from "./academic-id.js";
import { MateriaNotFoundError } from "./errors.js";
import type { Cuatrimestre } from "../domain/cursada.js";
import type { MateriaRepository } from "./ports/materia.repository.js";
import type { CursadaRepository } from "./ports/cursada.repository.js";
import type { ProfesorRepository } from "./ports/profesor.repository.js";

export interface CursadaConProfesor {
  id: string;
  anio: number;
  cuatrimestre: Cuatrimestre;
  profesor: string;
}

export class ListarCursadasPorMateria {
  constructor(
    private readonly materias: MateriaRepository,
    private readonly cursadas: CursadaRepository,
    private readonly profesores: ProfesorRepository,
  ) {}

  async execute(materiaIdInput: unknown, paginationInput: unknown): Promise<PaginatedResult<CursadaConProfesor>> {
    const materiaId = validateId(materiaIdInput);
    const pagination = validatePagination(paginationInput);
    const materia = await this.materias.findById(materiaId);
    if (!materia) throw new MateriaNotFoundError();
    const result = await this.cursadas.findByMateriaId(materiaId, pagination);
    const items = await Promise.all(
      result.items.map(async (cursada) => {
        const profesor = await this.profesores.findById(cursada.profesorId);
        return {
          id: cursada.id,
          anio: cursada.anio,
          cuatrimestre: cursada.cuatrimestre,
          profesor: profesor?.nombreCompleto ?? "",
        };
      }),
    );
    return { ...result, items };
  }
}
