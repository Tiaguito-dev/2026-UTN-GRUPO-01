-- AlterTable
ALTER TABLE "Comision" ALTER COLUMN "carrera" SET NOT NULL;
ALTER TABLE "Comision" ALTER COLUMN "numero" SET NOT NULL;
ALTER TABLE "Comision" DROP CONSTRAINT "Comision_numero_check";
ALTER TABLE "Comision" ADD CONSTRAINT "Comision_numero_check" CHECK ("numero" BETWEEN 1 AND 999);
DROP INDEX "Comision_cursadaId_nombre_key";
CREATE UNIQUE INDEX "Comision_cursadaId_carrera_numero_key" ON "Comision"("cursadaId", "carrera", "numero");
ALTER TABLE "Comision" DROP COLUMN "nombre";

-- AlterTable
ALTER TABLE "Cursada" DROP CONSTRAINT "Cursada_profesorId_fkey";
DROP INDEX "Cursada_profesorId_idx";
ALTER TABLE "Cursada" DROP COLUMN "profesorId";

-- AlterTable
ALTER TABLE "Materia" DROP CONSTRAINT "Materia_nivelElectiva_check";
ALTER TABLE "Materia" DROP CONSTRAINT "Materia_anioCarrera_check";
DROP INDEX "Materia_deletedAt_anioCarrera_nombre_id_idx";
DROP INDEX "Materia_deletedAt_anioCarrera_nivelElectiva_nombre_id_idx";
ALTER TABLE "Materia" DROP COLUMN "nivelElectiva";
ALTER TABLE "Materia" DROP COLUMN "anioCarrera";
