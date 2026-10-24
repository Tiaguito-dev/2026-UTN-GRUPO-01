"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ROLE_LABEL } from "@/lib/format/role";
import { LogoutButton } from "./LogoutButton";

export function AccountPanel() {
  const { account } = useAuth();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  if (!account) return null;
  const initials = account.displayName.trim().split(/\s+/u).slice(0, 2).map((part) => Array.from(part)[0]).join("").toLocaleUpperCase("es");
  return <section aria-labelledby="account-heading">
    <h1 ref={headingRef} tabIndex={-1} id="account-heading">Mi perfil</h1>
    <p className="account-intro">Tu información de cuenta y las opciones para administrar tu acceso.</p>
    <Card variant="profile">
      <div className="profile-identity"><span className="profile-avatar" aria-hidden="true">{initials}</span><div><h2>{account.displayName}</h2><Badge tone="role">{ROLE_LABEL[account.role]}</Badge></div></div>
      <dl className="profile-details"><div><dt>Nombre visible</dt><dd>{account.displayName}</dd></div><div><dt>Email</dt><dd>{account.email}</dd></div><div><dt>Tipo de cuenta</dt><dd>{ROLE_LABEL[account.role]}</dd></div></dl>
    </Card>
    <section className="profile-options" aria-labelledby="profile-options-heading"><h2 id="profile-options-heading">Opciones de cuenta</h2><p>Actualizá tu contraseña o cerrá la sesión de este navegador.</p><div className="profile-actions"><Link className="button button-secondary" href="/account/change-password">Cambiar contraseña</Link><LogoutButton /></div></section>
  </section>;
}
