import { z } from "zod";
import { requestJson } from "./http";
import { parseResponse } from "./schemas";

const materia = z.object({ id: z.string(), nombre: z.string() });
const materias = z.object({ items: z.array(materia).max(8) });
const experiencias = z.object({
  items: z.array(z.object({ id: z.string(), texto: z.string(), createdAt: z.iso.datetime(), materia })).max(5),
});
export type MateriaExplorador = z.infer<typeof materia>;
export type ExperienciaExplorador = z.infer<typeof experiencias>["items"][number];

export async function listarMateriasExplorador(q: string) {
  const query = q.trim() ? `?${new URLSearchParams({ q: q.trim() })}` : "";
  return parseResponse(materias, await requestJson(`/materias/explorar${query}`, { credentials: "omit" }));
}

export async function listarExperienciasExplorador(materiaId: string) {
  return parseResponse(experiencias, await requestJson(`/materias/explorar/${encodeURIComponent(materiaId)}/experiencias`, { credentials: "omit" }));
}
