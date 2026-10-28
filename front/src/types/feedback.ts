import type { CargoDocente, Cuatrimestre } from "@/services/academic";
import type { Carrera, ModalidadMateria } from "@/types/materias";

export interface Docente { id: string; nombreCompleto: string }
export interface FeedbackContexto {
  carrera?: Carrera;
  comisionId: string;
  nombre: string;
  materiaId: string;
  materiaNombre: string;
  cursadaId: string;
  anio: number;
  /** Legacy snapshot; annual experiences have no semester. */
  cuatrimestre: Cuatrimestre | null;
  modalidad?: ModalidadMateria | null;
}
export interface Feedback {
  id: string;
  texto: string;
  anonimo: boolean;
  autor: { displayName: string } | null;
  propio: boolean;
  profesor: (Docente & { cargo: CargoDocente }) | null;
  contexto: FeedbackContexto;
  createdAt: string;
  updatedAt: string;
}
export interface FeedbackInput { texto: string; anonimo: boolean; profesorId?: string | null }
export type FeedbackEdicion = Partial<Pick<FeedbackInput, "texto" | "anonimo">>;
export interface FeedbackHistorial {
  id: string;
  accion: "CREACION" | "EDICION" | "ELIMINACION";
  texto: string;
  anonimo: boolean;
  createdAt: string;
}
