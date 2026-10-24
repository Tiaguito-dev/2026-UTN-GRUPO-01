"use client";
import Link from "next/link";
import { useEffect, useId, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { safeReturnPath } from "@/validations/auth";
import { COORDINATION_NOTICE } from "@/services/session-coordinator";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { SESSION_CHECK_FAILED } from "@/lib/messages";

/** Full screen for a session check that failed temporarily. Shared with `RequireGuest`. */
export function SessionCheckFailed({ children }: { children?: ReactNode }) {
  const { error, checkSession } = useAuth();
  const headingId = useId();
  return <section aria-label="Problema temporal de sesión">
    <PageHeader id={headingId} title="No pudimos comprobar tu sesión" />
    <Notice tone="error">{error ?? SESSION_CHECK_FAILED}</Notice>
    {children}
    <div className="actions">
      <button className="button" type="button" onClick={() => { void checkSession(); }}>Reintentar comprobación</button>
      <Link className="button button-secondary" href="/login">Volver a iniciar sesión</Link>
    </div>
  </section>;
}

/** Session guard only. Role checks live in `RequireRole`, so the coordination notice shows once. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, coordinationAvailable } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?returnTo=${encodeURIComponent(safeReturnPath(pathname))}`);
  }, [status, router, pathname]);
  if (status === "checking") return <p role="status">Comprobando sesión…</p>;
  if (status === "anonymous") return <p role="status">Necesitás <Link href="/login">iniciar sesión</Link> para continuar.</p>;
  if (status === "temporary-error") return <SessionCheckFailed>{!coordinationAvailable && <Notice tone="warning">{COORDINATION_NOTICE}</Notice>}</SessionCheckFailed>;
  return <>{!coordinationAvailable && <p role="status">{COORDINATION_NOTICE}</p>}{children}</>;
}
