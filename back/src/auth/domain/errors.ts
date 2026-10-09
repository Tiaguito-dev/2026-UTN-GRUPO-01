export class InvalidRegistrationInputError extends Error {
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
