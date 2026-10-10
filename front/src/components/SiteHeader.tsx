"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { LogoutButton } from "@/components/auth/LogoutButton";

export function SiteHeader() {
  const { status } = useAuth();
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [open]);

  function close() { setOpen(false); }
  return <header className={`site-header${status === "authenticated" ? " site-header-auth" : ""}`}>
    <Link href={status === "authenticated" ? "/home" : "/"} className="brand"><span className="brand-mark" aria-hidden="true">PB</span><span>Profesor Butchery</span></Link>
    {status === "authenticated" ? <nav aria-label="Navegación principal">
      <div className="account-menu" ref={containerRef} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}>
        <button ref={triggerRef} className="account-menu-trigger" type="button" aria-label="Opciones de cuenta" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></svg>
        </button>
        {open ? <div id={panelId} className="account-menu-panel">
          {status === "authenticated" ? <><Link href="/account" onClick={close}>Mi perfil</Link><Link href="/account/change-password" onClick={close}>Cambiar contraseña</Link><LogoutButton onSuccess={close} className="account-menu-action" /></> : null}
        </div> : null}
      </div>
    </nav> : null}
  </header>;
}
