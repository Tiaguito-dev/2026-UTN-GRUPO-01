-- T1 is an internal foundation. Do not deploy without the visibility changes from T2.
BEGIN;

CREATE TYPE "FeedbackEstadoModeracion" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

ALTER TYPE "FeedbackAccion" ADD VALUE 'APROBACION';
ALTER TYPE "FeedbackAccion" ADD VALUE 'RECHAZO';
ALTER TYPE "FeedbackAccion" ADD VALUE 'OCULTAMIENTO_AUTOR';
ALTER TYPE "FeedbackAccion" ADD VALUE 'RESTITUCION_AUTOR';
ALTER TYPE "FeedbackAccion" ADD VALUE 'OCULTAMIENTO_ADMIN';
ALTER TYPE "FeedbackAccion" ADD VALUE 'RESTITUCION_ADMIN';
ALTER TYPE "FeedbackAccion" ADD VALUE 'SOLICITUD_REVISION';

-- Existing experiences retain their historical publication status and soft deletion.
-- This backfill is compatibility metadata, not a fictitious administrative decision.
ALTER TABLE "Feedback"
  ADD COLUMN "estadoModeracion" "FeedbackEstadoModeracion" NOT NULL DEFAULT 'APROBADO',
  ADD COLUMN "versionModeracion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "requiereRevisionHumana" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "motivoRechazo" VARCHAR(1000),
  ADD COLUMN "ocultoAutor" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ocultoAdministracion" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ocultoReportes" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Feedback" ALTER COLUMN "estadoModeracion" SET DEFAULT 'PENDIENTE';

ALTER TABLE "Feedback"
  ADD CONSTRAINT "Feedback_versionModeracion_check" CHECK ("versionModeracion" >= 1),
  ADD CONSTRAINT "Feedback_motivoRechazo_check" CHECK (
    "motivoRechazo" IS NULL OR (
      char_length("motivoRechazo") BETWEEN 1 AND 1000
      AND "motivoRechazo" = btrim("motivoRechazo")
      AND "motivoRechazo" !~ '[[:cntrl:]]'
    )
  ),
  ADD CONSTRAINT "Feedback_rechazo_check" CHECK (
    "estadoModeracion" <> 'RECHAZADO'
    OR ("motivoRechazo" IS NOT NULL AND "requiereRevisionHumana")
  );

-- No retrospective inference for old snapshots; existing writers can still omit metadata.
ALTER TABLE "FeedbackHistorial"
  ADD COLUMN "estadoModeracion" "FeedbackEstadoModeracion",
  ADD COLUMN "versionModeracion" INTEGER,
  ADD COLUMN "requiereRevisionHumana" BOOLEAN,
  ADD COLUMN "motivoRechazo" VARCHAR(1000),
  ADD COLUMN "ocultoAutor" BOOLEAN,
  ADD COLUMN "ocultoAdministracion" BOOLEAN,
  ADD COLUMN "ocultoReportes" BOOLEAN,
  ADD COLUMN "motivoModeracion" VARCHAR(1000);

ALTER TABLE "FeedbackHistorial"
  ADD CONSTRAINT "FeedbackHistorial_versionModeracion_check"
    CHECK ("versionModeracion" IS NULL OR "versionModeracion" >= 1),
  ADD CONSTRAINT "FeedbackHistorial_motivoRechazo_check" CHECK (
    "motivoRechazo" IS NULL OR (
      char_length("motivoRechazo") BETWEEN 1 AND 1000
      AND "motivoRechazo" = btrim("motivoRechazo")
      AND "motivoRechazo" !~ '[[:cntrl:]]'
    )
  ),
  ADD CONSTRAINT "FeedbackHistorial_motivoModeracion_check" CHECK (
    "motivoModeracion" IS NULL OR (
      char_length("motivoModeracion") BETWEEN 1 AND 1000
      AND "motivoModeracion" = btrim("motivoModeracion")
      AND "motivoModeracion" !~ '[[:cntrl:]]'
    )
  ),
  ADD CONSTRAINT "FeedbackHistorial_rechazo_check" CHECK (
    "estadoModeracion" IS NULL OR "estadoModeracion" <> 'RECHAZADO'
    OR ("motivoRechazo" IS NOT NULL AND "requiereRevisionHumana" IS TRUE)
  );

CREATE INDEX "Feedback_estadoModeracion_deletedAt_createdAt_id_idx"
  ON "Feedback" ("estadoModeracion", "deletedAt", "createdAt", "id");

COMMIT;
