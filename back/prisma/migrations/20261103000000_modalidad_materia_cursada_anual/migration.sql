BEGIN;

-- Never merge commissions/comments or replace IDs when legacy periods collide.
LOCK TABLE "Cursada" IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Cursada" GROUP BY "materiaId", "anio" HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Existen cursadas duplicadas por materia y año, incluidas bajas. Revise sus relaciones antes de aplicar la unicidad anual; no se fusionaron ni eliminaron datos.';
  END IF;
END $$;

CREATE TYPE "ModalidadMateria" AS ENUM ('ANUAL', 'PRIMERO', 'SEGUNDO');
ALTER TABLE "Materia" ADD COLUMN "modalidad" "ModalidadMateria";
ALTER TABLE "Feedback" ADD COLUMN "modalidad" "ModalidadMateria";

-- Infer only unambiguous evidence. No periods or conflicting periods remain undefined.
UPDATE "Materia" m
SET "modalidad" = evidence."modalidad"::"ModalidadMateria"
FROM (
  SELECT "materiaId", MIN("cuatrimestre"::text) AS "modalidad"
  FROM "Cursada"
  GROUP BY "materiaId"
  HAVING COUNT(DISTINCT "cuatrimestre") = 1 AND COUNT("cuatrimestre") = COUNT(*)
) evidence
WHERE evidence."materiaId" = m."id";

-- A historical comment uses its own snapshot, never the subject's present configuration.
UPDATE "Feedback" SET "modalidad" = "cuatrimestre"::text::"ModalidadMateria";

ALTER TABLE "Cursada" ALTER COLUMN "cuatrimestre" DROP NOT NULL;
ALTER TABLE "Feedback" ALTER COLUMN "cuatrimestre" DROP NOT NULL;
DROP INDEX "Cursada_materiaId_anio_cuatrimestre_key";
CREATE UNIQUE INDEX "Cursada_materiaId_anio_key" ON "Cursada"("materiaId", "anio");

COMMIT;
