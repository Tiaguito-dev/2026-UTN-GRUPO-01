import type { Feedback } from "@/types/feedback";
import { Notice } from "@/components/ui/Notice";
import { explicacionModeracion } from "@/validations/feedback-moderation";

/** Only safe metadata returned by the author's endpoint. Never infer publication from approval alone. */
export function FeedbackModerationStatus({ feedback }: { feedback: Feedback }) {
  if (!feedback.estadoModeracion) return null;
  const hidden = feedback.ocultoAutor || feedback.ocultoAdministracion || feedback.ocultoReportes;
  return <div>
    {feedback.estadoModeracion === "PENDIENTE" ? <Notice tone="warning">Tu comentario está pendiente de revisión por el equipo administrativo</Notice>
      : feedback.estadoModeracion === "RECHAZADO" ? <Notice tone="warning"><strong>Rechazada.</strong> {explicacionModeracion(feedback.motivoRechazo)}<p>Podés corregir el contenido y solicitar una nueva revisión. Guardar cambios no publica la experiencia.</p></Notice>
      : <p><strong>{hidden ? "Aprobada, actualmente oculta" : "Publicada"}</strong></p>}
    {hidden ? <ul aria-label="Causas de ocultamiento">
      {feedback.ocultoAutor ? <li>Oculta por el autor.</li> : null}
      {feedback.ocultoAdministracion ? <li>Oculta por administración.</li> : null}
      {feedback.ocultoReportes ? <li>Oculta preventivamente por reportes.</li> : null}
    </ul> : null}
  </div>;
}
