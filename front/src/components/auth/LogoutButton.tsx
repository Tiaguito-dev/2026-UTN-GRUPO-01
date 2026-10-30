"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Notice } from "@/components/ui/Notice";
import { LOGOUT_UNCONFIRMED } from "@/lib/messages";

export function LogoutButton({ className = "button button-secondary", onSuccess }: { className?: string; onSuccess?: () => void }) {
  const auth = useAuth();
  const router = useRouter();
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError("");
    try { await auth.logout(); onSuccess?.(); router.replace("/login?notice=logout"); }
    catch { setError(LOGOUT_UNCONFIRMED); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <div className="logout-control"><button className={className} type="button" onClick={() => { void logout(); }} aria-disabled={busy} aria-busy={busy}>{busy ? "Cerrando sesión…" : "Cerrar sesión"}</button>{error ? <Notice tone="error" focusOnShow>{error}</Notice> : null}</div>;
}
