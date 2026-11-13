import type { PaginatedResult } from "../../shared/domain/pagination.js";
import { validateMateriaFilter, validateMateriaPagination } from "./materia-input.js";
import type { MateriaConValoracion } from "../domain/materia.js";
import type { MateriaRepository } from "./ports/materia.repository.js";

export class ListarMaterias {
  constructor(private readonly materias: MateriaRepository) {}

  async execute(paginationInput: unknown): Promise<PaginatedResult<MateriaConValoracion>> {
    const pagination = validateMateriaPagination(paginationInput, 100, 9);
    return this.materias.findAll(pagination, validateMateriaFilter(paginationInput));
  }
}
