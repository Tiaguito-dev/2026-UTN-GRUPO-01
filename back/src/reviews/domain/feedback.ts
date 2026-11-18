import type { FeedbackModerationAction, FeedbackModerationState } from "./feedback-moderation.js";

export interface Feedback {
  id: string;
  texto: string;
  puntuacion: number | null;
  anonimo: boolean;
  autor: { displayName: string } | null;
  propio: boolean;
  profesor: { id: string; nombreCompleto: string; cargo: "TITULAR" | "ADJUNTO" | "JTP" } | null;
  contexto: {
    carrera: "S" | "C" | "Q" | "I" | "M";
    comisionId: string;
    nombre: string;
    materiaId: string;
    materiaNombre: string;
    cursadaId: string;
    anio: number;
    /** Cuatrimestre histórico: null para anual o modalidad todavía sin definir. */
    cuatrimestre: "PRIMERO" | "SEGUNDO" | "ANUAL" | null;
    modalidad: "ANUAL" | "PRIMERO" | "SEGUNDO" | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

/** Private projection; never use for community lists or interactions. */
export interface FeedbackOwn extends Feedback, FeedbackModerationState {}

export interface FeedbackRevision {
  id: string;
  accion: "CREACION" | "EDICION" | "ELIMINACION" | FeedbackModerationAction;
  texto: string;
  puntuacion: number | null;
  anonimo: boolean;
  /** Nullable for snapshots predating moderation; internal administrative reasons stay private. */
  estadoModeracion?: FeedbackModerationState["estadoModeracion"] | null;
  versionModeracion?: number | null;
  motivoRechazo?: string | null;
  createdAt: Date;
}

