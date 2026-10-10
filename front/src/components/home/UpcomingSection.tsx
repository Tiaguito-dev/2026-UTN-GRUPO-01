"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
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
    <div className="system-empty">
      <span className="empty-symbol" aria-hidden="true">{section.symbol}</span>
      <span className="upcoming-badge">Próximamente</span>
      <h2>Estamos preparando esta sección</h2>
      <p>{section.detail}</p>
      <p>Cuando esté disponible, encontrarás aquí la información y las opciones para participar.</p>
      <Link className="button button-secondary" href="/home">Volver al inicio</Link>
    </div>
  </>;
}
