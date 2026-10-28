import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="back-link" href={href} aria-label={`Volver a ${label}`}>
      <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" />
      Volver
    </Link>
  );
}
