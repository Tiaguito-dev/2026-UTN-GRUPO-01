"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { safeReturnPath } from "@/validations/auth";

export function RequireGuest({ children, preserveReturn = false }: { children: ReactNode; preserveReturn?: boolean }) {
  const { status, error, checkSession } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === "authenticated") {
      const destination = preserveReturn ? safeReturnPath(new URL(window.location.href).searchParams.get("returnTo")) : "/home";
      router.replace(destination);
    }
  }, [status, router, preserveReturn]);
  if (status === "checking" || status === "authenticated") return <p role="status">Comprobando sesión…</p>;
  if (status === "temporary-error") {
    if (preserveReturn) return <><p role="status" className="notice warning">No pudimos confirmar el estado de tu sesión. Si elegís iniciar sesión nuevamente, el servidor comprobará tus credenciales.</p>{children}</>;
    return <section className="auth-card" aria-label="Problema temporal de sesión"><p role="alert">{error ?? "No pudimos comprobar tu sesión. Intentá nuevamente."}</p><button type="button" onClick={() => { void checkSession(); }}>Reintentar comprobación</button><p><Link href="/login">Volver a iniciar sesión</Link></p></section>;
  }
  return children;
}
