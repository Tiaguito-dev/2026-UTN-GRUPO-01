"use client";

import Link from "next/link";
import { useId } from "react";
import { useAuth } from "@/hooks/useAuth";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { findSection } from "./sections";

/** Contenido de /home. El sidebar y el guard viven en app/home/layout.tsx, no acá. */
export function InicioSection() {
  const { account } = useAuth();
  const section = findSection("inicio");
  const headingId = useId();

  // El eyebrow queda fuera de la sección: `.system-content > .eyebrow` le da su margen.
  return <>
    <p className="eyebrow">Profesor Butchery</p>
    <section aria-labelledby={headingId}>
      <PageHeader id={headingId} title={<>Hola, {account?.displayName ?? "bienvenido"}.</>} description={section.description} />
      <EmptyState symbol="PB" title="Este espacio está empezando a tomar forma" action={<Link className="button" href="/account">Ver mi perfil</Link>}>
        <p>Tu cuenta ya está lista. Estamos construyendo las herramientas para compartir información sobre profesores, materias y experiencias universitarias.</p>
        <p>Ya podés explorar la jerarquía académica desde Materias. El resto de las secciones del menú están en preparación.</p>
      </EmptyState>
      <p className="system-footnote">Las funcionalidades de reseñas y experiencias estarán disponibles en próximas etapas. No hay contenido publicado todavía.</p>
    </section>
  </>;
}
