import { HttpError } from "@/services/http";
import type { ReporteMotivo } from "@/types/feedback-reportes";

export const reporteMotivos: ReadonlyArray<{ value: ReporteMotivo; label: string }> = [
  { value: "INSULTOS_ACOSO", label: "Insultos o acoso" },
  { value: "AMENAZAS_INTIMIDACION", label: "Amenazas o intimidación" },
  { value: "DISCRIMINACION", label: "Discriminación" },
  { value: "DATOS_PERSONALES", label: "Información personal" },
  { value: "SPAM", label: "Spam" },
  { value: "OTRO", label: "Otro" },
];
function validarMotivo(value: string, required: boolean) {
  const clean = value.trim();
  if (!clean) return required ? "Escribí una justificación para continuar." : "";
  if ([...clean].length > 1000) return "El texto admite hasta 1000 caracteres.";
  if ([...value].some(character => { const code = character.codePointAt(0)!; return code < 32 || (code >= 127 && code <= 159); })) return "Revisá el texto: contiene caracteres no permitidos.";
  return "";
}
export const validarMotivoModeracion = (value: string) => validarMotivo(value, true);
export const validarDescripcionReporte = (value: string) => validarMotivo(value, false);
/** Explanations are prose; infrastructure payloads must never become notices. */
export function explicacionModeracion(value: unknown, fallback = "El equipo administrativo solicitó revisar el contenido. Corregí el comentario antes de solicitar una nueva revisión.") {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const text = value.trim();
  if (/^[{[]/.test(text) || /(?:PrismaClient|\bat\s+\S+\.(?:ts|js):|Bearer\s+|passwordHash|accessToken|refreshToken|sessionId)/i.test(text)) return fallback;
  return text;
}
// Exact known domain responses only: never concatenate an arbitrary server body into UI.
const conflictosConocidos = new Map([
  ["Corrija el contenido rechazado antes de solicitar una nueva revisión.", "Guardá una corrección real del texto rechazado antes de solicitar una nueva revisión."],
  ["Ya reportó esta versión con otros datos. Consulte el reporte existente.", "Ya reportaste esta versión con otros datos. El reporte anterior se conserva; no hace falta enviarlo nuevamente."],
  ["El reporte ya fue cerrado. Actualice la información.", "El reporte ya fue cerrado. Actualizá la información para consultar su resolución."],
  ["Resuelva los reportes abiertos antes de restituir la visibilidad preventiva.", "Resolvé o desestimá los reportes necesarios hasta que haya menos de dos denunciantes distintos con reportes abiertos. Luego podrás restituir el ocultamiento preventivo."],
]);
export function mensajeErrorModeracion(error: unknown, fallback = "Lo sentimos. No pudimos completar la solicitud, intentá nuevamente.") {
  if (!(error instanceof HttpError)) return fallback;
  switch (error.status) {
    case 401: return "Tu sesión finalizó. Iniciá sesión nuevamente para continuar.";
    case 403: return "No tenés permiso para realizar esta acción. Volvé al listado y revisá las opciones disponibles.";
    case 404: return "La experiencia o el reporte ya no está disponible. Volvé al listado para actualizar la información.";
    case 409: return conflictosConocidos.get(error.message) ?? "La información cambió o la acción ya fue realizada. Revisá los datos actualizados antes de volver a intentar.";
    case 429: return "Alcanzaste el límite de reportes. Esperá diez minutos antes de volver a intentarlo.";
    case 400: case 422: return "No pudimos procesar los datos. Revisá los campos del formulario e intentá nuevamente.";
    default: return fallback;
  }
}
