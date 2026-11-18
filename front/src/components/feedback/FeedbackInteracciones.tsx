"use client";
import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { Heart, MessageCircle } from "lucide-react";
import { Notice } from "@/components/ui/Notice";
import { activarLikeFeedback, retirarLikeFeedback } from "@/services/feedback-feed";
import { HttpError } from "@/services/http";
import { mensajeErrorModeracion } from "@/validations/feedback-moderation";
import type { FeedbackFeedItem } from "@/types/feedback-feed";
import { FeedbackRespuestas } from "./FeedbackRespuestas";
import styles from "./FeedPrincipal.module.css";
export function FeedbackInteracciones({ feedback, children, renderCard }: { feedback: FeedbackFeedItem; children?: ReactNode; renderCard?: (actions: ReactNode) => ReactNode }) {
  const id = useId(); const [like, setLike] = useState({ meGusta: feedback.meGusta, cantidadLikes: feedback.cantidadLikes }); const [count, setCount] = useState(feedback.cantidadRespuestas);
  const [open, setOpen] = useState(false); const [visited, setVisited] = useState(false); const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const pending = useRef(false); const intent = useRef<boolean | null>(null);
  const onUnavailable = useCallback(() => setUnavailable(true), []); const onCount = useCallback((value: number) => setCount(value), []);
  async function submitLike(retry = false) {
    if (pending.current || feedback.propio || unavailable) return;
    const active = retry && intent.current !== null ? intent.current : !like.meGusta;
    intent.current = active; pending.current = true; setBusy(true); setError("");
    try { setLike(await (active ? activarLikeFeedback(feedback.id) : retirarLikeFeedback(feedback.id))); intent.current = null; }
    catch (failure) { if (failure instanceof HttpError && failure.status === 404) onUnavailable(); setError(mensajeErrorModeracion(failure, "No pudimos actualizar Me gusta. Intentá nuevamente.")); }
    finally { pending.current = false; setBusy(false); }
  }
  const actions = <>
    {renderCard ? feedback.propio ? <span className={styles.likeCount}><Heart size={16} aria-hidden="true" />{like.cantidadLikes} Me gusta</span> : <button className="button button-secondary" type="button" disabled={busy} aria-label={like.meGusta ? "Quitar Me gusta" : "Dar Me gusta"} aria-pressed={like.meGusta} onClick={() => void submitLike()}><Heart size={16} aria-hidden="true" fill={like.meGusta ? "currentColor" : "none"} />{like.cantidadLikes} Me gusta</button> : <><span>{like.cantidadLikes} Me gusta</span>{!feedback.propio ? <button className="button button-secondary" type="button" disabled={busy} aria-pressed={like.meGusta} onClick={() => void submitLike()}>{like.meGusta ? "Quitar Me gusta" : "Dar Me gusta"}</button> : null}</>}
    <button className="button button-secondary" type="button" aria-controls={visited ? id : undefined} aria-expanded={open} aria-label={`${open ? "Ocultar" : "Ver"} respuestas (${count})`} onClick={() => { setVisited(true); setOpen(value => !value); }}>{renderCard ? <MessageCircle size={16} aria-hidden="true" /> : null}{count} {count === 1 ? "respuesta" : "respuestas"}</button>
  </>;
  return <div className={styles.interactions}>
    {unavailable ? <Notice tone="error">Este comentario ya no está disponible.</Notice> : renderCard ? renderCard(actions) : children}
    {!unavailable && !renderCard ? <div className={styles.counts}>{actions}</div> : null}
    {error && !unavailable ? <Notice tone="error">{error} <button className="button button-secondary" type="button" disabled={busy} onClick={() => void submitLike(true)}>Reintentar Me gusta</button></Notice> : null}
    {visited ? <div id={id} hidden={!open}><FeedbackRespuestas feedbackId={feedback.id} onCount={onCount} onUnavailable={onUnavailable} unavailable={unavailable} /></div> : null}
  </div>;
}
