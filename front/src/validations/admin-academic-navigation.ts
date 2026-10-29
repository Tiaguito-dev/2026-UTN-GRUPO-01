import { adminListHref, safeAdminReturnTo, safeMateriaListOrigin } from "./admin";

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
  return path === "/home/admin/materias" || path === "/home/admin/experiencias" ? safe : undefined;
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
