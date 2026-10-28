import { isAnioCarrera, isCarrera, isNivelElectiva, validateMateriaSearch } from "./materias";

export const ADMIN_SECTIONS = ["materias", "profesores", "cursadas", "comisiones", "usuarios"] as const;
export type AdminSection = typeof ADMIN_SECTIONS[number];
import type { AnioCarrera, Carrera, NivelElectiva } from "@/types/materias";

export interface AdminContext { seccion: AdminSection; page: number; materiaId?: string; cursadaId?: string; q?: string; carrera?: string; anioCarrera?: string; nivelElectiva?: string; rol?: string; estado?: string }
export function adminListHref(context: AdminContext): string {
  const query = new URLSearchParams();
  if ((context.seccion === "cursadas" || context.seccion === "comisiones") && context.materiaId) query.set("materiaId", context.materiaId);
  if (context.seccion === "comisiones" && context.materiaId && context.cursadaId) query.set("cursadaId", context.cursadaId);
  if (["materias", "profesores", "usuarios"].includes(context.seccion) && context.q?.trim() && !validateMateriaSearch(context.q)) query.set("q", context.q.trim());
  if (["materias", "comisiones"].includes(context.seccion) && isCarrera(context.carrera)) query.set("carrera", context.carrera);
  if (context.seccion === "materias" && isAnioCarrera(context.anioCarrera)) query.set("anioCarrera", context.anioCarrera);
  if (context.seccion === "materias" && context.anioCarrera === "ELECTIVA" && isNivelElectiva(context.nivelElectiva)) query.set("nivelElectiva", context.nivelElectiva);
  if (context.seccion === "usuarios" && (context.rol === "ADMIN" || context.rol === "USER")) query.set("rol", context.rol);
  if (context.seccion === "usuarios" && (context.estado === "ACTIVO" || context.estado === "INACTIVO")) query.set("estado", context.estado);
  if (Number.isSafeInteger(context.page) && context.page > 1) query.set("page", String(context.page));
  return `/home/admin/${context.seccion}${query.size ? `?${query}` : ""}`;
}
export function safeAdminReturnTo(raw: string | null | undefined): string | undefined {
  if (!raw || !raw.startsWith("/home/admin/") || raw.includes("\\")) return undefined;
  for (const character of raw) { const code = character.charCodeAt(0); if (code < 32 || code === 127) return undefined; }
  try {
    const url = new URL(raw, "https://local.invalid");
    if (url.pathname === "/home/admin/experiencias" && url.origin === "https://local.invalid" && !url.hash) {
      for (const key of url.searchParams.keys()) if (!["page", "carrera", "materiaId"].includes(key) || url.searchParams.getAll(key).length !== 1) return undefined;
      const page = Number(url.searchParams.get("page") ?? 1);
      const carrera = url.searchParams.get("carrera");
      const materiaId = url.searchParams.get("materiaId");
      if (!Number.isSafeInteger(page) || page < 1 || (carrera !== null && !["S", "C", "Q", "I", "M"].includes(carrera)) || (materiaId !== null && !/^[a-zA-Z0-9_-]+$/.test(materiaId))) return undefined;
      return `${url.pathname}${url.search}`;
    }
    const seccion = ADMIN_SECTIONS.find((section) => url.pathname === `/home/admin/${section}`);
    if (!seccion || url.origin !== "https://local.invalid" || url.hash) return undefined;
    const allowed = seccion === "comisiones" ? ["page", "materiaId", "cursadaId", "carrera"] : seccion === "cursadas" ? ["page", "materiaId"] : seccion === "materias" ? ["page", "q", "carrera", "anioCarrera", "nivelElectiva"] : seccion === "usuarios" ? ["page", "q", "rol", "estado"] : ["page", "q"];
    for (const key of url.searchParams.keys()) if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) return undefined;
    const page = Number(url.searchParams.get("page") ?? 1);
    if (!Number.isSafeInteger(page) || page < 1) return undefined;
    const filters = readAdminFilters(url.searchParams);
    for (const key of ["q", "carrera", "anioCarrera", "nivelElectiva", "rol", "estado"] as const) if (url.searchParams.has(key) && !filters[key]) return undefined;
    return adminListHref({ seccion, page, ...filters, materiaId: url.searchParams.get("materiaId") ?? undefined, cursadaId: url.searchParams.get("cursadaId") ?? undefined });
  } catch { return undefined; }
}
export interface AdminFilters { q?: string; carrera?: Carrera; anioCarrera?: AnioCarrera; nivelElectiva?: NivelElectiva; rol?: "ADMIN" | "USER"; estado?: "ACTIVO" | "INACTIVO" }
export function readAdminFilters(params: { get: (key: string) => string | null }): AdminFilters {
  const carrera = params.get("carrera"); const anio = params.get("anioCarrera"); const nivel = params.get("nivelElectiva"); const rol = params.get("rol");
  const estado = params.get("estado");
  const q = params.get("q")?.trim() ?? "";
  return { q: q && !validateMateriaSearch(q) ? q : undefined, carrera: isCarrera(carrera) ? carrera : undefined, anioCarrera: isAnioCarrera(anio) ? anio : undefined, nivelElectiva: anio === "ELECTIVA" && isNivelElectiva(nivel) ? nivel : undefined, rol: rol === "ADMIN" || rol === "USER" ? rol : undefined, estado: estado === "ACTIVO" || estado === "INACTIVO" ? estado : undefined };
}
export function adminFormHref(path: string, returnTo: string): string { return `${path}?${new URLSearchParams({ returnTo: safeAdminReturnTo(returnTo) ?? "/home/admin/materias" })}`; }
export function adminSuccessHref(path: string, message: string): string {
  const url = new URL(path, "https://local.invalid"); url.searchParams.set("successMessage", message);
  return `${url.pathname}?${url.searchParams}`;
}

/** Mantiene la selección original y avisa cuando no incluirá el alta. */
export function adminCreationHref(path: string, message: string, record: {
  nombre?: string; nombreCompleto?: string; materiaId?: string; cursadaId?: string; carrera?: string;
  carreras?: readonly { carrera: string; anioCarrera: string; nivelElectiva?: string | null }[];
}): string {
  const url = new URL(adminSuccessHref(path, message), "https://local.invalid");
  const q = url.searchParams.get("q");
  const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es");
  const carrera = url.searchParams.get("carrera");
  const anio = url.searchParams.get("anioCarrera");
  const nivel = url.searchParams.get("nivelElectiva");
  const outside = Boolean(
    (q && !normalize(record.nombre ?? record.nombreCompleto ?? "").includes(normalize(q))) ||
    (record.carreras && (carrera || anio || nivel) && !record.carreras.some((row) => (!carrera || row.carrera === carrera) && (!anio || row.anioCarrera === anio) && (!nivel || row.nivelElectiva === nivel))) ||
    (record.carrera && carrera && record.carrera !== carrera) ||
    (record.materiaId && url.searchParams.has("materiaId") && record.materiaId !== url.searchParams.get("materiaId")) ||
    (record.cursadaId && url.searchParams.has("cursadaId") && record.cursadaId !== url.searchParams.get("cursadaId"))
  );
  if (outside) url.searchParams.set("creationOutsideFilters", "1");
  else url.searchParams.delete("creationOutsideFilters");
  return `${url.pathname}?${url.searchParams}`;
}
