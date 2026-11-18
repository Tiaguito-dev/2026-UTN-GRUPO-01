import type { CargoDocente, Cuatrimestre } from "@/services/academic";
import type { Carrera, ModalidadMateria } from "@/types/materias";
import type { AccionModeracion, EstadoModeracion, EstadoModeracionFeedback } from "./feedback-moderation";

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
export interface Feedback extends Partial<EstadoModeracionFeedback> {
  id: string;
  texto: string;
  puntuacion: number | null;
  anonimo: boolean;
  autor: { displayName: string } | null;
  propio: boolean;
  profesor: (Docente & { cargo: CargoDocente }) | null;
  contexto: FeedbackContexto;
  createdAt: string;
  updatedAt: string;
}
/** Private author/ADMIN projection; community responses omit these fields. */
export type FeedbackOwn = Feedback & EstadoModeracionFeedback;
export interface NormasConvivencia { version: string; aceptada: boolean; reglas: string[] }
export interface FeedbackInput { texto: string; anonimo: boolean; profesorId?: string | null; puntuacion: number }
export type FeedbackEdicion = Partial<Pick<FeedbackInput, "texto" | "anonimo" | "puntuacion">> & { versionEsperada?: number };
export interface FeedbackHistorial {
  id: string;
  accion: "CREACION" | "EDICION" | "ELIMINACION" | AccionModeracion;
  texto: string;
  puntuacion: number | null;
  anonimo: boolean;
  estadoModeracion?: EstadoModeracion | null;
  versionModeracion?: number | null;
  motivoRechazo?: string | null;
  createdAt: string;
}
