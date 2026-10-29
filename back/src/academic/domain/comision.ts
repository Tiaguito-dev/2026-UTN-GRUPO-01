import type { Carrera, ModalidadMateria } from "./materia.js";

export type CargoDocente = "TITULAR" | "ADJUNTO" | "JTP";

export interface ProfesorAsignado {
  id: string;
  nombreCompleto: string;
  cargo: CargoDocente;
}

export interface Comision {
  id: string;
  cursadaId: string;
  nombre: string;
  activa: boolean;
  carrera: Carrera;
  numero: number;
  /** Ordenados por cargo (TITULAR, ADJUNTO, JTP) y después por nombre. */
  profesores: ProfesorAsignado[];
  createdAt: Date;
  deletedAt: Date | null;
}

export interface ComisionDetalle extends Comision {
  cursada: { id: string; anio: number; cuatrimestre?: import("./cursada.js").Cuatrimestre | null; materia: { id: string; nombre: string; modalidad: ModalidadMateria | null } };
}
