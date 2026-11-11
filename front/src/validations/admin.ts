import { isAnioCarrera, isCarrera, isNivelElectiva, validateMateriaSearch } from "./materias";
import { internalDestination } from "@/lib/navigation";

export const ADMIN_SECTIONS = ["materias", "profesores", "cursadas", "comisiones", "usuarios"] as const;
export type AdminSection = typeof ADMIN_SECTIONS[number];
import type { AnioCarrera, Carrera, NivelElectiva } from "@/types/materias";

export interface AdminContext { seccion: AdminSection; page: number; materiaId?: string; cursadaId?: string; materiaReturnTo?: string; q?: string; carrera?: string; anioCarrera?: string; nivelElectiva?: string; rol?: string; estado?: string }
export function adminListHref(context: AdminContext): string {
  const query = new URLSearchParams();
  if ((context.seccion === "cursadas" || context.seccion === "comisiones") && context.materiaId) query.set("materiaId", context.materiaId);
  if (context.seccion === "comisiones" && context.materiaId && context.cursadaId) query.set("cursadaId", context.cursadaId);
  if ((context.seccion === "cursadas" || context.seccion === "comisiones") && context.materiaId && context.materiaReturnTo) {
    const origin = safeMateriaListOrigin(context.materiaReturnTo);
    if (origin) query.set("materiaReturnTo", origin);
  }
  if (["materias", "profesores", "usuarios"].includes(context.seccion) && context.q?.trim() && !validateMateriaSearch(context.q)) query.set("q", context.q.trim());
  if (["materias", "comisiones"].includes(context.seccion) && isCarrera(context.carrera)) query.set("carrera", context.carrera);
  if (context.seccion === "materias" && isAnioCarrera(context.anioCarrera)) query.set("anioCarrera", context.anioCarrera);
  if (context.seccion === "materias" && context.anioCarrera === "ELECTIVA" && isNivelElectiva(context.nivelElectiva)) query.set("nivelElectiva", context.nivelElectiva);
  if (context.seccion === "usuarios" && (context.rol === "ADMIN" || context.rol === "USER")) query.set("rol", context.rol);
  if (context.seccion === "usuarios" && (context.estado === "ACTIVO" || context.estado === "INACTIVO")) query.set("estado", context.estado);
  if (Number.isSafeInteger(context.page) && context.page > 1) query.set("page", String(context.page));
  return `/home/admin/${context.seccion}${query.size ? `?${query}` : ""}`;
}
const EXPERIENCIAS_ORIGIN = [["carrera", "experienciasCarrera"], ["materiaId", "experienciasMateriaId"], ["page", "experienciasPage"]] as const;
type Params = { get(key: string): string | null };

/** On a commission, Experiencias travels as flat params (origen=experiencias), never as a nested URL. */
export function experienciasOriginHref(params: Params): string | undefined {
  if (params.get("origen") !== "experiencias") return undefined;
  const query = new URLSearchParams();
  for (const [key, source] of EXPERIENCIAS_ORIGIN) { const value = params.get(source); if (value !== null) query.set(key, value); }
  const href = `/home/admin/experiencias${query.size ? `?${query}` : ""}`;
  return safeAdminReturnTo(href) === href ? href : undefined;
}
export function experienciasOriginQuery(list: string): URLSearchParams {
  const source = new URL(list, "https://local.invalid").searchParams;
  const query = new URLSearchParams({ origen: "experiencias" });
  for (const [key, target] of EXPERIENCIAS_ORIGIN) { const value = source.get(key); if (value) query.set(target, value); }
  return query;
}

/** returnTo holds one level: the target's own returnTo is dropped and the Materias filters ride beside it. */
export function returnToQuery(raw: string | null | undefined): URLSearchParams {
  const query = new URLSearchParams();
  if (!internalDestination(raw)) return query;
  const url = new URL(raw!, "https://local.invalid");
  const inner = url.searchParams.get("returnTo");
  const origin = safeMateriaListOrigin(url.searchParams.get("materiaReturnTo") ?? inner);
  url.searchParams.delete("returnTo"); url.searchParams.delete("materiaReturnTo");
  const target = safeAdminReturnTo(`${url.pathname}${url.search}`);
  if (target) query.set("returnTo", target);
  if (target && origin) query.set("materiaReturnTo", origin);
  return query;
}

/** Rebuilds the previous level from its flat returnTo and the Materias filters beside it. */
export function joinedReturnTo(params: Params): string | undefined {
  const target = safeAdminReturnTo(params.get("returnTo"));
  const origin = safeMateriaListOrigin(params.get("materiaReturnTo"));
  if (!target || !origin) return target;
  const url = new URL(target, "https://local.invalid");
  url.searchParams.set("materiaReturnTo", origin);
  return safeAdminReturnTo(`${url.pathname}?${url.searchParams}`) ?? target;
}

