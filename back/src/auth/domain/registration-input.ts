import { normalizeEmail } from "../../users/domain/email.js";
import { InvalidRegistrationInputError } from "./errors.js";
import { isValidNewPassword, PASSWORD_POLICY_MESSAGE } from "./password-policy.js";
import { terminosCondiciones, TERMS_ACCEPTANCE_REQUIRED, TERMS_VERSION_CHANGED } from "./terms.js";

export interface RegistrationInput {
  email: string;
  displayName: string;
  password: string;
}

// eslint-disable-next-line no-control-regex -- rechaza caracteres de control deliberadamente, no es un error de tipeo
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const EMAIL_FORMAT = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function validateAccountEmail(value: string): string {
  const email = normalizeEmail(value);
  if (CONTROL_CHARACTERS.test(value) || email.length > 254 || email.split("@")[0]!.length > 64 || !EMAIL_FORMAT.test(email)) {
    throw new InvalidRegistrationInputError("Ingresá un email válido de hasta 254 caracteres.");
  }
  return email;
}

/** Validación de credenciales compartida con la provisión administrativa, que no es consentimiento. */
export function validateAccountCreationInput(input: unknown): RegistrationInput {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new InvalidRegistrationInputError("Los datos de registro deben ser un objeto.");
  }
  const values = input as Record<string, unknown>;
  const fields = ["email", "displayName", "password"];
  if (Object.keys(values).some((key) => !fields.includes(key))) {
    throw new InvalidRegistrationInputError("La petición contiene campos no permitidos.");
  }
  if (typeof values.email !== "string" || typeof values.displayName !== "string" || typeof values.password !== "string") {
    throw new InvalidRegistrationInputError("Email, nombre visible y contraseña son obligatorios.");
  }
  const email = validateAccountEmail(values.email);
  const displayName = values.displayName.trim();
  const nameLength = Array.from(displayName).length;
  if (CONTROL_CHARACTERS.test(values.displayName) || nameLength < 1 || nameLength > 100) {
    throw new InvalidRegistrationInputError("El nombre visible debe tener entre 1 y 100 caracteres y no contener controles.");
  }
  if (!isValidNewPassword(values.password)) {
    throw new InvalidRegistrationInputError(PASSWORD_POLICY_MESSAGE);
  }
  return { email, displayName, password: values.password };
}

export interface PublicRegistrationInput extends RegistrationInput {
  aceptaTerminos: true;
  versionTerminos: string;
}

export function validateRegistrationInput(input: unknown): PublicRegistrationInput {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new InvalidRegistrationInputError("Los datos de registro deben ser un objeto.");
  }
  const values = input as Record<string, unknown>;
  const fields = ["email", "displayName", "password", "aceptaTerminos", "versionTerminos"];
  if (Object.keys(values).some((key) => !fields.includes(key))) {
    throw new InvalidRegistrationInputError("La petición contiene campos no permitidos.");
  }
  if (values.aceptaTerminos !== true) throw new InvalidRegistrationInputError(TERMS_ACCEPTANCE_REQUIRED);
  if (values.versionTerminos !== terminosCondiciones.version) throw new InvalidRegistrationInputError(TERMS_VERSION_CHANGED);
  const account = validateAccountCreationInput({ email: values.email, displayName: values.displayName, password: values.password });
  return { ...account, aceptaTerminos: true, versionTerminos: terminosCondiciones.version };
}
