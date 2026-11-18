-- T2: reconcile the derived projection without changing experiences or T1 moderation evidence.
-- Matches visibleMateriaVotesSql: latest CREACION/EDICION event, never a moderation timestamp.
BEGIN;

-- Stabilize the source before rebuilding its projection, including on an active installation.
LOCK TABLE "Feedback", "FeedbackHistorial" IN SHARE MODE;
LOCK TABLE "ValoracionMateria" IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE "_T2VisibleMateriaVotes" ON COMMIT DROP AS
SELECT DISTINCT ON (f."autorId", f."materiaId")
  f."autorId" AS "usuarioId", f."materiaId", f."puntuacion"
FROM "Feedback" f
LEFT JOIN LATERAL (
  SELECT h."createdAt", h."id" FROM "FeedbackHistorial" h
  WHERE h."feedbackId" = f."id" AND h."accion" IN ('CREACION', 'EDICION')
  ORDER BY h."createdAt" DESC, h."id" DESC LIMIT 1
) content ON TRUE
WHERE f."estadoModeracion" = 'APROBADO' AND f."deletedAt" IS NULL
  AND NOT f."ocultoAutor" AND NOT f."ocultoAdministracion" AND NOT f."ocultoReportes"
  AND f."puntuacion" IS NOT NULL
ORDER BY f."autorId", f."materiaId", COALESCE(content."createdAt", f."createdAt") DESC,
  COALESCE(content."id", f."id") DESC, f."id" DESC;

UPDATE "ValoracionMateria" v SET "deletedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
WHERE v."deletedAt" IS NULL AND NOT EXISTS (
  SELECT 1 FROM "_T2VisibleMateriaVotes" eligible
  WHERE eligible."usuarioId" = v."usuarioId" AND eligible."materiaId" = v."materiaId"
);

INSERT INTO "ValoracionMateria" ("usuarioId", "materiaId", "puntuacion")
SELECT "usuarioId", "materiaId", "puntuacion" FROM "_T2VisibleMateriaVotes"
ON CONFLICT ("usuarioId", "materiaId") DO UPDATE
SET "puntuacion" = EXCLUDED."puntuacion", "deletedAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "ValoracionMateria"."puntuacion" IS DISTINCT FROM EXCLUDED."puntuacion"
  OR "ValoracionMateria"."deletedAt" IS NOT NULL;

COMMIT;
