"use client";

import { useId } from "react";
import { useAuth } from "@/hooks/useAuth";
import { FeedPrincipal } from "@/components/feedback/FeedPrincipal";
import { PageHeader } from "@/components/ui/PageHeader";
import { findSection } from "./sections";

/** Contenido de /home. El sidebar y el guard viven en app/home/layout.tsx, no acá. */
export function InicioSection() {
  const { account } = useAuth();
  const section = findSection("inicio");
  const headingId = useId();

  // El eyebrow queda fuera de la sección: `.system-content > .eyebrow` le da su margen.
  return <>
    <p className="eyebrow">Professors&apos; butchery</p>
    <section aria-labelledby={headingId}>
      <PageHeader id={headingId} title={<>Hola, {account?.displayName ?? "bienvenido"}.</>} description={section.description} />
      <FeedPrincipal />
      <p className="system-footnote">Cada experiencia conserva su materia, comisión y período para ayudarte a interpretar su contexto.</p>
    </section>
  </>;
}
