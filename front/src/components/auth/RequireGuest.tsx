"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { safeReturnPath } from "@/validations/auth";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { SESSION_CHECK_FAILED } from "@/lib/messages";

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
    if (preserveReturn) return <><Notice tone="warning">No pudimos confirmar el estado de tu sesión. Si elegís iniciar sesión nuevamente, el servidor comprobará tus credenciales.</Notice>{children}</>;
    return <Card variant="auth" as="section" aria-label="Problema temporal de sesión"><p role="alert">{error ?? SESSION_CHECK_FAILED}</p><button className="button" type="button" onClick={() => { void checkSession(); }}>Reintentar comprobación</button><p><Link href="/login">Volver a iniciar sesión</Link></p></Card>;
  }
  return children;
}
