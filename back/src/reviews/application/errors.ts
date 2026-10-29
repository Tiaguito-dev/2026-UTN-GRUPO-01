import { DomainError } from "../../shared/domain/domain-error.js";

export class FeedbackInputError extends DomainError {
  readonly httpStatus = 400;
  constructor(message = "Revise los datos del comentario e intente nuevamente.") { super(message); }
}
export class FeedbackNotFoundError extends DomainError {
  readonly httpStatus = 404;
  constructor() { super("El comentario solicitado no existe."); }
}
export class FeedbackForbiddenError extends DomainError {
  readonly httpStatus = 403;
  constructor() { super("Solo puede modificar o consultar el historial de sus propios comentarios."); }
}
export class FeedbackDuplicateError extends DomainError {
  readonly httpStatus = 409;
  constructor() { super("Ya publicó un comentario en esta comisión. Puede editarlo o eliminarlo antes de volver a publicar."); }
}
export class FeedbackClosedError extends DomainError {
  readonly httpStatus = 409;
  constructor() { super("La comisión no está activa. Puede consultar los comentarios o retirar el suyo."); }
}
