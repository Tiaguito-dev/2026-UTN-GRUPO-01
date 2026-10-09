export class InvalidLoginInputError extends Error {
  constructor(message: string) { super(message); this.name = "InvalidLoginInputError"; }
}

export class InvalidCredentialsError extends Error {
  constructor() { super("Email o contraseña incorrectos. Intentá nuevamente."); this.name = "InvalidCredentialsError"; }
}

export class InvalidAccessTokenError extends Error {
  constructor() { super("La credencial no es válida."); this.name = "InvalidAccessTokenError"; }
}

export class UnauthenticatedError extends Error {
  constructor() { super("Iniciá sesión nuevamente para continuar."); this.name = "UnauthenticatedError"; }
}
