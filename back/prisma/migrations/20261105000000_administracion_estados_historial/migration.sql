-- Aditiva: las cuentas existentes permanecen activas y se conservan todas las entidades.
ALTER TABLE "User" ADD COLUMN "disabledAt" TIMESTAMPTZ(3);
CREATE INDEX "User_role_disabledAt_createdAt_id_idx" ON "User" ("role", "disabledAt", "createdAt", "id");

CREATE TABLE "AdministracionHistorial" (
  "id" UUID NOT NULL,
  "entidad" VARCHAR(16) NOT NULL,
  "entidadId" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "accion" VARCHAR(24) NOT NULL,
  "cambios" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdministracionHistorial_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdministracionHistorial_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AdministracionHistorial_entidad_check" CHECK ("entidad" IN ('materia','profesor','cursada','comision','usuario'))
);
CREATE INDEX "AdministracionHistorial_entidad_entidadId_createdAt_id_idx" ON "AdministracionHistorial" ("entidad", "entidadId", "createdAt", "id");

-- Las claves de registros dados de baja pueden reutilizarse sin modificar su identidad histórica.
DROP INDEX "Materia_nombre_key";
CREATE UNIQUE INDEX "Materia_nombre_activa_key" ON "Materia" ("nombre") WHERE "deletedAt" IS NULL;
DROP INDEX "Cursada_materiaId_anio_cuatrimestre_key";
CREATE UNIQUE INDEX "Cursada_materiaId_anio_cuatrimestre_activa_key" ON "Cursada" ("materiaId", "anio", "cuatrimestre") WHERE "deletedAt" IS NULL;
CREATE INDEX "Cursada_materiaId_idx" ON "Cursada" ("materiaId");
DROP INDEX "Comision_cursadaId_carrera_numero_key";
CREATE UNIQUE INDEX "Comision_cursadaId_carrera_numero_activa_key" ON "Comision" ("cursadaId", "carrera", "numero") WHERE "deletedAt" IS NULL;
