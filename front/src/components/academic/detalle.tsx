/** Pieces shared by the academic detail screens (TASK-043). */

export function Chevron() {
  return <svg className="academic-chevron" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>;
}

export function PlusIcon() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;
}

/** "Laura Giménez" → "LG"; the avatar is decorative, the name is always next to it. */
export function iniciales(nombre: string): string {
  return nombre.split(/\s+/u).filter(Boolean).slice(0, 2).map((parte) => parte.charAt(0).toUpperCase()).join("");
}
