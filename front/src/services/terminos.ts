import { z } from "zod";
import type { TerminosCondiciones } from "@/types/auth";
import { requestJson } from "./http";
import { parseResponse } from "./schemas";

const terminosSchema: z.ZodType<TerminosCondiciones> = z.object({
  version: z.string().min(1),
  secciones: z.array(z.object({ titulo: z.string().min(1), parrafos: z.array(z.string().min(1)).min(1) })).min(1),
});

/** Documento público: no requiere cuenta ni registra una aceptación al consultarlo. */
export async function obtenerTerminosCondiciones(): Promise<TerminosCondiciones> {
  return parseResponse(terminosSchema, await requestJson("/auth/terms", { method: "GET" }));
}
