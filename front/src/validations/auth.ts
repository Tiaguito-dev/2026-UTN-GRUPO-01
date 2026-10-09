const CONTROLS = /[\u0000-\u001f\u007f-\u009f]/u;
const EMAIL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
export const PASSWORD_POLICY_MESSAGE = "La contraseña debe tener entre 8 y 128 caracteres.";
export function validateEmail(value: string): string | undefined {
  const email = value.trim().toLowerCase();
  if (CONTROLS.test(value) || email.length > 254 || email.split("@")[0].length > 64 || !EMAIL.test(email)) return "Ingresá un email válido de hasta 254 caracteres.";
}
export function validateNewPassword(value: string): string | undefined {
  const length = Array.from(value).length;
  if (length < 8 || length > 128) return PASSWORD_POLICY_MESSAGE;
}
export function validateDisplayName(value: string): string | undefined {
  const length = Array.from(value.trim()).length;
  if (length < 1 || length > 100 || CONTROLS.test(value)) return "El nombre visible debe tener entre 1 y 100 caracteres y no contener controles.";
}
export function validateCurrentPassword(value: string): string | undefined {
  const length = Array.from(value).length;
  if (length < 1 || length > 128) return "La contraseña actual debe contener entre 1 y 128 caracteres.";
}
export function safeReturnPath(value: string | null | undefined): string {
  return value === "/home" || value === "/account" || value === "/account/change-password" ? value : "/home";
}
