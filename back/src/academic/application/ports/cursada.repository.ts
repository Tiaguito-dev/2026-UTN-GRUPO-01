import type { Cuatrimestre, Cursada } from "../../domain/cursada.js";
import type { Pagination, PaginatedResult } from "../../../shared/domain/pagination.js";

export const CURSADA_REPOSITORY = Symbol("CURSADA_REPOSITORY");

export interface CreateCursadaInput {
  materiaId: string;
  profesorId: string;
  anio: number;
  cuatrimestre: Cuatrimestre;
}

export interface CursadaRepository {
  findByMateriaId(materiaId: string, pagination: Pagination): Promise<PaginatedResult<Cursada>>;
  findById(id: string): Promise<Cursada | null>;
  findByPeriodo(materiaId: string, anio: number, cuatrimestre: Cuatrimestre): Promise<Cursada | null>;
  create(input: CreateCursadaInput): Promise<Cursada>;
}
