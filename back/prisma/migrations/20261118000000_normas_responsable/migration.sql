-- Documento previo: se conserva sin inventar un administrador ni una fecha de edición.
ALTER TABLE "NormasConvivencia" ADD COLUMN "actualizadoPorId" UUID;

CREATE INDEX "NormasConvivencia_actualizadoPorId_idx" ON "NormasConvivencia"("actualizadoPorId");

ALTER TABLE "NormasConvivencia" ADD CONSTRAINT "NormasConvivencia_actualizadoPorId_fkey"
FOREIGN KEY ("actualizadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
