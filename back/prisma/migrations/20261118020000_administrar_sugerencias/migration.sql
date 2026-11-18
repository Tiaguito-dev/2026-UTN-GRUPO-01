-- La baja conserva la clave de envío y el recibo original: un reintento no recrea la sugerencia.
ALTER TABLE "Sugerencia"
  ADD COLUMN "meGusta" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deletedAt" TIMESTAMPTZ(3);
