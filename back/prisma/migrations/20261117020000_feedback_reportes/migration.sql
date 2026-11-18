BEGIN;

-- Extend the existing audit ledger without changing past migrations or events.
ALTER TABLE "AdministracionHistorial"
  DROP CONSTRAINT "AdministracionHistorial_entidad_check",
  ADD CONSTRAINT "AdministracionHistorial_entidad_check"
    CHECK ("entidad" IN ('materia', 'profesor', 'cursada', 'comision', 'usuario', 'feedback', 'feedbackLike', 'respuesta', 'feedbackReporte'));

CREATE TYPE "FeedbackReporteMotivo" AS ENUM ('INSULTOS_ACOSO', 'AMENAZAS_INTIMIDACION', 'DISCRIMINACION', 'DATOS_PERSONALES', 'SPAM', 'OTRO');
CREATE TYPE "FeedbackReporteEstado" AS ENUM ('ABIERTO', 'RESUELTO', 'DESESTIMADO');

CREATE UNIQUE INDEX "FeedbackHistorial_feedbackId_id_key" ON "FeedbackHistorial"("feedbackId", "id");

CREATE TABLE "FeedbackReporte" (
  "id" UUID NOT NULL,
  "feedbackId" UUID NOT NULL,
  "denuncianteId" UUID NOT NULL,
  "versionReportada" INTEGER NOT NULL,
  "historialId" UUID NOT NULL,
  "motivo" "FeedbackReporteMotivo" NOT NULL,
  "descripcion" VARCHAR(1000),
  "estado" "FeedbackReporteEstado" NOT NULL DEFAULT 'ABIERTO',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMPTZ(3),
  "administradorId" UUID,
  "justificacion" VARCHAR(1000),
  CONSTRAINT "FeedbackReporte_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FeedbackReporte_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FeedbackReporte_denuncianteId_fkey" FOREIGN KEY ("denuncianteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FeedbackReporte_administradorId_fkey" FOREIGN KEY ("administradorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FeedbackReporte_feedbackId_historialId_fkey" FOREIGN KEY ("feedbackId", "historialId") REFERENCES "FeedbackHistorial"("feedbackId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FeedbackReporte_version_check" CHECK ("versionReportada" >= 1),
  CONSTRAINT "FeedbackReporte_descripcion_check" CHECK ("descripcion" IS NULL OR (char_length(btrim("descripcion")) BETWEEN 1 AND 1000 AND "descripcion" !~ '[[:cntrl:]]')),
  CONSTRAINT "FeedbackReporte_cierre_check" CHECK (
    ("estado" = 'ABIERTO' AND "resolvedAt" IS NULL AND "administradorId" IS NULL AND "justificacion" IS NULL)
    OR ("estado" <> 'ABIERTO' AND "resolvedAt" IS NOT NULL AND "resolvedAt" >= "createdAt" AND "administradorId" IS NOT NULL
      AND "justificacion" IS NOT NULL AND char_length(btrim("justificacion")) BETWEEN 1 AND 1000 AND "justificacion" !~ '[[:cntrl:]]')
  )
);
CREATE UNIQUE INDEX "FeedbackReporte_denuncianteId_feedbackId_versionReportada_key" ON "FeedbackReporte"("denuncianteId", "feedbackId", "versionReportada");
CREATE INDEX "FeedbackReporte_denuncianteId_createdAt_idx" ON "FeedbackReporte"("denuncianteId", "createdAt");
CREATE INDEX "FeedbackReporte_feedbackId_estado_denuncianteId_idx" ON "FeedbackReporte"("feedbackId", "estado", "denuncianteId");
CREATE INDEX "FeedbackReporte_estado_createdAt_id_idx" ON "FeedbackReporte"("estado", "createdAt" DESC, "id" DESC);
CREATE INDEX "FeedbackReporte_motivo_createdAt_id_idx" ON "FeedbackReporte"("motivo", "createdAt" DESC, "id" DESC);
CREATE INDEX "FeedbackReporte_createdAt_id_idx" ON "FeedbackReporte"("createdAt" DESC, "id" DESC);

COMMIT;
