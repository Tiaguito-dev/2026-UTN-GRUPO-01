import type { AnioCarrera, Carrera, NivelElectiva, Materia, MateriaCarrera, MateriaHistorial } from "../../domain/materia.js";
import type { Pagination, PaginatedResult } from "../../../shared/domain/pagination.js";

export const MATERIA_REPOSITORY = Symbol("MATERIA_REPOSITORY");

export interface CreateMateriaInput {
  nombre: string;
  carreras: MateriaCarrera[];
}

export interface MateriaFilters {
  /** Con carrera, año y nivel se filtran sobre MateriaCarrera; sin carrera, año o nivel dan 400. */
  carrera?: Carrera;
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
  findCarreras(materiaId: string): Promise<Carrera[]>;
  findHistorial(id: string, pagination: Pagination): Promise<PaginatedResult<MateriaHistorial>>;
}
