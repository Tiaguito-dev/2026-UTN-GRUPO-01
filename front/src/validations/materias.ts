import { ANIOS_CARRERA, NIVELES_ELECTIVA, type AnioCarrera, type NivelElectiva } from "@/types/materias";
export { ANIOS_CARRERA, NIVELES_ELECTIVA };
export interface MateriaContext { q?: string; nivelElectiva?: NivelElectiva }
export function isNivelElectiva(value: unknown): value is NivelElectiva { return typeof value === "string" && NIVELES_ELECTIVA.some((nivel) => nivel === value); }
export function nivelElectivaLabel(nivel: NivelElectiva | null): string { return nivel ? `${nivel === "3" ? "3.er" : `${nivel}.º`} Nivel` : "Sin nivel asignado"; }
export function validateMateriaSearch(value: string): string | undefined {
  if (Array.from(value.trim()).length > 150) return "Usá hasta 150 caracteres para buscar.";
  for (const char of value) { const code = char.codePointAt(0) ?? 0; if (code < 32 || (code >= 127 && code <= 159)) return "La búsqueda no puede contener caracteres de control."; }
}
export function parseMateriaContext(params: { get(name: string): string | null }): MateriaContext {
  const rawQ = params.get("q") ?? "";
  const q = !validateMateriaSearch(rawQ) ? rawQ.trim() : "";
  const nivel = params.get("nivelElectiva");
  return { ...(q ? { q } : {}), ...(params.get("anioCarrera") === "ELECTIVA" && isNivelElectiva(nivel) ? { nivelElectiva: nivel } : {}) };
}
function appendContext(query: URLSearchParams, anio: AnioCarrera | undefined, context: MateriaContext) {
  if (context.q?.trim() && !validateMateriaSearch(context.q)) query.set("q", context.q.trim());
  if (anio === "ELECTIVA" && isNivelElectiva(context.nivelElectiva)) query.set("nivelElectiva", context.nivelElectiva);
}
export function isAnioCarrera(value: unknown): value is AnioCarrera { return typeof value === "string" && ANIOS_CARRERA.some((anio) => anio === value); }
export function anioCarreraLabel(anio: AnioCarrera | null): string { return anio === "ELECTIVA" ? "Electiva" : anio ? `${anio}.º año` : "Sin año asignado"; }
export function materiaListHref(anio?: AnioCarrera, page = 1, context: MateriaContext = {}): string {
  const query = new URLSearchParams();
  appendContext(query, anio, context);
  if (anio) query.set("anioCarrera", anio);
  if (Number.isSafeInteger(page) && page > 1) query.set("page", String(page));
  return `/home/materias${query.size ? `?${query}` : ""}`;
}
export function materiaDetailHref(id: string, anio?: AnioCarrera, page = 1, context: MateriaContext = {}): string {
  const query = new URLSearchParams();
  appendContext(query, anio, context);
  if (anio) query.set("anioCarrera", anio);
  if (Number.isSafeInteger(page) && page > 1) query.set("listadoPage", String(page));
  return `/home/materias/${encodeURIComponent(id)}${query.size ? `?${query}` : ""}`;
}
export function parseMateriaPage(value: string | null): number { const page = Number(value); return Number.isSafeInteger(page) && page > 0 ? page : 1; }
