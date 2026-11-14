"use client";
import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { Notice } from "@/components/ui/Notice";
import { activarLikeFeedback, retirarLikeFeedback } from "@/services/feedback-feed";
import { HttpError } from "@/services/http";
import type { FeedbackFeedItem } from "@/types/feedback-feed";
import { FeedbackRespuestas } from "./FeedbackRespuestas";
import styles from "./FeedPrincipal.module.css";
export function FeedbackInteracciones({ feedback, children }: { feedback: FeedbackFeedItem; children?: ReactNode }) {
  const id = useId(); const [like, setLike] = useState({ meGusta: feedback.meGusta, cantidadLikes: feedback.cantidadLikes }); const [count, setCount] = useState(feedback.cantidadRespuestas);
  const [open, setOpen] = useState(false); const [visited, setVisited] = useState(false); const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const pending = useRef(false); const intent = useRef<boolean | null>(null);
  const onUnavailable = useCallback(() => setUnavailable(true), []); const onCount = useCallback((value: number) => setCount(value), []);
  async function submitLike(retry = false) {
    if (pending.current || feedback.propio || unavailable) return;
    const active = retry && intent.current !== null ? intent.current : !like.meGusta;
    intent.current = active; pending.current = true; setBusy(true); setError("");
    try { setLike(await (active ? activarLikeFeedback(feedback.id) : retirarLikeFeedback(feedback.id))); intent.current = null; }
    catch (failure) { if (failure instanceof HttpError && failure.status === 404) onUnavailable(); setError(failure instanceof Error ? failure.message : "No pudimos actualizar Me gusta."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className={styles.interactions}>
    {unavailable ? <Notice tone="error">Este comentario ya no está disponible.</Notice> : children}
    {!unavailable ? <div className={styles.counts}><span>{like.cantidadLikes} Me gusta</span>
      {!feedback.propio ? <button className="button button-secondary" type="button" disabled={busy} aria-pressed={like.meGusta} onClick={() => void submitLike()}>{like.meGusta ? "Quitar Me gusta" : "Dar Me gusta"}</button> : null}
      <button className="button button-secondary" type="button" aria-controls={id} aria-expanded={open} aria-label={`${open ? "Ocultar" : "Ver"} respuestas (${count})`} onClick={() => { setVisited(true); setOpen(value => !value); }}>{count} {count === 1 ? "respuesta" : "respuestas"}</button>
    </div> : null}
    {error && !unavailable ? <Notice tone="error">{error} <button className="button button-secondary" type="button" disabled={busy} onClick={() => void submitLike(true)}>Reintentar Me gusta</button></Notice> : null}
    {visited ? <div id={id} hidden={!open}><FeedbackRespuestas feedbackId={feedback.id} onCount={onCount} onUnavailable={onUnavailable} unavailable={unavailable} /></div> : null}
  </div>;
}
