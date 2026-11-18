CREATE TABLE "NormasConvivencia" (
    "id" VARCHAR(16) NOT NULL DEFAULT 'vigentes',
    "titulo" VARCHAR(160) NOT NULL,
    "introduccion" TEXT NOT NULL,
    "normas" TEXT[] NOT NULL,
    "cierre" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NormasConvivencia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NormasConvivencia_documento_vigente" CHECK ("id" = 'vigentes'),
    CONSTRAINT "NormasConvivencia_normas_presentes" CHECK (cardinality("normas") > 0)
);

-- Carga inicial aditiva: repetir este INSERT nunca reemplaza una edición posterior.
INSERT INTO "NormasConvivencia" ("id", "titulo", "introduccion", "normas", "cierre")
VALUES (
    'vigentes',
    'Construyamos una comunidad que sume',
    E'Creamos Professors'' Butchery para que los estudiantes puedan compartir sus experiencias y ayudarse mutuamente.\n\nQueremos fomentar las opiniones sinceras y las críticas constructivas, siempre desde el respeto.',
    ARRAY[
        'Compartí experiencias reales y mensajes que sumen.',
        'Realizá críticas constructivas.',
        'Debatí ideas, no ataques personas.',
        'Evitá los insultos, la discriminación y el hate gratuito.',
        'Respetá la privacidad de los demás.',
        'No compartas información falsa deliberadamente.',
        'Ayudá a otros estudiantes a tomar mejores decisiones.'
    ],
    E'Tu experiencia puede hacer la diferencia para otro estudiante.\n\nDe estudiantes, para estudiantes.\n\n— El equipo de Professors'' Butchery.'
)
ON CONFLICT ("id") DO NOTHING;
