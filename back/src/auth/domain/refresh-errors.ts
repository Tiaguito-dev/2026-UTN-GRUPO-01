export class InvalidRefreshCredentialError extends Error {
  constructor() { super("La credencial de renovación no es válida. Iniciá sesión nuevamente."); this.name = "InvalidRefreshCredentialError"; }
}
