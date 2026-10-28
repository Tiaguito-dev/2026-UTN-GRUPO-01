export interface Feedback {
  id: string;
  texto: string;
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

export interface FeedbackRevision {
  id: string;
  accion: "CREACION" | "EDICION" | "ELIMINACION";
  texto: string;
  anonimo: boolean;
  createdAt: Date;
}

