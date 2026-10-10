import { DomainError } from "../../shared/domain/domain-error.js";

export class InvalidRefreshCredentialError extends DomainError {
  readonly httpStatus = 401;
  constructor() { super("La credencial de renovación no es válida. Iniciá sesión nuevamente."); this.name = "InvalidRefreshCredentialError"; }
}
