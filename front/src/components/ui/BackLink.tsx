import Link from "next/link";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="back-link" href={href} aria-label={`Volver a ${label}`}>
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      Volver
    </Link>
  );
}
