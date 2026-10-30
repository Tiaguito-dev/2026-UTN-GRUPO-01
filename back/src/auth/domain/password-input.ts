import { InvalidPasswordInputError } from "./password-errors.js";
import { isValidNewPassword, PASSWORD_POLICY_MESSAGE } from "./password-policy.js";
import { validateAccountEmail } from "./registration-input.js";
import { InvalidRegistrationInputError } from "./errors.js";

function fields(input: unknown, allowed: string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new InvalidPasswordInputError("Los datos deben ser un objeto.");
  const values = input as Record<string, unknown>;
  if (Object.keys(values).some((key) => !allowed.includes(key))) throw new InvalidPasswordInputError("La petición contiene campos no permitidos.");
  return values;
}

export function validateForgotPasswordInput(input: unknown): { email: string } {
  const values = fields(input, ["email"]);
  if (typeof values.email !== "string") throw new InvalidPasswordInputError("El email es obligatorio.");
  try { return { email: validateAccountEmail(values.email) }; }
  catch (error) {
    if (error instanceof InvalidRegistrationInputError) throw new InvalidPasswordInputError(error.message);
    throw error;
  }
}

export function validateResetPasswordInput(input: unknown): { token: string; newPassword: string } {
  const values = fields(input, ["token", "newPassword"]);
  if (typeof values.token !== "string") throw new InvalidPasswordInputError("El token de recuperación es obligatorio.");
  if (!isValidNewPassword(values.newPassword)) throw new InvalidPasswordInputError(PASSWORD_POLICY_MESSAGE);
  return { token: values.token, newPassword: values.newPassword };
}

export function validateChangePasswordInput(input: unknown): { currentPassword: string; newPassword: string } {
  const values = fields(input, ["currentPassword", "newPassword"]);
  if (typeof values.currentPassword !== "string" || Array.from(values.currentPassword).length < 1 || Array.from(values.currentPassword).length > 128) {
    throw new InvalidPasswordInputError("La contraseña actual debe contener entre 1 y 128 caracteres.");
  }
  if (!isValidNewPassword(values.newPassword)) throw new InvalidPasswordInputError(PASSWORD_POLICY_MESSAGE);
  return { currentPassword: values.currentPassword, newPassword: values.newPassword };
}
