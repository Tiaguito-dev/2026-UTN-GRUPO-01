import { DomainError } from "../../shared/domain/domain-error.js";

export class MateriaNotFoundError extends DomainError {
  readonly httpStatus = 404;
  constructor() { super("La materia solicitada no existe."); this.name = "MateriaNotFoundError"; }
}

export class ProfesorNotFoundError extends DomainError {
  readonly httpStatus = 404;
  constructor() { super("El profesor solicitado no existe."); this.name = "ProfesorNotFoundError"; }
}

export class CursadaNotFoundError extends DomainError {
  readonly httpStatus = 404;
  constructor() { super("La cursada solicitada no existe."); this.name = "CursadaNotFoundError"; }
}

export class InvalidIdError extends DomainError {
  readonly httpStatus = 400;
  constructor() { super("El identificador no es válido."); this.name = "InvalidIdError"; }
}

export class InvalidAcademicInputError extends DomainError {
  readonly httpStatus = 400;
  constructor(message: string) { super(message); this.name = "InvalidAcademicInputError"; }
}

/** Mensaje único para cuerpos con campos de más: no se señala ningún campo concreto del formulario. */
export const CAMPOS_NO_PERMITIDOS = "La petición contiene campos no permitidos.";

export class MateriaAlreadyExistsError extends DomainError {
  readonly httpStatus = 409;
  constructor() { super("Ya existe una materia con ese nombre."); this.name = "MateriaAlreadyExistsError"; }
}

export class CursadaAlreadyExistsError extends DomainError {
  readonly httpStatus = 409;
  constructor() { super("Ya existe una cursada de esa materia para ese año y cuatrimestre."); this.name = "CursadaAlreadyExistsError"; }
}

export class ComisionAlreadyExistsError extends DomainError {
  readonly httpStatus = 409;
  constructor() { super("Ya existe una comisión con ese nombre en esa cursada."); this.name = "ComisionAlreadyExistsError"; }
}
