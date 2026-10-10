import { validateAccountEmail } from "./registration-input.js";
import { InvalidLoginInputError } from "./auth-errors.js";
import { InvalidRegistrationInputError } from "./errors.js";

export function validateLoginInput(input: unknown): { email: string; password: string } {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new InvalidLoginInputError("Los datos de inicio de sesión deben ser un objeto.");
  }
  const values = input as Record<string, unknown>;
  if (Object.keys(values).some((field) => !["email", "password"].includes(field))) {
    throw new InvalidLoginInputError("La petición contiene campos no permitidos.");
  }
  if (typeof values.email !== "string" || typeof values.password !== "string") {
    throw new InvalidLoginInputError("Email y contraseña son obligatorios.");
  }
  const passwordLength = Array.from(values.password).length;
  if (passwordLength === 0 || passwordLength > 128) {
    throw new InvalidLoginInputError("La contraseña debe contener entre 1 y 128 caracteres.");
  }
  try {
    return { email: validateAccountEmail(values.email), password: values.password };
  } catch (error) {
    if (error instanceof InvalidRegistrationInputError) throw new InvalidLoginInputError(error.message);
    throw error;
  }
}
