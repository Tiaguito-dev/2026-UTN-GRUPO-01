CREATE TYPE "CategoriaSugerencia" AS ENUM (
    'MEJORA_PLATAFORMA',
    'NUEVA_FUNCIONALIDAD',
    'REPORTAR_ERROR',
    'CORRECCION_ACADEMICA',
    'OTROS'
);

CREATE TABLE "Sugerencia" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "categoria" "CategoriaSugerencia" NOT NULL,
    "contenido" VARCHAR(5000) NOT NULL,
    "solicitudId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sugerencia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Sugerencia_usuarioId_solicitudId_key" ON "Sugerencia"("usuarioId", "solicitudId");
CREATE INDEX "Sugerencia_createdAt_id_idx" ON "Sugerencia"("createdAt", "id");

ALTER TABLE "Sugerencia" ADD CONSTRAINT "Sugerencia_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
