// Rangos de control C0 (0-31) y C1 + DEL (127-159). Se comprueba por punto de código, igual que
// `academic-text.ts` del backend, para no depender de escapes en un literal de expresión regular.
function hasControlCharacters(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 32 || (code >= 127 && code <= 159)) return true;
  }
  return false;
}

/** Espeja `nombreSchema` del backend: se recorta, no puede quedar vacío, sin caracteres de
 *  control, y se mide en puntos de código igual que el VarChar de Postgres. */
export function validateNombre(value: string, max: number): string | undefined {
  if (hasControlCharacters(value)) return "No puede contener caracteres de control.";
  const length = Array.from(value.trim()).length;
  if (length < 1) return "Completá este campo.";
  if (length > max) return `Usá hasta ${max} caracteres.`;
}

export const ANIO_MINIMO = 2000;
/** Decisión 4 de TASK-019: hasta el año siguiente, para no bloquear la planificación del período que viene. */
export function anioMaximo(): number { return new Date().getFullYear() + 1; }

export function validateAnio(value: string): string | undefined {
  const texto = value.trim();
  const anio = Number(texto);
  if (!/^[0-9]+$/u.test(texto) || anio < ANIO_MINIMO || anio > anioMaximo()) {
    return `El año debe ser un número entero entre ${ANIO_MINIMO} y ${anioMaximo()}.`;
  }
}

export function validateSeleccion(value: string): string | undefined {
  if (!value) return "Elegí una opción de la lista.";
}
