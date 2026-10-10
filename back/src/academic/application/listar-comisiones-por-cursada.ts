import type { PaginatedResult } from "../../shared/domain/pagination.js";
import { validatePagination } from "../../shared/domain/pagination-input.js";
import { validateId } from "./academic-id.js";
import { CursadaNotFoundError } from "./errors.js";
import type { Comision } from "../domain/comision.js";
import type { CursadaRepository } from "./ports/cursada.repository.js";
import type { ComisionRepository } from "./ports/comision.repository.js";

export class ListarComisionesPorCursada {
  constructor(
    private readonly cursadas: CursadaRepository,
    private readonly comisiones: ComisionRepository,
  ) {}

  async execute(cursadaIdInput: unknown, paginationInput: unknown): Promise<PaginatedResult<Comision>> {
    const cursadaId = validateId(cursadaIdInput);
    const pagination = validatePagination(paginationInput);
    const cursada = await this.cursadas.findById(cursadaId);
    if (!cursada) throw new CursadaNotFoundError();
    return this.comisiones.findByCursadaId(cursadaId, pagination);
  }
}
