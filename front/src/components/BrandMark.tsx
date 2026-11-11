/** Cuchilla sobre un libro abierto. El texto de la marca aporta el nombre accesible. */
export function BrandMark() {
  return <svg width="36" height="36" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
    <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <g transform="rotate(-32 32 23)">
        <path d="M9 15h28v19H15a6 6 0 0 1-6-6V15Z" fill="currentColor" stroke="none" />
        <circle cx="14" cy="20" r="1.6" fill="var(--primary)" stroke="none" />
        <path d="M38 16h13a3.5 3.5 0 0 1 0 7H38v-7Z" />
        <circle cx="46" cy="19.5" r="1" fill="currentColor" stroke="none" />
      </g>
      <path d="M32 45c-6-5-15-6-25-5v15c10-1 19 0 25 5 6-5 15-6 25-5V40c-10-1-19 0-25 5Z" />
      <path d="M32 45v15M13 46c5 0 9 1 13 3m12 0c4-2 8-3 13-3" />
    </g>
  </svg>;
}
