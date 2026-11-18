export interface FeedbackRespuesta {
  id: string;
  feedbackId: string;
  texto: string;
  anonimo: boolean;
  autor: { displayName: string } | null;
  propio: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedbackRespuestaCreada {
  respuesta: FeedbackRespuesta;
  created: boolean;
}
