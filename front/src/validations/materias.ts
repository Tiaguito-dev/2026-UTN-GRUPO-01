import {
  ANIOS_CARRERA,
  CARRERAS,
  NIVELES_ELECTIVA,
  MODALIDADES_MATERIA,
  type AnioCarrera,
  type Carrera,
  type NivelElectiva,
  type ModalidadMateria,
  type MateriaCarrera,
} from "@/types/materias";
import { carreraLabel } from "@/lib/format/carrera";
export { CARRERA_LABEL, CARRERA_SHORT_LABEL, carreraLabel, carreraShortLabel } from "@/lib/format/carrera";

export { ANIOS_CARRERA, CARRERAS, NIVELES_ELECTIVA, MODALIDADES_MATERIA };
export type { Carrera };

const MODALIDAD_LABEL: Record<ModalidadMateria, string> = {
  ANUAL: "Anual",
  PRIMERO: "Cuatrimestral · 1.er cuatrimestre",
  SEGUNDO: "Cuatrimestral · 2.º cuatrimestre",
};

export function isModalidadMateria(value: unknown): value is ModalidadMateria {
  return typeof value === "string" && MODALIDADES_MATERIA.some((modalidad) => modalidad === value);
}

export function modalidadLabel(value: ModalidadMateria | null | undefined): string {
  return value ? MODALIDAD_LABEL[value] : "Modalidad sin definir";
}

export { CARGO_LABEL, CARGO_TONE, cargoLabel } from "@/lib/format/cargo";

export function isCarrera(value: unknown): value is Carrera {
  return typeof value === "string" && (CARRERAS as readonly string[]).includes(value);
}

export function carrerasResumenLabel(carreras: { carrera: Carrera }[] | Carrera[]): string {
  const codigos = [...new Set(carreras.map((c) => typeof c === "string" ? c : c.carrera))];
  return codigos.length > 1 ? "Básica" : carreraLabel(codigos[0]);
}

export function materiaAnioLabel(carreras: MateriaCarrera[], carrera?: Carrera): string {
  const selected = carreras.find((row) => row.carrera === carrera);
  const rows = selected ? [selected] : carreras;
  if (!rows.length) return "Sin año asignado";
  const year = rows[0].anioCarrera;
  if (rows.some((row) => row.anioCarrera !== year)) return "Año según carrera";
  if (year !== "ELECTIVA") return anioCarreraLabel(year);
  const level = rows[0].nivelElectiva;
  return rows.some((row) => row.nivelElectiva !== level)
    ? "Electiva · Nivel según carrera" : `Electiva · ${nivelElectivaLabel(level)}`;
}

export interface MateriaContext {
  carrera?: Carrera;
  q?: string;
  nivelElectiva?: NivelElectiva;
}

export function isNivelElectiva(value: unknown): value is NivelElectiva {
  return typeof value === "string" && NIVELES_ELECTIVA.some((nivel) => nivel === value);
}

export function nivelElectivaLabel(nivel: NivelElectiva | null): string {
  return nivel ? `${nivel === "3" ? "3.er" : `${nivel}.º`} Nivel` : "Sin nivel asignado";
}

export function validateMateriaSearch(value: string): string | undefined {
  if (Array.from(value.trim()).length > 150) return "Usá hasta 150 caracteres para buscar.";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 32 || (code >= 127 && code <= 159)) return "La búsqueda no puede contener caracteres de control.";
  }
}

export function parseMateriaContext(params: { get(name: string): string | null }): MateriaContext {
  const rawCarrera = params.get("carrera");
  const carrera = isCarrera(rawCarrera) ? rawCarrera : undefined;
  const rawQ = params.get("q") ?? "";
  const q = !validateMateriaSearch(rawQ) ? rawQ.trim() : "";
  const nivel = params.get("nivelElectiva");
  return {
    ...(carrera ? { carrera } : {}),
    ...(q ? { q } : {}),
    ...(params.get("anioCarrera") === "ELECTIVA" && isNivelElectiva(nivel) ? { nivelElectiva: nivel } : {}),
  };
}

export function isAnioCarrera(value: unknown): value is AnioCarrera {
  return typeof value === "string" && ANIOS_CARRERA.some((anio) => anio === value);
}

export function anioCarreraLabel(anio: AnioCarrera | null): string {
  return anio === "ELECTIVA" ? "Electiva" : anio ? `${anio}.º año` : "Sin año asignado";
}

export function materiaListHref(carrera?: Carrera, anio?: AnioCarrera, page = 1, context: MateriaContext = {}): string {
  const query = new URLSearchParams();
  const effectiveCarrera = carrera ?? context.carrera;
  if (context.q?.trim() && !validateMateriaSearch(context.q)) query.set("q", context.q.trim());
  if (effectiveCarrera) query.set("carrera", effectiveCarrera);
  if (anio) query.set("anioCarrera", anio);
  if (anio === "ELECTIVA" && isNivelElectiva(context.nivelElectiva)) query.set("nivelElectiva", context.nivelElectiva);
  if (Number.isSafeInteger(page) && page > 1) query.set("page", String(page));
  return `/home/materias${query.size ? `?${query}` : ""}`;
}

export function materiaDetailHref(id: string, carrera?: Carrera, anio?: AnioCarrera, page = 1, context: MateriaContext = {}): string {
  const query = new URLSearchParams();
  const effectiveCarrera = carrera ?? context.carrera;
  if (context.q?.trim() && !validateMateriaSearch(context.q)) query.set("q", context.q.trim());
  if (effectiveCarrera) query.set("carrera", effectiveCarrera);
  if (anio) query.set("anioCarrera", anio);
  if (anio === "ELECTIVA" && isNivelElectiva(context.nivelElectiva)) query.set("nivelElectiva", context.nivelElectiva);
  if (Number.isSafeInteger(page) && page > 1) query.set("listadoPage", String(page));
  return `/home/materias/${encodeURIComponent(id)}${query.size ? `?${query}` : ""}`;
}

export function parseMateriaPage(value: string | null): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}
