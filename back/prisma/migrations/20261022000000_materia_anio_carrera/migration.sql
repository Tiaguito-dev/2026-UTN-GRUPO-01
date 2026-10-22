ALTER TABLE "Materia" ADD COLUMN "anioCarrera" VARCHAR(8);
ALTER TABLE "Materia" ADD CONSTRAINT "Materia_anioCarrera_check"
  CHECK ("anioCarrera" IS NULL OR "anioCarrera" IN ('1', '2', '3', '4', '5', 'ELECTIVA'));
CREATE INDEX "Materia_deletedAt_anioCarrera_nombre_id_idx" ON "Materia"("deletedAt", "anioCarrera", "nombre", "id");

CREATE TABLE "MateriaHistorial" (
  "id" UUID NOT NULL,
  "materiaId" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cambios" JSONB NOT NULL,
  CONSTRAINT "MateriaHistorial_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MateriaHistorial_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MateriaHistorial_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "MateriaHistorial_materiaId_createdAt_id_idx" ON "MateriaHistorial"("materiaId", "createdAt", "id");
