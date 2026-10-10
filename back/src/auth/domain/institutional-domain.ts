import { InvalidRegistrationInputError } from "./errors.js";

export const INSTITUTIONAL_EMAIL_DOMAIN = "alu.frlp.utn.edu.ar";

/**
 * Exclusive to RegisterUser (public self-registration): the email format is already
 * validated and normalized by validateAccountEmail, so it contains exactly one "@".
 * login-input.ts, password-input.ts and ProvisionAdmin must NOT call this.
 */
export function validateInstitutionalEmailDomain(email: string): void {
  const domain = email.split("@")[1];
  if (domain !== INSTITUTIONAL_EMAIL_DOMAIN) {
    throw new InvalidRegistrationInputError("Usá tu email institucional de alumno (@alu.frlp.utn.edu.ar) para registrarte.");
  }
}
