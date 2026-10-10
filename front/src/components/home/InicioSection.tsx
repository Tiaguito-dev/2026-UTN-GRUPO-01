"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { findSection } from "./sections";

/** Contenido de /home. El sidebar y el guard viven en app/home/layout.tsx, no acá. */
export function InicioSection() {
  const { account } = useAuth();
  const section = findSection("inicio");
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  return <>
    <p className="eyebrow">Profesor Butchery</p>
    <h1 id="system-heading" tabIndex={-1} ref={headingRef}>Hola, {account?.displayName ?? "bienvenido"}.</h1>
    <p className="system-description">{section.description}</p>
    <div className="system-empty">
      <span className="empty-symbol" aria-hidden="true">PB</span>
      <h2>Este espacio está empezando a tomar forma</h2>
      <p>Tu cuenta ya está lista. Estamos construyendo las herramientas para compartir información sobre profesores, materias y experiencias universitarias.</p>
      <p>Ya podés explorar la jerarquía académica desde Materias. El resto de las secciones del menú están en preparación.</p>
      <Link className="button" href="/account">Ver mi perfil</Link>
    </div>
    <p className="system-footnote">Las funcionalidades de reseñas y experiencias estarán disponibles en próximas etapas. No hay contenido publicado todavía.</p>
  </>;
}
