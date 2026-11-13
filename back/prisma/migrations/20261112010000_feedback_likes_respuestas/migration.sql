-- Aditiva: no altera comentarios, valoraciones ni historiales existentes.
CREATE TABLE "FeedbackLike" (
  "usuarioId" UUID NOT NULL,
  "feedbackId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMPTZ(3),

  CONSTRAINT "FeedbackLike_pkey" PRIMARY KEY ("usuarioId", "feedbackId"),
  CONSTRAINT "FeedbackLike_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "User" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FeedbackLike_feedbackId_fkey"
    FOREIGN KEY ("feedbackId") REFERENCES "Feedback" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "FeedbackRespuesta" (
  "id" UUID NOT NULL,
  "feedbackId" UUID NOT NULL,
  "autorId" UUID NOT NULL,
  "texto" TEXT NOT NULL,
  "anonimo" BOOLEAN NOT NULL,
  "solicitudId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMPTZ(3),

  CONSTRAINT "FeedbackRespuesta_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FeedbackRespuesta_feedbackId_fkey"
    FOREIGN KEY ("feedbackId") REFERENCES "Feedback" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FeedbackRespuesta_autorId_fkey"
    FOREIGN KEY ("autorId") REFERENCES "User" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "FeedbackRespuestaHistorial" (
  "id" UUID NOT NULL,
  "respuestaId" UUID NOT NULL,
  "accion" "FeedbackAccion" NOT NULL,
  "texto" TEXT NOT NULL,
  "anonimo" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FeedbackRespuestaHistorial_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FeedbackRespuestaHistorial_respuestaId_fkey"
    FOREIGN KEY ("respuestaId") REFERENCES "FeedbackRespuesta" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "FeedbackLike_feedbackId_deletedAt_idx"
  ON "FeedbackLike" ("feedbackId", "deletedAt");

-- La clave de idempotencia permanece reservada incluso tras la baja lógica.
CREATE UNIQUE INDEX "FeedbackRespuesta_autorId_solicitudId_key"
  ON "FeedbackRespuesta" ("autorId", "solicitudId");

CREATE INDEX "FeedbackRespuesta_feedbackId_deletedAt_createdAt_id_idx"
  ON "FeedbackRespuesta" ("feedbackId", "deletedAt", "createdAt", "id");

CREATE INDEX "FeedbackRespuestaHistorial_respuestaId_createdAt_id_idx"
  ON "FeedbackRespuestaHistorial" ("respuestaId", "createdAt", "id");

CREATE INDEX "Feedback_deletedAt_createdAt_id_idx"
  ON "Feedback" ("deletedAt", "createdAt" DESC, "id" DESC);
