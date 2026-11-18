CREATE TABLE "AceptacionNormas" (
    "usuarioId" UUID NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "aceptadaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AceptacionNormas_pkey" PRIMARY KEY ("usuarioId", "version")
);

ALTER TABLE "AceptacionNormas" ADD CONSTRAINT "AceptacionNormas_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
