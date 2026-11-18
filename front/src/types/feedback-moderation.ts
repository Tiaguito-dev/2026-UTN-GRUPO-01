export type EstadoModeracion = "PENDIENTE" | "APROBADO" | "RECHAZADO";
export interface EstadoModeracionFeedback {
  estadoModeracion: EstadoModeracion;
  versionModeracion: number;
  requiereRevisionHumana: boolean;
  motivoRechazo: string | null;
  ocultoAutor: boolean;
  ocultoAdministracion: boolean;
  ocultoReportes: boolean;
}
export type AccionModeracionAdmin = "APROBACION" | "RECHAZO" | "OCULTAMIENTO_ADMIN" | "RESTITUCION_ADMIN" | "RESTITUCION_REPORTES";
export type AccionModeracion = AccionModeracionAdmin | "OCULTAMIENTO_AUTOR" | "RESTITUCION_AUTOR" | "SOLICITUD_REVISION" | "OCULTAMIENTO_REPORTES";
export interface ComandoModeracion { accion: AccionModeracionAdmin; versionEsperada: number; motivo: string }
