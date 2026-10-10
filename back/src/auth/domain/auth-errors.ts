import { DomainError } from "../../shared/domain/domain-error.js";

export class InvalidLoginInputError extends DomainError {
  readonly httpStatus = 400;
  constructor(message: string) { super(message); this.name = "InvalidLoginInputError"; }
}

export class InvalidCredentialsError extends DomainError {
  readonly httpStatus = 401;
  constructor() { super("Email o contraseña incorrectos. Intentá nuevamente."); this.name = "InvalidCredentialsError"; }
}

export class InvalidAccessTokenError extends Error {
  constructor() { super("La credencial no es válida."); this.name = "InvalidAccessTokenError"; }
}

export class UnauthenticatedError extends Error {
  constructor() { super("Iniciá sesión nuevamente para continuar."); this.name = "UnauthenticatedError"; }
}
