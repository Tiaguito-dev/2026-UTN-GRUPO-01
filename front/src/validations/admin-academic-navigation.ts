import { adminListHref, safeAdminReturnTo, safeMateriaListOrigin } from "./admin";
import type { BreadcrumbItem } from "@/components/ui/Breadcrumb";
import { periodoLabel } from "@/lib/format/periodo";

export function experienciasListReturnTo(raw: string | null | undefined): string | undefined {
  const safe = safeAdminReturnTo(raw);
  return safe && new URL(safe, "https://local.invalid").pathname === "/home/admin/experiencias" ? safe : undefined;
}

/** A detail is a destination, never another copy of itself in its return chain. */
export function administrativeDetailHref(section: "materias" | "profesores" | "cursadas" | "comisiones", id: string, raw?: string | null): string {
  const path = `/home/admin/${section}/${encodeURIComponent(id)}`;
  const origin = safeAdminReturnTo(raw);
  if (origin && new URL(origin, "https://local.invalid").pathname === path) {
    return origin;
  }
  return `${path}${origin ? `?${new URLSearchParams({ returnTo: origin })}` : ""}`;
}

export function profesorDetailBack(raw: string | null | undefined): string {
  const safe = safeAdminReturnTo(raw);
  if (safe) {
    const url = new URL(safe, "https://local.invalid");
    if (url.pathname === "/home/admin/profesores") return safe;
    if (/^\/home\/admin\/comisiones\/[^/]+$/.test(url.pathname)) {
      const parent = url.searchParams.get("returnTo");
      // Commission links carry only their own list context, never another detail.
      const list = parent ? new URL(parent, "https://local.invalid").pathname : undefined;
      if (!parent || experienciasListReturnTo(parent) || list === "/home/admin/comisiones") return safe;
    }
  }
  return "/home/admin/profesores";
}

