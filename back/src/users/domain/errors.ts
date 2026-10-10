import { DomainError } from "../../shared/domain/domain-error.js";

export class EmailAlreadyRegisteredError extends DomainError {
  readonly httpStatus = 409;
  constructor() {
    super("El email ya está registrado.");
    this.name = "EmailAlreadyRegisteredError";
  }
}
