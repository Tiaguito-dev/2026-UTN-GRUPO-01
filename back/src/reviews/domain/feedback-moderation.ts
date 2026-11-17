import { DomainError } from "../../shared/domain/domain-error.js";
import type { UserRole } from "../../users/domain/user.js";

export type FeedbackModerationStatus = "PENDIENTE" | "APROBADO" | "RECHAZADO";
export interface FeedbackModerationState {
  estadoModeracion: FeedbackModerationStatus;
  versionModeracion: number;
  requiereRevisionHumana: boolean;
  motivoRechazo: string | null;
  ocultoAutor: boolean;
  ocultoAdministracion: boolean;
  ocultoReportes: boolean;
}
export interface FeedbackModerationRecord extends FeedbackModerationState {
  autorId: string;
  deletedAt: Date | null;
}
export interface FeedbackModerationActor { id: string; role: UserRole }
export type FeedbackModerationAction = "APROBACION" | "RECHAZO" | "OCULTAMIENTO_AUTOR" |
  "RESTITUCION_AUTOR" | "OCULTAMIENTO_ADMIN" | "RESTITUCION_ADMIN" | "SOLICITUD_REVISION";
export interface FeedbackModerationCommand {
  accion: FeedbackModerationAction;
  versionEsperada: number;
  motivo?: string;
}
export interface FeedbackModerationTransition {
  state: FeedbackModerationState;
  changed: boolean;
  motivo: string | null;
}

export class FeedbackModerationError extends DomainError {
  constructor(readonly httpStatus: 400 | 403 | 404 | 409, message: string) { super(message); }
}

const actions = new Set<string>(["APROBACION", "RECHAZO", "OCULTAMIENTO_AUTOR", "RESTITUCION_AUTOR",
  "OCULTAMIENTO_ADMIN", "RESTITUCION_ADMIN", "SOLICITUD_REVISION"]);
const ownerActions = new Set<FeedbackModerationAction>(["OCULTAMIENTO_AUTOR", "RESTITUCION_AUTOR", "SOLICITUD_REVISION"]);
const maxVersion = 2_147_483_647;

function conflict(message: string): never { throw new FeedbackModerationError(409, message); }
function normalizeReason(value: unknown, required: boolean): string | null {
  if (value === undefined && !required) return null;
  if (typeof value !== "string" || [...value].some(character => {
    const point = character.codePointAt(0)!;
    return point < 32 || (point >= 127 && point <= 159);
  })) {
    throw new FeedbackModerationError(400, "Indique un motivo válido para la decisión.");
  }
  const reason = value.trim();
  if ([...reason].length < 1 || [...reason].length > 1000) {
    throw new FeedbackModerationError(400, "El motivo debe tener entre 1 y 1000 caracteres.");
  }
  return reason;
}

/** Pure decision: persistence supplies the current locked version and evidence of correction. */
export function transitionFeedbackModeration(
  record: FeedbackModerationRecord,
  actor: FeedbackModerationActor,
  command: FeedbackModerationCommand,
  contenidoCorregido = false,
): FeedbackModerationTransition {
  if (record.deletedAt) throw new FeedbackModerationError(404, "El comentario solicitado no existe.");
  if (!command || !actions.has(command.accion) || !Number.isInteger(command.versionEsperada) ||
      command.versionEsperada < 1 || command.versionEsperada > maxVersion) {
    throw new FeedbackModerationError(400, "Revise la acción y la versión del comentario.");
  }
  const isOwnerAction = ownerActions.has(command.accion);
  if (!actor || !actor.id || (actor.role !== "USER" && actor.role !== "ADMIN") ||
      (isOwnerAction ? record.autorId !== actor.id : actor.role !== "ADMIN") ||
      (command.accion === "APROBACION" && record.autorId === actor.id)) {
    throw new FeedbackModerationError(403, "No tiene permiso para realizar esta acción sobre el comentario.");
  }
  if (record.versionModeracion !== command.versionEsperada) {
    conflict("El comentario cambió. Actualice la información antes de decidir nuevamente.");
  }
  const motivo = normalizeReason(command.motivo, !isOwnerAction);
  const state: FeedbackModerationState = {
    estadoModeracion: record.estadoModeracion, versionModeracion: record.versionModeracion,
    requiereRevisionHumana: record.requiereRevisionHumana, motivoRechazo: record.motivoRechazo,
    ocultoAutor: record.ocultoAutor, ocultoAdministracion: record.ocultoAdministracion,
    ocultoReportes: record.ocultoReportes,
  };
  switch (command.accion) {
    case "APROBACION":
      if (state.estadoModeracion !== "PENDIENTE") conflict("Solo puede aprobar una experiencia pendiente de revisión.");
      state.estadoModeracion = "APROBADO";
      state.motivoRechazo = null;
      break;
    case "RECHAZO":
      if (state.estadoModeracion !== "PENDIENTE" && state.estadoModeracion !== "APROBADO") {
        conflict("La experiencia ya fue rechazada. Su autor debe corregirla y solicitar revisión.");
      }
      state.estadoModeracion = "RECHAZADO";
      state.requiereRevisionHumana = true;
      state.motivoRechazo = motivo;
      break;
    case "SOLICITUD_REVISION":
      if (state.estadoModeracion !== "RECHAZADO" || !contenidoCorregido) {
        conflict("Corrija el contenido rechazado antes de solicitar una nueva revisión.");
      }
      state.estadoModeracion = "PENDIENTE";
      state.requiereRevisionHumana = true;
      break;
    case "OCULTAMIENTO_AUTOR":
    case "RESTITUCION_AUTOR":
      if (state.estadoModeracion !== "APROBADO") conflict("Esta acción requiere una experiencia aprobada.");
      // Lifting the author's cause never removes administrative or preventive restrictions.
      state.ocultoAutor = command.accion === "OCULTAMIENTO_AUTOR";
      break;
    case "OCULTAMIENTO_ADMIN":
      if (state.estadoModeracion !== "APROBADO") conflict("Solo puede ocultar administrativamente una experiencia aprobada.");
      state.ocultoAdministracion = true;
      break;
    case "RESTITUCION_ADMIN":
      // Lifting this cause never grants approval or lifts another actor's cause.
      state.ocultoAdministracion = false;
      break;
  }
  const changed = state.estadoModeracion !== record.estadoModeracion ||
    state.requiereRevisionHumana !== record.requiereRevisionHumana || state.motivoRechazo !== record.motivoRechazo ||
    state.ocultoAutor !== record.ocultoAutor || state.ocultoAdministracion !== record.ocultoAdministracion ||
    state.ocultoReportes !== record.ocultoReportes;
  if (changed) {
    if (record.versionModeracion >= maxVersion) conflict("Se alcanzó el límite de versiones de esta experiencia.");
    state.versionModeracion++;
  }
  return { state, changed, motivo };
}
