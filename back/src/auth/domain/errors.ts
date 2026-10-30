import { DomainError } from "../../shared/domain/domain-error.js";

export class InvalidRegistrationInputError extends DomainError {
  readonly httpStatus = 400;
  constructor(message: string) {
    super(message);
    this.name = "InvalidRegistrationInputError";
  }
}

export class AdminProvisionConflictError extends Error {
  constructor() {
    super("El email pertenece a una cuenta USER. La provisión administrativa fue cancelada.");
    this.name = "AdminProvisionConflictError";
  }
}
