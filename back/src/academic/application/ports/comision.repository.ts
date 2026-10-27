import type { CargoDocente, Comision, ComisionDetalle } from "../../domain/comision.js";
import type { Carrera } from "../../domain/materia.js";
import type { Pagination, PaginatedResult } from "../../../shared/domain/pagination.js";

export const COMISION_REPOSITORY = Symbol("COMISION_REPOSITORY");

export interface CreateComisionInput {
  cursadaId: string;
  carrera: Carrera;
  numero: number;
}

export interface ComisionRepository {
  findByCursadaId(cursadaId: string, pagination: Pagination): Promise<PaginatedResult<Comision>>;
  findByCursadaIdCarreraNumero(cursadaId: string, carrera: Carrera, numero: number): Promise<Comision | null>;
  /** Excluye las comisiones dadas de baja. */
  findById(id: string): Promise<Comision | null>;
  /** Null si la comisión, su cursada o su materia están borradas; las inactivas se devuelven. */
  findDetalleById(id: string): Promise<ComisionDetalle | null>;
  update(id: string, input: Partial<Pick<CreateComisionInput, "carrera" | "numero">>): Promise<Comision>;
  create(input: CreateComisionInput): Promise<Comision>;
  /** Solo cuenta comisiones no borradas. */
  existsByMateriaAndCarrera(materiaId: string, carrera: Carrera): Promise<boolean>;
  /** Upsert: si ya estaba asignado, cambia el cargo. */
  asignarProfesor(comisionId: string, profesorId: string, cargo: CargoDocente): Promise<void>;
  /** Devuelve false si el profesor no estaba asignado. */
  quitarProfesor(comisionId: string, profesorId: string): Promise<boolean>;
}
