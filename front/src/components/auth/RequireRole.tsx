"use client";
import Link from "next/link";
import { useId, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Role } from "@/types/auth";

/** Role check only: it goes inside `RequireAuth` (via `AppShell`), which owns the session check and the coordination notice. */
export function RequireRole({ children, roles }: { children: ReactNode; roles: Role[] }) {
  const { account } = useAuth();
  const headingId = useId();
  if (account && roles.includes(account.role)) return children;
  return <section aria-labelledby={headingId}>
    <PageHeader id={headingId} title="Acceso no permitido" />
    <EmptyState action={<Link href="/home">Volver al inicio</Link>}>Tu cuenta no tiene permisos para esta operación.</EmptyState>
  </section>;
}
