"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getSessionService } from "@/services/session";
import type { SessionEndReason } from "@/types/session";
import { Notice } from "@/components/ui/Notice";
import { SessionIdleController, type SessionIdleView } from "./session-idle-controller";
import styles from "./SessionIdleMonitor.module.css";

export function SessionIdleMonitor({ accountId, onExpire }: { accountId: string; onExpire: (reason: SessionEndReason) => void }) {
  const [view, setView] = useState<SessionIdleView>({ status: null, now: 0, pending: null, error: "", success: "", blocked: true });
  const controller = useRef<SessionIdleController | null>(null);
  useEffect(() => {
    const current = new SessionIdleController(accountId, getSessionService(), setView, onExpire);
    controller.current = current;
    const stop = current.start();
    return () => { stop(); controller.current = null; };
  }, [accountId, onExpire]);
  const warning = view.status && view.now >= Date.parse(view.status.warningAt);
  if (view.blocked || warning || (!view.status && view.error)) return <SessionWarningDialog view={view}
    onRenew={() => { void controller.current?.renew(); }} onClose={() => { void controller.current?.close(); }}
    onRetry={() => { void controller.current?.check(); }} />;
  return view.error || view.success ? <div className={styles.feedback}>
    {view.error ? <Notice tone="warning">{view.error} <button className="button button-secondary" type="button" onClick={() => { void controller.current?.check(); }}>Reintentar comprobación</button></Notice> : null}
    {view.success ? <Notice tone="success">{view.success}</Notice> : null}
  </div> : null;
}

function SessionWarningDialog({ view, onRenew, onClose, onRetry }: {
  view: SessionIdleView; onRenew: () => void; onClose: () => void; onRetry: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const mounted = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const absolute = view.status ? Date.parse(view.status.absoluteExpiresAt) <= Date.parse(view.status.idleExpiresAt) : false;
  const seconds = view.status ? Math.max(0, Math.ceil((Math.min(Date.parse(view.status.idleExpiresAt), Date.parse(view.status.absoluteExpiresAt)) - view.now) / 1000)) : 0;
  const pending = view.pending === "renew" || view.pending === "close" || view.pending === "expire";
  const title = view.blocked ? "Comprobando tu sesión" : absolute ? "Tu sesión está por vencer" : "¿Querés continuar con tu sesión?";
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    mounted.current = true;
    const opener = document.activeElement;
    if (!node.open) node.showModal();
    return () => { mounted.current = false; if (node.open) node.close(); if (opener instanceof HTMLElement && opener.isConnected) opener.focus(); };
  }, []);
  return <dialog ref={dialog} className={`${styles.dialog}${view.blocked ? ` ${styles.blocked}` : ""}`} aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={(event) => event.preventDefault()} onClose={() => { if (mounted.current && dialog.current && !dialog.current.open) dialog.current.showModal(); }}>
    <h2 id={titleId}>{title}</h2>
    <p id={descriptionId}>{view.blocked ? "Estamos verificando si la sesión sigue vigente. Esperá un momento o volvé a comprobarla."
      : absolute ? "La sesión está llegando a su duración máxima. Para continuar, necesitás iniciar sesión nuevamente."
      : "Hace un tiempo que no registramos actividad. Confirmá que querés continuar para conservar tu sesión."}</p>
    {view.status && !view.blocked ? <p className={styles.countdown}>La sesión se cerrará en <strong>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</strong>.</p> : null}
    {view.error ? <Notice tone="error" focusOnShow>{view.error}</Notice> : null}
    {view.blocked && pending ? <p role="status">Comprobando sesión…</p> : null}
    <div className={styles.actions}>
      <button className="button button-secondary" type="button" disabled={pending} onClick={onClose}>{absolute ? "Volver a iniciar sesión" : "Cerrar sesión"}</button>
      {!view.status || view.blocked ? <button className="button" type="button" disabled={pending || view.pending === "check"} onClick={onRetry}>Reintentar comprobación</button>
        : !absolute ? <button className="button" type="button" disabled={pending || !seconds} aria-busy={view.pending === "renew"} onClick={onRenew}>{view.pending === "renew" ? "Renovando…" : "Renovar sesión"}</button> : null}
    </div>
  </dialog>;
}
