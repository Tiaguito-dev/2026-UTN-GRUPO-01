export const PASSWORD_POLICY_MESSAGE = "La contraseña debe tener entre 8 y 128 caracteres.";

export function isValidNewPassword(value: unknown): value is string {
  return typeof value === "string" && Array.from(value).length >= 8 && Array.from(value).length <= 128;
}
