import { DomainError } from "../../shared/domain/domain-error.js";

export class NormasNoDisponiblesError extends DomainError {
  readonly httpStatus = 404;
  constructor() {
    super("Las normas de convivencia no están disponibles.");
    this.name = "NormasNoDisponiblesError";
  }
}
