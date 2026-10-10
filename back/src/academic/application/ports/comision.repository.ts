import type { Comision } from "../../domain/comision.js";
import type { Pagination, PaginatedResult } from "../../../shared/domain/pagination.js";

export const COMISION_REPOSITORY = Symbol("COMISION_REPOSITORY");

export interface CreateComisionInput {
  cursadaId: string;
  nombre: string;
}

export interface ComisionRepository {
  findByCursadaId(cursadaId: string, pagination: Pagination): Promise<PaginatedResult<Comision>>;
  findByCursadaIdAndNombre(cursadaId: string, nombre: string): Promise<Comision | null>;
  create(input: CreateComisionInput): Promise<Comision>;
}
