import type { AnioCarrera, NivelElectiva, Materia, MateriaHistorial } from "../../domain/materia.js";
import type { Pagination, PaginatedResult } from "../../../shared/domain/pagination.js";

export const MATERIA_REPOSITORY = Symbol("MATERIA_REPOSITORY");

export interface CreateMateriaInput {
  nombre: string;
  anioCarrera: AnioCarrera;
  nivelElectiva?: NivelElectiva | null;
}

export interface MateriaFilters {
  anioCarrera?: AnioCarrera;
  nivelElectiva?: NivelElectiva;
  q?: string;
}

export interface MateriaRepository {
  findAll(pagination: Pagination, filters?: MateriaFilters): Promise<PaginatedResult<Materia>>;
  findById(id: string): Promise<Materia | null>;
  findByNombre(nombre: string): Promise<Materia | null>;
  create(input: CreateMateriaInput): Promise<Materia>;
  update(id: string, input: Partial<CreateMateriaInput>, actorId: string): Promise<Materia>;
  findHistorial(id: string, pagination: Pagination): Promise<PaginatedResult<MateriaHistorial>>;
}
