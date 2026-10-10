import { DomainError } from "../../shared/domain/domain-error.js";

export class InvalidPasswordInputError extends DomainError {
  readonly httpStatus = 400;
  constructor(message: string) { super(message); this.name = "InvalidPasswordInputError"; }
}

export class InvalidPasswordResetTokenError extends DomainError {
  readonly httpStatus = 400;
  constructor() { super("El token de recuperación es inválido o ya no está disponible."); this.name = "InvalidPasswordResetTokenError"; }
}

export class InvalidPasswordChangeError extends DomainError {
  readonly httpStatus = 400;
  constructor() { super("No pudimos cambiar la contraseña. Revisá la contraseña actual y elegí una nueva diferente."); this.name = "InvalidPasswordChangeError"; }
}
