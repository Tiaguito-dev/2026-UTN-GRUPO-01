import type { Feedback } from "@/types/feedback";
import { Notice } from "@/components/ui/Notice";
import { explicacionModeracion } from "@/validations/feedback-moderation";
import { CheckCircle2, Clock3, EyeOff, ShieldCheck, XCircle } from "lucide-react";
import styles from "./ExperienciasPresentation.module.css";

/** Only safe metadata returned by the author's endpoint. Never infer publication from approval alone. */
export function FeedbackModerationStatus({ feedback, variant = "detail" }: { feedback: Feedback; variant?: "compact" | "detail" | "own" }) {
  if (!feedback.estadoModeracion) return null;
  const hidden = feedback.ocultoAutor || feedback.ocultoAdministracion || feedback.ocultoReportes;
  const rejected = feedback.estadoModeracion === "RECHAZADO";
  return <div className={styles.moderation} role="group" aria-label="Estado de tu experiencia">
    <ul className={styles.badges} aria-label="Estado y causas de ocultamiento">
      {feedback.estadoModeracion === "APROBADO" && !hidden ? <li className={`${styles.badge} ${styles.published}`}><CheckCircle2 size={16} aria-hidden="true" />{variant === "own" ? "Visible para la comunidad" : "Publicada"}</li> : null}
      {feedback.estadoModeracion === "PENDIENTE" ? <li className={`${styles.badge} ${styles.warning}`}><Clock3 size={16} aria-hidden="true" />Pendiente de revisión</li> : null}
      {rejected ? <li className={`${styles.badge} ${styles.rejected}`}><XCircle size={16} aria-hidden="true" />Rechazada</li> : null}
      {feedback.ocultoReportes ? <li className={`${styles.badge} ${styles.warning}`}><EyeOff size={16} aria-hidden="true" />{variant === "own" ? "Oculta preventivamente por reportes" : "Oculta por reportes"}</li> : null}
      {feedback.ocultoAdministracion ? <li className={styles.badge}><ShieldCheck size={16} aria-hidden="true" />Oculta por administración</li> : null}
      {feedback.ocultoAutor ? <li className={styles.badge}><EyeOff size={16} aria-hidden="true" />{variant === "own" ? "Oculta por tu decisión" : "Oculta voluntariamente"}</li> : null}
    </ul>
    {variant === "own" && feedback.ocultoAdministracion ? <p>Existe una restricción administrativa. Podés consultar tu experiencia en privado; solo el equipo administrativo puede levantarla.</p> : null}
    {rejected ? <Notice tone="warning"><p>{explicacionModeracion(feedback.motivoRechazo)}</p><p>Podés corregir el contenido y solicitar una nueva revisión. Guardar cambios no publica la experiencia.</p></Notice> : null}
    {feedback.ocultoReportes ? <Notice tone="warning">
      <div className={styles.reviewTitle}><ShieldCheck size={20} aria-hidden="true" /><strong>{variant !== "detail" ? "Pendiente de revisión administrativa" : "Tu comentario está pendiente de revisión"}</strong></div>
      {variant !== "detail" ? <><p>Tu experiencia está oculta temporalmente para la comunidad porque recibió reportes. El equipo administrativo debe revisar el caso y decidir si corresponde restituirla o rechazarla.</p><p>Podés seguir consultando tu experiencia.</p></>
        : <><p>Recibimos reportes sobre esta experiencia y fue retirada temporalmente de la vista pública mientras el equipo administrativo evalúa el contenido.</p><p>{feedback.estadoModeracion === "APROBADO" ? "El comentario no fue rechazado. " : ""}Podés seguir consultándolo y administrándolo, pero su restitución pública depende de la resolución del equipo.</p></>}
    </Notice> : feedback.estadoModeracion === "PENDIENTE" ? <Notice tone="warning">Tu comentario está pendiente de revisión por el equipo administrativo.</Notice> : null}
  </div>;
}
