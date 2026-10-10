-- CreateEnum
CREATE TYPE "Cuatrimestre" AS ENUM ('PRIMERO', 'SEGUNDO');

-- CreateTable
CREATE TABLE "Materia" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Materia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profesor" (
    "id" UUID NOT NULL,
    "nombreCompleto" VARCHAR(150) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Profesor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cursada" (
    "id" UUID NOT NULL,
    "materiaId" UUID NOT NULL,
    "profesorId" UUID NOT NULL,
    "anio" INTEGER NOT NULL,
    "cuatrimestre" "Cuatrimestre" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Cursada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comision" (
    "id" UUID NOT NULL,
    "cursadaId" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Comision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Materia_nombre_key" ON "Materia"("nombre");

-- CreateIndex
CREATE INDEX "Cursada_profesorId_idx" ON "Cursada"("profesorId");

-- CreateIndex
CREATE UNIQUE INDEX "Cursada_materiaId_anio_cuatrimestre_key" ON "Cursada"("materiaId", "anio", "cuatrimestre");

-- CreateIndex
CREATE INDEX "Comision_cursadaId_idx" ON "Comision"("cursadaId");

-- CreateIndex
CREATE UNIQUE INDEX "Comision_cursadaId_nombre_key" ON "Comision"("cursadaId", "nombre");

-- AddForeignKey
ALTER TABLE "Cursada" ADD CONSTRAINT "Cursada_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cursada" ADD CONSTRAINT "Cursada_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "Profesor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comision" ADD CONSTRAINT "Comision_cursadaId_fkey" FOREIGN KEY ("cursadaId") REFERENCES "Cursada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