export function adminEditReturnTo(section: "materias" | "profesores" | "cursadas" | "comisiones", id: string, raw: string | null): string {
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

/** Section selection follows only recognized entry contexts, not arbitrary return chains. */
export function adminNavigationSection(pathname: string, raw: string | null): "materias" | "experiencias" | "profesores" | undefined {
  const detail = pathname.match(/^\/home\/admin\/(comisiones|profesores|experiencias)\/([^/]+)(?:\/editar)?$/);
  if (!detail) return undefined;
  if (detail[1] === "experiencias") {
    const safe = safeAdminReturnTo(raw);
    return safe && profesorDetailBack(safe) === safe && /^\/home\/admin\/comisiones\//.test(safe)
      ? experienciasListReturnTo(new URL(safe, "https://local.invalid").searchParams.get("returnTo")) ? "experiencias" : "materias"
      : "experiencias";
  }
  const source = adminEditReturnTo(detail[1] as "comisiones" | "profesores", detail[2]!, raw);
  let origin = source;
  const url = new URL(source, "https://local.invalid");
  if (url.pathname === pathname.replace(/\/editar$/, "")) origin = url.searchParams.get("returnTo") ?? "";
  if (experienciasListReturnTo(origin)) return detail[1] === "comisiones" ? "experiencias" : "profesores";
  if (detail[1] === "profesores" && profesorDetailBack(origin) === origin && /^\/home\/admin\/comisiones\//.test(origin)) {
    return experienciasListReturnTo(new URL(origin, "https://local.invalid").searchParams.get("returnTo")) ? "experiencias" : "materias";
  }
  return detail[1] === "comisiones" ? "materias" : "profesores";
}

interface CommissionNavigationRecord {
  id: string; nombre: string;
  cursada: { id: string; anio: number; cuatrimestre?: "PRIMERO" | "SEGUNDO" | "ANUAL" | null; materia: { id: string; nombre: string } };
}

export function comisionNavigation(raw: string | null | undefined, comision: CommissionNavigationRecord | null) {
  const experience = experienciasListReturnTo(raw);
  if (!comision) return {
    back: experience ?? "/home/admin/comisiones", materiaHref: "/home/admin/materias", courseHref: "/home/admin/cursadas", detailHref: "/home/admin/comisiones",
    breadcrumb: [{ label: "Administración", href: "/home/admin" }, { label: experience ? "Experiencias" : "Materias", href: experience ?? "/home/admin/materias" }, { label: "Comisión" }] as BreadcrumbItem[],
  };
  const academic = academicListReturnTo(raw, "comisiones", comision.cursada.materia.id, comision.cursada.id);
  const origin = academic ? safeMateriaListOrigin(new URL(academic, "https://local.invalid").searchParams.get("materiaReturnTo")) ?? "/home/admin/materias" : "/home/admin/materias";
  const materiaHref = materiaDetailHref(comision.cursada.materia.id, origin);
  const fallbackCourses = adminListHref({ seccion: "cursadas", materiaId: comision.cursada.materia.id, materiaReturnTo: origin, returnTo: materiaHref, page: 1 });
  const parent = academic ? new URL(academic, "https://local.invalid").searchParams.get("returnTo") : null;
  const courses = cursadaListOrigin(parent, comision.cursada.id, comision.cursada.materia.id) ?? fallbackCourses;
  const courseHref = cursadaDetailHref(comision.cursada.id, courses);
  const commissions = academic ?? adminListHref({ seccion: "comisiones", materiaId: comision.cursada.materia.id, cursadaId: comision.cursada.id, materiaReturnTo: origin, returnTo: courseHref, page: 1 });
  const back = experience ?? commissions;
  const breadcrumb: BreadcrumbItem[] = [{ label: "Administración", href: "/home/admin" }, ...(experience
    ? [{ label: "Experiencias", href: experience }]
    : [{ label: "Materias", href: origin }, { label: comision.cursada.materia.nombre, href: materiaHref }, { label: "Cursadas", href: courses }, { label: `Cursada ${periodoLabel(comision.cursada.anio, comision.cursada.cuatrimestre)}`, href: courseHref }, { label: "Comisiones", href: commissions }]), { label: `Comisión ${comision.nombre}` }];
  return { back, breadcrumb, materiaHref, courseHref, detailHref: administrativeDetailHref("comisiones", comision.id, back) };
}

export function academicListReturnTo(raw: string | null | undefined, section: "cursadas" | "comisiones", materiaId: string, cursadaId?: string): string | undefined {
  const safe = safeAdminReturnTo(raw);
  if (!safe) return undefined;
  const url = new URL(safe, "https://local.invalid");
  if (url.pathname !== `/home/admin/${section}` || url.searchParams.get("materiaId") !== materiaId) return undefined;
  if (section === "comisiones" && url.searchParams.get("cursadaId") !== cursadaId) return undefined;
  if (section === "cursadas" && url.searchParams.has("cursadaId")) return undefined;
  const parent = url.searchParams.get("returnTo");
  if (parent) {
    if (section === "cursadas") {
      const detail = materiaDetailReturnTo(parent, materiaId);
      if (!detail) return undefined;
      const detailUrl = new URL(detail, "https://local.invalid");
      const listOrigin = safeMateriaListOrigin(url.searchParams.get("materiaReturnTo")) ?? "/home/admin/materias";
      const detailOrigin = safeMateriaListOrigin(detailUrl.searchParams.get("returnTo")) ?? "/home/admin/materias";
      if (detailOrigin !== listOrigin) return undefined;
    }
    if (section === "comisiones" && (!cursadaId || !cursadaDetailReturnTo(parent, cursadaId, materiaId))) return undefined;
  }
  return safe;
}

export function cursadaListOrigin(raw: string | null | undefined, cursadaId: string, materiaId: string): string | undefined {
  const safe = safeAdminReturnTo(raw);
  if (!safe) return undefined;
  const detail = new URL(safe, "https://local.invalid");
  if (detail.pathname !== `/home/admin/cursadas/${cursadaId}`) return undefined;
  const list = detail.searchParams.get("returnTo");
  return academicListReturnTo(list, "cursadas", materiaId);
}

export function cursadaDetailReturnTo(raw: string | null | undefined, cursadaId: string, materiaId: string): string | undefined {
  return cursadaListOrigin(raw, cursadaId, materiaId) ? safeAdminReturnTo(raw) : undefined;
}

export function materiaDetailReturnTo(raw: string | null | undefined, materiaId: string): string | undefined {
  const safe = safeAdminReturnTo(raw);
  if (!safe || new URL(safe, "https://local.invalid").pathname !== `/home/admin/materias/${materiaId}`) return undefined;
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
  const origin = safeAdminReturnTo(returnTo);
  return `/home/admin/cursadas/${encodeURIComponent(cursadaId)}${origin ? `?${new URLSearchParams({ returnTo: origin })}` : ""}`;
}

export function comisionDetailHref(comisionId: string, returnTo: string) {
  const origin = safeAdminReturnTo(returnTo);
  return `/home/admin/comisiones/${encodeURIComponent(comisionId)}${origin ? `?${new URLSearchParams({ returnTo: origin })}` : ""}`;
}
