import { z } from "zod";

// Rangos de control C0 (0-31) y C1 + DEL (127-159). Se comprueba por punto de código en vez de
// con un literal de expresión regular con escapes, que es más fácil de romper al editarlo.
function hasControlCharacters(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 32 || (code >= 127 && code <= 159)) return true;
  }
  return false;
}

/**
 * Nombre visible de una entidad académica: se recorta, no puede quedar vacío, no admite
 * caracteres de control y se mide en puntos de código (igual que el VarChar de Postgres).
 */
export function nombreSchema(maxLength: number) {
  return z
    .string()
    .refine((value) => !hasControlCharacters(value))
    .transform((value) => value.trim())
    .refine((value) => value.length > 0 && Array.from(value).length <= maxLength);
}
