"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { findSection } from "./sections";

/** Pantalla compartida de las secciones todavía no implementadas (Profesores, Experiencias,
 *  Comunidad). No llama a ningún endpoint ni muestra datos inventados. */
export function UpcomingSection({ id }: { id: string }) {
  const section = findSection(id);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, [id]);

  return <>
    <p className="eyebrow">Lo que estamos construyendo</p>
    <h1 id="system-heading" tabIndex={-1} ref={headingRef}>{section.title}</h1>
    <p className="system-description">{section.description}</p>
    <EmptyState symbol={section.symbol} badge="Próximamente" title="Estamos preparando esta sección" action={<Link className="button button-secondary" href="/home">Volver al inicio</Link>}>
      <p>{section.detail}</p>
      <p>Cuando esté disponible, encontrarás aquí la información y las opciones para participar.</p>
    </EmptyState>
  </>;
}
