import type { PaginatedResult } from "../../shared/domain/pagination.js";
import { validatePagination } from "../../shared/domain/pagination-input.js";
import { validateId } from "./academic-id.js";
import { MateriaNotFoundError } from "./errors.js";
import type { CursadaResumen } from "../domain/cursada.js";
import type { MateriaRepository } from "./ports/materia.repository.js";
import type { CursadaRepository } from "./ports/cursada.repository.js";

export class ListarCursadasPorMateria {
  constructor(
    private readonly materias: MateriaRepository,
    private readonly cursadas: CursadaRepository,
  ) {}

  async execute(materiaIdInput: unknown, paginationInput: unknown): Promise<PaginatedResult<CursadaResumen>> {
    const materiaId = validateId(materiaIdInput);
    const pagination = validatePagination(paginationInput);
    const materia = await this.materias.findById(materiaId);
    if (!materia) throw new MateriaNotFoundError();
    return this.cursadas.findByMateriaId(materiaId, pagination);
  }
}
