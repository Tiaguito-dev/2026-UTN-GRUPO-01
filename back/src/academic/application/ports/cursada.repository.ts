import type { Cursada, CursadaResumen } from "../../domain/cursada.js";
import type { Pagination, PaginatedResult } from "../../../shared/domain/pagination.js";

export const CURSADA_REPOSITORY = Symbol("CURSADA_REPOSITORY");

export interface CreateCursadaInput {
  materiaId: string;
  anio: number;
}

export interface CursadaRepository {
  findByMateriaId(materiaId: string, pagination: Pagination): Promise<PaginatedResult<CursadaResumen>>;
  findById(id: string): Promise<(CursadaResumen & { materiaId: string }) | null>;
  findByPeriodo(materiaId: string, anio: number): Promise<Cursada | null>;
  create(input: CreateCursadaInput): Promise<Cursada>;
}
