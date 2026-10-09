"use client";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { safeReturnPath } from "@/validations/auth";
import { COORDINATION_NOTICE } from "@/services/session-coordinator";
import type { Role } from "@/types/auth";

export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { status, account, error, checkSession, coordinationAvailable } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?returnTo=${encodeURIComponent(safeReturnPath(pathname))}`);
  }, [status, router, pathname]);
  if (status === "checking") return <p role="status">Comprobando sesión…</p>;
  if (status === "anonymous") return <p role="status">Necesitás <Link href="/login">iniciar sesión</Link> para continuar.</p>;
  if (status === "temporary-error") return <section aria-label="Problema temporal de sesión">
    <p role="alert">{error ?? "No pudimos comprobar tu sesión. Intentá nuevamente."}</p>
    {!coordinationAvailable && <p>{COORDINATION_NOTICE}</p>}
    <button type="button" onClick={() => { void checkSession(); }}>Reintentar comprobación</button>
    <p><Link href="/login">Volver a iniciar sesión</Link></p>
  </section>;
  if (roles && account && !roles.includes(account.role)) return <section><h2>Acceso no permitido</h2><p role="alert">Tu cuenta no tiene permisos para esta operación.</p><Link href="/account">Volver a mi cuenta</Link></section>;
  return <>{!coordinationAvailable && <p role="status">{COORDINATION_NOTICE}</p>}{children}</>;
}
