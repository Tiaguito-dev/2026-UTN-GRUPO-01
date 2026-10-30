import type { PaginatedResult } from "../../shared/domain/pagination.js";
import { validatePagination } from "../../shared/domain/pagination-input.js";
import { validateId } from "./academic-id.js";
import { CursadaNotFoundError } from "./errors.js";
import type { Comision } from "../domain/comision.js";
import type { CursadaRepository } from "./ports/cursada.repository.js";
import type { ComisionRepository } from "./ports/comision.repository.js";
import { z } from "zod";
import { carreraSchema } from "./materia-input.js";
import { InvalidAcademicInputError } from "./errors.js";

const filtersSchema = z.object({ carrera: carreraSchema.optional() });

export class ListarComisionesPorCursada {
  constructor(
    private readonly cursadas: CursadaRepository,
    private readonly comisiones: ComisionRepository,
  ) {}

  async execute(cursadaIdInput: unknown, paginationInput: unknown): Promise<PaginatedResult<Comision>> {
    const cursadaId = validateId(cursadaIdInput);
    const pagination = validatePagination(paginationInput);
    const filters = filtersSchema.safeParse(paginationInput ?? {});
    if (!filters.success) throw new InvalidAcademicInputError("La carrera solicitada no es válida.");
    const cursada = await this.cursadas.findById(cursadaId);
    if (!cursada) throw new CursadaNotFoundError();
    return this.comisiones.findByCursadaId(cursadaId, pagination, filters.data.carrera);
  }
}
