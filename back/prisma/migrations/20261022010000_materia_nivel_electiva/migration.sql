ALTER TABLE "Materia" ADD COLUMN "nivelElectiva" VARCHAR(1);
ALTER TABLE "Materia" ADD CONSTRAINT "Materia_nivelElectiva_check"
  CHECK ("nivelElectiva" IS NULL OR ("anioCarrera" IS NOT NULL AND "anioCarrera" = 'ELECTIVA' AND "nivelElectiva" IN ('3', '4', '5')));
CREATE INDEX "Materia_deletedAt_anioCarrera_nivelElectiva_nombre_id_idx"
  ON "Materia"("deletedAt", "anioCarrera", "nivelElectiva", "nombre", "id");