export function safeAdminReturnTo(raw: string | null | undefined): string | undefined {
  if (!raw || raw.length > 12000 || !internalDestination(raw) || !raw.startsWith("/home/admin/")) return undefined;
  for (const character of raw) { const code = character.charCodeAt(0); if (code < 32 || code === 127) return undefined; }
  try {
    const url = new URL(raw, "https://local.invalid");
    for (const key of ["successMessage", "creationOutsideFilters"]) url.searchParams.delete(key);
    const detail = url.pathname.match(/^\/home\/admin\/(materias|profesores|cursadas|comisiones)\/([^/]+)$/);
    if (detail && url.origin === "https://local.invalid" && !url.hash && /^[a-zA-Z0-9_-]+$/.test(detail[2]!)) {
      const allowed = detail[1] === "comisiones" ? ["materiaReturnTo", "page", "origen", ...EXPERIENCIAS_ORIGIN.map(([, key]) => key)] : ["materiaReturnTo"];
      if ([...url.searchParams.keys()].some(key => !allowed.includes(key)) || [...url.searchParams.keys()].some(key => url.searchParams.getAll(key).length !== 1)) return undefined;
      const materiaReturnTo = url.searchParams.get("materiaReturnTo");
      const safeMateriaReturn = materiaReturnTo ? safeMateriaListOrigin(materiaReturnTo) : undefined;
      if (materiaReturnTo && !safeMateriaReturn) return undefined;
      if (url.searchParams.has("origen") && !experienciasOriginHref(url.searchParams)) return undefined;
      const query = new URLSearchParams();
      if (url.searchParams.has("origen")) for (const key of ["origen", ...EXPERIENCIAS_ORIGIN.map(([, key]) => key)]) { const value = url.searchParams.get(key); if (value !== null) query.set(key, value); }
      if (safeMateriaReturn) query.set("materiaReturnTo", safeMateriaReturn);
      if (url.searchParams.has("page")) {
        const page = Number(url.searchParams.get("page"));
        if (!Number.isSafeInteger(page) || page < 1) return undefined;
        if (page > 1) query.set("page", String(page));
      }
      return `${url.pathname}${query.size ? `?${query}` : ""}`;
    }
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
    const allowed = seccion === "comisiones" ? ["page", "materiaId", "cursadaId", "carrera", "materiaReturnTo"] : seccion === "cursadas" ? ["page", "materiaId", "materiaReturnTo"] : seccion === "materias" ? ["page", "q", "carrera", "anioCarrera", "nivelElectiva"] : seccion === "usuarios" ? ["page", "q", "rol", "estado"] : ["page", "q"];
    for (const key of url.searchParams.keys()) if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) return undefined;
    const page = Number(url.searchParams.get("page") ?? 1);
    if (!Number.isSafeInteger(page) || page < 1) return undefined;
    const filters = readAdminFilters(url.searchParams);
    for (const key of ["q", "carrera", "anioCarrera", "nivelElectiva", "rol", "estado"] as const) if (url.searchParams.has(key) && !filters[key]) return undefined;
    const materiaId = url.searchParams.get("materiaId") ?? undefined;
    const cursadaId = url.searchParams.get("cursadaId") ?? undefined;
    const materiaReturnTo = url.searchParams.get("materiaReturnTo") ?? undefined;
    if (seccion === "cursadas" && !materiaId && materiaReturnTo) return undefined;
    if (seccion === "comisiones" && (!materiaId || !cursadaId) && materiaReturnTo) return undefined;
    if (materiaReturnTo && safeMateriaListOrigin(materiaReturnTo) !== materiaReturnTo) return undefined;
    if ([materiaId, cursadaId].some(id => id !== undefined && !/^[a-zA-Z0-9_-]+$/.test(id))) return undefined;
    return adminListHref({ seccion, page, ...filters, materiaId, cursadaId, materiaReturnTo });
  } catch { return undefined; }
}

export function safeMateriaListOrigin(raw: string | null | undefined): string | undefined {
  const safe = safeAdminReturnTo(raw);
  if (!safe || new URL(safe, "https://local.invalid").pathname !== "/home/admin/materias") return undefined;
  return safe;
}
export interface AdminFilters { q?: string; carrera?: Carrera; anioCarrera?: AnioCarrera; nivelElectiva?: NivelElectiva; rol?: "ADMIN" | "USER"; estado?: "ACTIVO" | "INACTIVO" }
export function readAdminFilters(params: { get: (key: string) => string | null }): AdminFilters {
  const carrera = params.get("carrera"); const anio = params.get("anioCarrera"); const nivel = params.get("nivelElectiva"); const rol = params.get("rol");
  const estado = params.get("estado");
  const q = params.get("q")?.trim() ?? "";
  return { q: q && !validateMateriaSearch(q) ? q : undefined, carrera: isCarrera(carrera) ? carrera : undefined, anioCarrera: isAnioCarrera(anio) ? anio : undefined, nivelElectiva: anio === "ELECTIVA" && isNivelElectiva(nivel) ? nivel : undefined, rol: rol === "ADMIN" || rol === "USER" ? rol : undefined, estado: estado === "ACTIVO" || estado === "INACTIVO" ? estado : undefined };
}
export function adminFormHref(path: string, returnTo: string): string { const query = returnToQuery(returnTo); return `${path}?${query.size ? query : new URLSearchParams({ returnTo: "/home/admin/materias" })}`; }
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
