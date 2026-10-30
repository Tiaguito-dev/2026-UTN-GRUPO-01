import { DomainError } from "../../shared/domain/domain-error.js";

export class EmailAlreadyRegisteredError extends DomainError {
  readonly httpStatus = 409;
  constructor() {
    super("El email ya está registrado.");
    this.name = "EmailAlreadyRegisteredError";
  }
}

export class InvalidUserAdministrationInputError extends DomainError {
  readonly httpStatus = 400;
  constructor(message = "Revise los filtros o el estado de la cuenta e intente nuevamente.") { super(message); }
}
export class UserNotFoundError extends DomainError {
  readonly httpStatus = 404;
  constructor() { super("No encontramos la cuenta. Actualice el listado e intente nuevamente."); }
}
export class UserStateConflictError extends DomainError {
  readonly httpStatus = 409;
  constructor(message: string) { super(message); }
}
export class UserAdministrationForbiddenError extends DomainError {
  readonly httpStatus = 403;
  constructor() { super("No tiene permisos para modificar esta cuenta. Inicie sesión con una cuenta administradora activa."); }
}
