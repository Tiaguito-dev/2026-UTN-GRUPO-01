export class InvalidPasswordInputError extends Error {
  constructor(message: string) { super(message); this.name = "InvalidPasswordInputError"; }
}

export class InvalidPasswordResetTokenError extends Error {
  constructor() { super("El token de recuperación es inválido o ya no está disponible."); this.name = "InvalidPasswordResetTokenError"; }
}

export class InvalidPasswordChangeError extends Error {
  constructor() { super("No pudimos cambiar la contraseña. Revisá la contraseña actual y elegí una nueva diferente."); this.name = "InvalidPasswordChangeError"; }
}
