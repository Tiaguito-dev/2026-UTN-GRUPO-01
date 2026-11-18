import { adminListHref, experienciasOriginHref, experienciasOriginQuery, joinedReturnTo, returnToQuery, safeAdminReturnTo, safeMateriaListOrigin } from "./admin";
import type { BreadcrumbItem } from "@/components/ui/Breadcrumb";
import { periodoLabel } from "@/lib/format/periodo";

export function experienciasListReturnTo(raw: string | null | undefined): string | undefined {
  const safe = safeAdminReturnTo(raw);
  return safe && new URL(safe, "https://local.invalid").pathname === "/home/admin/experiencias" ? safe : undefined;
}

// returnTo holds one level; ancestors derive from record IDs. Only the Materias filters
// (materiaReturnTo) and the Experiencias origin (origen=experiencias) travel beside it, flat.
type Params = { get(key: string): string | null };
const isCommission = (path: string) => /^\/home\/admin\/comisiones\/[^/]+$/.test(path);

/** A detail is a destination, never another copy of itself in its return chain. */
export function administrativeDetailHref(section: "materias" | "profesores" | "cursadas" | "comisiones", id: string, raw?: string | null): string {
  const path = `/home/admin/${section}/${encodeURIComponent(id)}`;
  const origin = safeAdminReturnTo(raw);
  if (origin && new URL(origin, "https://local.invalid").pathname === path) return origin;
  const experience = section === "comisiones" ? experienciasListReturnTo(raw) : undefined;
  const query = experience ? experienciasOriginQuery(experience) : returnToQuery(raw);
  return `${path}${query.size ? `?${query}` : ""}`;
}

export function profesorDetailBack(raw: string | null | undefined): string {
  const safe = safeAdminReturnTo(raw);
  const path = safe ? new URL(safe, "https://local.invalid").pathname : "";
  return safe && (path === "/home/admin/profesores" || isCommission(path)) ? safe : "/home/admin/profesores";
}

export function adminEditReturnTo(section: "materias" | "profesores" | "cursadas" | "comisiones", id: string, raw: string | null | undefined): string {
  const safe = safeAdminReturnTo(raw);
  const path = `/home/admin/${section}/${encodeURIComponent(id)}`;
  if (safe) {
    const url = new URL(safe, "https://local.invalid");
    if (url.pathname === path || url.pathname === `/home/admin/${section}`) return safe;
    if (section === "comisiones" && experienciasListReturnTo(safe)) return safe;
    if (section === "profesores" && profesorDetailBack(safe) === safe) return safe;
  }
  return path;
}

const fromExperiencias = (params: Params) => Boolean(experienciasOriginHref(params) ?? experienciasListReturnTo(params.get("returnTo")));

/** Section selection follows only recognized entry contexts: the page's own origin or the commission it returns to. */
export function adminNavigationSection(pathname: string, params: Params): "materias" | "experiencias" | "profesores" | undefined {
  const detail = pathname.match(/^\/home\/admin\/(comisiones|profesores|experiencias)\/([^/]+)(?:\/editar)?$/);
  if (!detail) return undefined;
  const target = joinedReturnTo(params);
  const url = target ? new URL(target, "https://local.invalid") : undefined;
  const commission = url && isCommission(url.pathname) ? url.searchParams : undefined;
  if (detail[1] === "comisiones") return fromExperiencias(commission ?? params) ? "experiencias" : "materias";
  if (commission) return fromExperiencias(commission) ? "experiencias" : "materias";
  return detail[1] as "profesores" | "experiencias";
}

interface CommissionNavigationRecord {
  id: string; nombre: string;
  cursada: { id: string; anio: number; cuatrimestre?: "PRIMERO" | "SEGUNDO" | "ANUAL" | null; materia: { id: string; nombre: string } };
}

/** The Materias filters the chain started from: beside returnTo, or inside a one-level list. */
export function materiaOrigin(params: Params): string {
  const inner = safeAdminReturnTo(params.get("returnTo"));
  return safeMateriaListOrigin(params.get("materiaReturnTo") ?? (inner ? new URL(inner, "https://local.invalid").searchParams.get("materiaReturnTo") : null)) ?? "/home/admin/materias";
}

