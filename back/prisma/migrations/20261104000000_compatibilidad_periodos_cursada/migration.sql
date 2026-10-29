BEGIN;
-- Compatibility with local installations of the previous, unpublished feature migration.
-- Unknown legacy periods remain null for manual review, never inferred from current data.
LOCK TABLE "Cursada" IN ACCESS EXCLUSIVE MODE;
CREATE UNIQUE INDEX IF NOT EXISTS "Cursada_materiaId_anio_cuatrimestre_key"
  ON "Cursada"("materiaId", "anio", "cuatrimestre");
DROP INDEX IF EXISTS "Cursada_materiaId_anio_key";
COMMIT;
