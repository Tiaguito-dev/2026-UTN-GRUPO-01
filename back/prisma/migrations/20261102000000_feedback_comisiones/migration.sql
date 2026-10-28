CREATE TYPE "FeedbackAccion" AS ENUM ('CREACION', 'EDICION', 'ELIMINACION');

CREATE TABLE "Feedback" (
  "id" UUID NOT NULL,
  "autorId" UUID NOT NULL,
  "comisionId" UUID NOT NULL,
  "profesorId" UUID,
  "texto" TEXT NOT NULL,
  "anonimo" BOOLEAN NOT NULL,
  "comisionNombre" VARCHAR(10) NOT NULL,
  "materiaId" UUID NOT NULL,
  "materiaNombre" VARCHAR(150) NOT NULL,
  "cursadaId" UUID NOT NULL,
  "anio" INTEGER NOT NULL,
  "cuatrimestre" "Cuatrimestre" NOT NULL,
  "profesorNombre" VARCHAR(150),
  "profesorCargo" "CargoDocente",
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMPTZ(3),
  CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Feedback_texto_length" CHECK (char_length("texto") BETWEEN 1 AND 3000),
  CONSTRAINT "Feedback_profesor_snapshot" CHECK (
    ("profesorId" IS NULL AND "profesorNombre" IS NULL AND "profesorCargo" IS NULL) OR
    ("profesorId" IS NOT NULL AND "profesorNombre" IS NOT NULL AND "profesorCargo" IS NOT NULL)
  ),
  CONSTRAINT "Feedback_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Feedback_comisionId_fkey" FOREIGN KEY ("comisionId") REFERENCES "Comision"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Feedback_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "Profesor"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Feedback_autor_comision_vigente_key" ON "Feedback"("autorId", "comisionId") WHERE "deletedAt" IS NULL;
CREATE INDEX "Feedback_comisionId_deletedAt_createdAt_id_idx" ON "Feedback"("comisionId", "deletedAt", "createdAt", "id");
CREATE INDEX "Feedback_profesorId_deletedAt_createdAt_id_idx" ON "Feedback"("profesorId", "deletedAt", "createdAt", "id");
CREATE INDEX "Feedback_autorId_comisionId_idx" ON "Feedback"("autorId", "comisionId");

CREATE TABLE "FeedbackHistorial" (
  "id" UUID NOT NULL,
  "feedbackId" UUID NOT NULL,
  "accion" "FeedbackAccion" NOT NULL,
  "texto" TEXT NOT NULL,
  "anonimo" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeedbackHistorial_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FeedbackHistorial_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "FeedbackHistorial_feedbackId_createdAt_id_idx" ON "FeedbackHistorial"("feedbackId", "createdAt", "id");

