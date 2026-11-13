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
  puntuacion: number | null;
  anonimo: boolean;
  autor: { displayName: string } | null;
  propio: boolean;
  profesor: (Docente & { cargo: CargoDocente }) | null;
  contexto: FeedbackContexto;
  createdAt: string;
  updatedAt: string;
}
export interface NormasConvivencia { version: string; aceptada: boolean; reglas: string[] }
export interface FeedbackInput { texto: string; anonimo: boolean; profesorId?: string | null; puntuacion: number; versionNormas?: string }
export type FeedbackEdicion = Partial<Pick<FeedbackInput, "texto" | "anonimo" | "puntuacion">>;
export interface FeedbackHistorial {
  id: string;
  accion: "CREACION" | "EDICION" | "ELIMINACION";
  texto: string;
  puntuacion: number | null;
  anonimo: boolean;
  createdAt: string;
}
