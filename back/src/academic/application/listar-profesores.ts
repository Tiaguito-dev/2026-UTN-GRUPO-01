import type { PaginatedResult } from "../../shared/domain/pagination.js";
import { validatePagination } from "../../shared/domain/pagination-input.js";
import type { Profesor } from "../domain/profesor.js";
import type { ProfesorRepository } from "./ports/profesor.repository.js";

export class ListarProfesores {
  constructor(private readonly profesores: ProfesorRepository) {}

  async execute(paginationInput: unknown): Promise<PaginatedResult<Profesor>> {
    const pagination = validatePagination(paginationInput);
    return this.profesores.findAll(pagination);
  }
}