/** Reads the commission page's own query: returnTo (one level), materiaReturnTo and origen. */
export function comisionNavigation(params: Params, comision: CommissionNavigationRecord | null) {
  const experience = experienciasOriginHref(params) ?? experienciasListReturnTo(params.get("returnTo"));
  if (!comision) return {
    back: experience ?? "/home/admin/comisiones", materiaHref: "/home/admin/materias", courseHref: "/home/admin/cursadas", detailHref: "/home/admin/comisiones",
    breadcrumb: [{ label: "Administración", href: "/home/admin" }, { label: experience ? "Experiencias" : "Materias", href: experience ?? "/home/admin/materias" }, { label: "Comisión" }] as BreadcrumbItem[],
  };
  const { id: materiaId } = comision.cursada.materia;
  const cursadaId = comision.cursada.id;
  const origin = materiaOrigin(params);
  const materiaHref = materiaDetailHref(materiaId, origin);
  const courses = cursadasListHref(materiaId, origin);
  const courseHref = cursadaDetailHref(cursadaId, courses);
  const commissions = academicListReturnTo(joinedReturnTo(params), "comisiones", materiaId, cursadaId) ?? comisionesListHref(materiaId, cursadaId, origin);
  const back = experience ?? commissions;
  const breadcrumb: BreadcrumbItem[] = [{ label: "Administración", href: "/home/admin" }, ...(experience
    ? [{ label: "Experiencias", href: experience }]
    : [{ label: "Materias", href: origin }, { label: comision.cursada.materia.nombre, href: materiaHref }, { label: "Cursadas", href: courses }, { label: `Cursada ${periodoLabel(comision.cursada.anio, comision.cursada.cuatrimestre)}`, href: courseHref }, { label: "Comisiones", href: commissions }]), { label: `Comisión ${comision.nombre}` }];
  // As a returnTo of its sub-views (edit, profesor, experiencia), the commission is already flat.
  const detailHref = `/home/admin/comisiones/${encodeURIComponent(comision.id)}?${experience ? experienciasOriginQuery(experience) : new URLSearchParams({ materiaReturnTo: origin })}`;
  return { back, breadcrumb, materiaHref, courseHref, detailHref };
}

export function academicListReturnTo(raw: string | null | undefined, section: "cursadas" | "comisiones", materiaId: string, cursadaId?: string): string | undefined {
  const safe = safeAdminReturnTo(raw);
  if (!safe) return undefined;
  const url = new URL(safe, "https://local.invalid");
  if (url.pathname !== `/home/admin/${section}` || url.searchParams.get("materiaId") !== materiaId) return undefined;
  if (section === "comisiones" && url.searchParams.get("cursadaId") !== cursadaId) return undefined;
  if (section === "cursadas" && url.searchParams.has("cursadaId")) return undefined;
  return safe;
}

export function materiaDetailBack(raw: string | null | undefined): string | undefined {
  const safe = safeAdminReturnTo(raw);
  if (!safe) return undefined;
  const path = new URL(safe, "https://local.invalid").pathname;
  return path === "/home/admin/materias" ? safe : undefined;
}

export function materiaDetailHref(materiaId: string, materiaReturnTo?: string) {
  const query = new URLSearchParams();
  const origin = safeMateriaListOrigin(materiaReturnTo);
  if (origin) query.set("returnTo", origin);
  return `/home/admin/materias/${encodeURIComponent(materiaId)}${query.size ? `?${query}` : ""}`;
}

export function cursadasListHref(materiaId: string, materiaReturnTo?: string) {
  return adminListHref({ seccion: "cursadas", materiaId, materiaReturnTo: safeMateriaListOrigin(materiaReturnTo), page: 1 });
}

export function comisionesListHref(materiaId: string, cursadaId: string, materiaReturnTo?: string) {
  return adminListHref({ seccion: "comisiones", materiaId, cursadaId, materiaReturnTo: safeMateriaListOrigin(materiaReturnTo), page: 1 });
}

export function cursadaDetailHref(cursadaId: string, returnTo: string) {
  return administrativeDetailHref("cursadas", cursadaId, returnTo);
}

export function comisionDetailHref(comisionId: string, returnTo: string) {
  return administrativeDetailHref("comisiones", comisionId, returnTo);
}
