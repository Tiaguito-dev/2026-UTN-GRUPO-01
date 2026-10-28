import type { PaginatedResult } from "../../shared/domain/pagination.js";
import { validatePagination } from "../../shared/domain/pagination-input.js";
import type { Profesor } from "../domain/profesor.js";
import type { ProfesorRepository } from "./ports/profesor.repository.js";
import { z } from "zod";
import { InvalidAcademicInputError } from "./errors.js";

const filtersSchema = z.object({
  // eslint-disable-next-line no-control-regex -- rechaza caracteres de control en una búsqueda deliberadamente.
  q: z.string().refine((value) => !/[\u0000-\u001f\u007f-\u009f]/u.test(value)).transform((value) => value.trim())
    .refine((value) => Array.from(value).length <= 150).optional(),
});

export class ListarProfesores {
  constructor(private readonly profesores: ProfesorRepository) {}

  async execute(paginationInput: unknown): Promise<PaginatedResult<Profesor>> {
    const pagination = validatePagination(paginationInput);
    const filters = filtersSchema.safeParse(paginationInput ?? {});
    if (!filters.success) throw new InvalidAcademicInputError("Revise la búsqueda: use hasta 150 caracteres y evite caracteres de control.");
    return filters.data.q ? this.profesores.findAll(pagination, { q: filters.data.q }) : this.profesores.findAll(pagination);
  }
}
