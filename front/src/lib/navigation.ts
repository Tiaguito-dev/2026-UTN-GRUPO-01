import type { Role } from "@/types/auth";

export function roleHome(role?: Role): string {
  return role === "ADMIN" ? "/home/admin" : "/home";
}

/** Only internal application paths; reject ambiguous encodings before URL normalization. */
export function internalDestination(raw: string | null | undefined): string | undefined {
  if (!raw || !/^\/(home|account)(\/|\?|$)/.test(raw) || /[\\#\u0000-\u001f\u007f]/.test(raw)) return;
  try {
    const path = raw.split("?")[0]!;
    for (const segment of path.split("/")) {
      const decoded = decodeURIComponent(segment);
      if (decoded === "." || decoded === ".." || /[/%\\#\u0000-\u001f\u007f]/.test(decoded)) return;
    }
    const url = new URL(raw, "https://local.invalid");
    if (url.origin !== "https://local.invalid" || url.pathname !== path) return;
    return raw;
  } catch { return; }
}

export function adminReturnTo(raw: string | null | undefined, fallback = "/home/admin"): string {
  const safe = internalDestination(raw);
  return safe && /^\/home\/admin(\/|\?|$)/.test(safe) ? safe : fallback;
}

/** The same translation serves login, direct navigation and resource links. */
export function roleDestination(role: Role | undefined, raw?: string | null): string {
  const safe = internalDestination(raw);
  if (!safe) return roleHome(role);
  if (role !== "ADMIN") return safe;
  const url = new URL(safe, "https://local.invalid");
  const path = url.pathname;
  if (/^\/home\/admin(\/|$)/.test(path) || /^\/account(\/|$)/.test(path)) return safe;
  const commission = path.match(/^\/home\/materias\/[^/]+\/cursadas\/[^/]+\/comisiones\/([^/]+)$/);
  const course = path.match(/^\/home\/materias\/[^/]+\/cursadas\/([^/]+)$/);
  const subject = path.match(/^\/home\/materias\/([^/]+)$/);
  const professor = path.match(/^\/home\/profesores\/([^/]+)$/);
  const target = commission ? `/home/admin/comisiones/${commission[1]}`
    : course ? `/home/admin/cursadas/${course[1]}`
    : subject ? `/home/admin/materias/${subject[1]}`
    : professor ? `/home/admin/profesores/${professor[1]}`
    : path === "/home/materias" ? "/home/admin/materias"
    : path === "/home/profesores" ? "/home/admin/profesores"
    : path === "/home/experiencias" ? "/home/admin/experiencias" : undefined;
  if (!target) {
    const commissionId = url.searchParams.get("comisionId");
    if (path === "/home/feedback/nuevo" && commissionId && /^[a-zA-Z0-9_-]+$/.test(commissionId)) return `/home/admin/comisiones/${encodeURIComponent(commissionId)}`;
    return /^\/home\/feedback(\/|$)/.test(path) ? "/home/admin/experiencias" : roleHome(role);
  }
  if ((commission || course || subject || professor) && url.searchParams.get("origen") === "experiencias") {
    const origin = new URLSearchParams();
    for (const [source, key] of [["experienciasCarrera", "carrera"], ["experienciasMateriaId", "materiaId"], ["experienciasPage", "page"]] as const) {
      const value = url.searchParams.get(source);
      if (value) origin.set(key, value);
    }
    url.searchParams.set("returnTo", `/home/admin/experiencias${origin.size ? `?${origin}` : ""}`);
  }
  return `${target}${url.search}`;
}
