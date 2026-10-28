"use client";
import { useRef, useState, type ReactNode } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Notice } from "@/components/ui/Notice";

/** Se monta por operación: confirmar nunca se ejecuta al abrir ni se repite mientras está pendiente. */
export function AdminConfirmDialog({ title, children, confirmLabel, onConfirm, onClose }: { title: string; children: ReactNode; confirmLabel: string; onConfirm: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const pending = useRef(false);
  async function confirm() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { await onConfirm(); }
    catch (failure) { setError(`Lo sentimos. No pudimos completar la operación. ${failure instanceof Error ? failure.message : "Intentá nuevamente."}`); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Dialog open onClose={onClose} title={title} busy={busy}>
    {children}{error ? <Notice tone="error" focusOnShow>{error}</Notice> : null}
    <div className="dialog-actions"><button className="button button-secondary" type="button" disabled={busy} onClick={onClose} data-autofocus>Cancelar</button><button className="button" type="button" disabled={busy} aria-busy={busy} onClick={() => void confirm()}>{busy ? "Procesando…" : confirmLabel}</button></div>
  </Dialog>;
}
