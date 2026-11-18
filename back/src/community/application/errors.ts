import { DomainError } from "../../shared/domain/domain-error.js";

export class NormasNoDisponiblesError extends DomainError {
  readonly httpStatus = 404;
  constructor() {
    super("Las normas de convivencia no están disponibles.");
    this.name = "NormasNoDisponiblesError";
  }
}

export class NormasInvalidasError extends DomainError {
  readonly httpStatus = 400;
  constructor(message: string) {
    super(message);
    this.name = "NormasInvalidasError";
  }
}

export class SugerenciaInvalidaError extends DomainError {
  readonly httpStatus = 400;
  constructor(message: string) {
    super(message);
    this.name = "SugerenciaInvalidaError";
  }
}

export class SugerenciaSolicitudReutilizadaError extends DomainError {
  readonly httpStatus = 409;
  constructor() {
    super("La solicitud ya fue utilizada para otra sugerencia. Iniciá una nueva sugerencia para enviar otro contenido.");
    this.name = "SugerenciaSolicitudReutilizadaError";
  }
}
