import { DomainError } from "../../shared/domain/domain-error.js";
export class EmailNotVerifiedError extends DomainError {
  readonly httpStatus = 403;
  constructor() { super("Verificá tu correo institucional antes de iniciar sesión."); }
}
export class InvalidEmailVerificationTokenError extends DomainError {
  readonly httpStatus = 400;
  constructor() { super("El enlace de verificación es inválido o ya no está disponible."); }
}
export class VerificationDeliveryError extends DomainError {
  readonly httpStatus = 503;
  constructor() { super("La cuenta quedó pendiente, pero no pudimos enviar el correo. Solicitá un nuevo enlace de verificación."); }
}
export interface EmailVerificationCredential {
  id: string; userId: string; tokenHash: string; createdAt: Date; expiresAt: Date;
  consumedAt: Date | null; invalidatedAt: Date | null; deliveredAt: Date | null;
}
export const EMAIL_VERIFICATION_REPOSITORY = Symbol("EMAIL_VERIFICATION_REPOSITORY");
export interface EmailVerificationRepository {
  issue(credential: EmailVerificationCredential): Promise<boolean>;
  invalidate(id: string, now: Date): Promise<void>;
  markDelivered(id: string, now: Date): Promise<void>;
  verify(hash: string, now: Date): Promise<boolean>;
}
export const VERIFICATION_EMAIL = Symbol("VERIFICATION_EMAIL");
export interface VerificationEmail {
  send(message: { email: string; token: string; expiresAt: Date }): Promise<void>;
}
