-- Aditiva: conserva comentarios e historiales existentes, sin asignar estrellas retroactivas.
ALTER TABLE "Feedback"
  ADD COLUMN "puntuacion" INTEGER;

ALTER TABLE "Feedback"
  ADD CONSTRAINT "Feedback_puntuacion_check"
  CHECK ("puntuacion" IS NULL OR "puntuacion" BETWEEN 1 AND 5);

ALTER TABLE "FeedbackHistorial"
  ADD COLUMN "puntuacion" INTEGER;

ALTER TABLE "FeedbackHistorial"
  ADD CONSTRAINT "FeedbackHistorial_puntuacion_check"
  CHECK ("puntuacion" IS NULL OR "puntuacion" BETWEEN 1 AND 5);

CREATE INDEX "Feedback_autorId_materiaId_deletedAt_idx"
  ON "Feedback" ("autorId", "materiaId", "deletedAt");

CREATE TABLE "ValoracionMateria" (
  "usuarioId" UUID NOT NULL,
  "materiaId" UUID NOT NULL,
  "puntuacion" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMPTZ(3),

  CONSTRAINT "ValoracionMateria_pkey"
    PRIMARY KEY ("usuarioId", "materiaId"),

  CONSTRAINT "ValoracionMateria_puntuacion_check"
    CHECK ("puntuacion" BETWEEN 1 AND 5),

  CONSTRAINT "ValoracionMateria_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "User" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,

  CONSTRAINT "ValoracionMateria_materiaId_fkey"
    FOREIGN KEY ("materiaId") REFERENCES "Materia" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ValoracionMateria_materiaId_deletedAt_idx"
  ON "ValoracionMateria" ("materiaId", "deletedAt");
