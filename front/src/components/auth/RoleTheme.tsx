import type { ReactNode } from "react";
import type { AuthStatus, Role } from "@/types/auth";

/** Presentación derivada de la sesión confirmada; no concede acceso ni persiste preferencias. */
export function RoleTheme({ status, role, children }: { status: AuthStatus; role?: Role; children: ReactNode }) {
  const theme = status === "authenticated"
    ? role === "ADMIN" ? "admin" : role === "USER" ? "student" : "pending"
    : status === "anonymous" ? "public" : "pending";
  return <div className="role-theme" data-role-theme={theme}>{children}</div>;
}
