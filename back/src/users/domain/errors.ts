export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("El email ya está registrado.");
    this.name = "EmailAlreadyRegisteredError";
  }
}
