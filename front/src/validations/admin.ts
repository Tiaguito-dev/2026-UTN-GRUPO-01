export const ADMIN_SECTIONS = ["materias", "profesores", "cursadas", "comisiones", "usuarios"] as const;
export type AdminSection = typeof ADMIN_SECTIONS[number];
export interface AdminContext { seccion: AdminSection; page: number; materiaId?: string; cursadaId?: string }
export function adminListHref(context: AdminContext): string {
  const query = new URLSearchParams();
  if ((context.seccion === "cursadas" || context.seccion === "comisiones") && context.materiaId) query.set("materiaId", context.materiaId);
  if (context.seccion === "comisiones" && context.materiaId && context.cursadaId) query.set("cursadaId", context.cursadaId);
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
    const allowed = seccion === "comisiones" ? ["page", "materiaId", "cursadaId"] : seccion === "cursadas" ? ["page", "materiaId"] : ["page"];
    for (const key of url.searchParams.keys()) if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) return undefined;
    const page = Number(url.searchParams.get("page") ?? 1);
    if (!Number.isSafeInteger(page) || page < 1) return undefined;
    return adminListHref({ seccion, page, materiaId: url.searchParams.get("materiaId") ?? undefined, cursadaId: url.searchParams.get("cursadaId") ?? undefined });
  } catch { return undefined; }
}
export function adminFormHref(path: string, returnTo: string): string { return `${path}?${new URLSearchParams({ returnTo: safeAdminReturnTo(returnTo) ?? "/home/admin/materias" })}`; }
export function adminSuccessHref(path: string, message: string): string {
  const url = new URL(path, "https://local.invalid"); url.searchParams.set("successMessage", message);
  return `${url.pathname}?${url.searchParams}`;
}
