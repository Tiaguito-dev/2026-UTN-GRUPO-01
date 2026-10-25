CREATE TYPE "Carrera" AS ENUM ('S', 'C', 'Q', 'I', 'M');
CREATE TYPE "CargoDocente" AS ENUM ('TITULAR', 'ADJUNTO', 'JTP');

CREATE TABLE "MateriaCarrera" (
    "materiaId" UUID NOT NULL,
    "carrera" "Carrera" NOT NULL,
    "anioCarrera" VARCHAR(8) NOT NULL,
    "nivelElectiva" VARCHAR(1),

    CONSTRAINT "MateriaCarrera_pkey" PRIMARY KEY ("materiaId", "carrera"),
    CONSTRAINT "MateriaCarrera_anioCarrera_check"
      CHECK ("anioCarrera" IN ('1', '2', '3', '4', '5', 'ELECTIVA')),
    CONSTRAINT "MateriaCarrera_nivelElectiva_check"
      CHECK ("nivelElectiva" IS NULL OR ("anioCarrera" IS NOT NULL AND "anioCarrera" = 'ELECTIVA' AND "nivelElectiva" IN ('3', '4', '5')))
);
CREATE INDEX "MateriaCarrera_carrera_anioCarrera_nivelElectiva_idx"
  ON "MateriaCarrera"("carrera", "anioCarrera", "nivelElectiva");
ALTER TABLE "MateriaCarrera" ADD CONSTRAINT "MateriaCarrera_materiaId_fkey"
  FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ComisionProfesor" (
    "comisionId" UUID NOT NULL,
    "profesorId" UUID NOT NULL,
    "cargo" "CargoDocente" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComisionProfesor_pkey" PRIMARY KEY ("comisionId", "profesorId")
);
CREATE INDEX "ComisionProfesor_profesorId_idx" ON "ComisionProfesor"("profesorId");
ALTER TABLE "ComisionProfesor" ADD CONSTRAINT "ComisionProfesor_comisionId_fkey"
  FOREIGN KEY ("comisionId") REFERENCES "Comision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComisionProfesor" ADD CONSTRAINT "ComisionProfesor_profesorId_fkey"
  FOREIGN KEY ("profesorId") REFERENCES "Profesor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Comision" ADD COLUMN "carrera" "Carrera";
ALTER TABLE "Comision" ADD COLUMN "numero" INTEGER;
ALTER TABLE "Comision" ADD CONSTRAINT "Comision_numero_check"
  CHECK ("numero" IS NULL OR "numero" BETWEEN 1 AND 999);

ALTER TABLE "Cursada" ALTER COLUMN "profesorId" DROP NOT NULL;
