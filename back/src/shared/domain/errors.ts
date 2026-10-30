import { DomainError } from "./domain-error.js";

export class InvalidPaginationError extends DomainError {
  readonly httpStatus = 400;
  constructor() { super("Los parámetros de paginación no son válidos."); this.name = "InvalidPaginationError"; }
}
