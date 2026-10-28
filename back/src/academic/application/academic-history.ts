import { z } from "zod";

const changeSchema = z.object({ campo: z.string(), anterior: z.string().nullable(), nuevo: z.string().nullable() });
const materiaChangeSchema = changeSchema.extend({ campo: z.enum(["nombre", "modalidad", "anioCarrera", "nivelElectiva", "carreras", "deletedAt"]) });

/** Valida el JSON persistido antes de publicarlo como contrato de historial. */
export const parseAcademicHistoryChanges = (value: unknown) => z.array(changeSchema).parse(value);
export const parseMateriaHistoryChanges = (value: unknown) => z.array(materiaChangeSchema).parse(value);
