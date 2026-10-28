import type { Cuatrimestre, Cursada, CursadaResumen } from "../../domain/cursada.js";
import type { Pagination, PaginatedResult } from "../../../shared/domain/pagination.js";

export const CURSADA_REPOSITORY = Symbol("CURSADA_REPOSITORY");

export interface CreateCursadaInput {
  materiaId: string;
  anio: number;
  cuatrimestre: Cuatrimestre;
}

export interface CursadaRepository {
  findByMateriaId(materiaId: string, pagination: Pagination): Promise<PaginatedResult<CursadaResumen>>;
  findById(id: string): Promise<(CursadaResumen & { materiaId: string }) | null>;
  findByPeriodo(materiaId: string, anio: number, cuatrimestre: Cuatrimestre): Promise<Cursada | null>;
  update(id: string, input: Partial<CreateCursadaInput>): Promise<Cursada>;
  create(input: CreateCursadaInput): Promise<Cursada>;
}
