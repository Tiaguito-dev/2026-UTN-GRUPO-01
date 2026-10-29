BEGIN;

-- Preserve every course period from desarrollo; never merge commissions or IDs.
LOCK TABLE "Cursada" IN ACCESS EXCLUSIVE MODE;

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

COMMIT;
