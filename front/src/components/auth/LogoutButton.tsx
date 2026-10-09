"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export function LogoutButton({ className = "button-secondary", onSuccess }: { className?: string; onSuccess?: () => void }) {
  const auth = useAuth();
  const router = useRouter();
  const submitting = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  async function logout() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError("");
    try { await auth.logout(); onSuccess?.(); router.replace("/login?notice=logout"); }
    catch { setError("No pudimos confirmar el cierre de sesión. Intentá nuevamente."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <div className="logout-control"><button type="button" className={className} onClick={() => { void logout(); }} aria-disabled={busy} aria-busy={busy}>{busy ? "Cerrando sesión…" : "Cerrar sesión"}</button>{error ? <p ref={errorRef} tabIndex={-1} role="alert" className="notice error">{error}</p> : null}</div>;
}
