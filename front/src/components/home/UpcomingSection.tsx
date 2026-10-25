"use client";

import Link from "next/link";
import { useId } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { findSection } from "./sections";

/** Pantalla compartida de las secciones todavía no implementadas (Profesores, Experiencias,
 *  Comunidad). No llama a ningún endpoint ni muestra datos inventados. */
export function UpcomingSection({ id }: { id: string }) {
  const section = findSection(id);
  const headingId = useId();

  // El eyebrow queda fuera de la sección: `.system-content > .eyebrow` le da su margen.
  return <>
    <p className="eyebrow">Lo que estamos construyendo</p>
    <section aria-labelledby={headingId}>
      <PageHeader id={headingId} title={section.title} description={section.description} focusKey={id} />
      <EmptyState symbol={section.symbol} badge="Próximamente" title="Estamos preparando esta sección" action={<Link className="button button-secondary" href="/home">Volver al inicio</Link>}>
        <p>{section.detail}</p>
        <p>Cuando esté disponible, encontrarás aquí la información y las opciones para participar.</p>
      </EmptyState>
    </section>
  </>;
}
