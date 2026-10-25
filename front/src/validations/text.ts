// Rangos de control C0 (0-31) y C1 + DEL (127-159). Se comprueba por punto de código, igual que
// `academic-text.ts` del backend, para no depender de escapes en un literal de expresión regular.
export function hasControlCharacters(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 32 || (code >= 127 && code <= 159)) return true;
  }
  return false;
}
