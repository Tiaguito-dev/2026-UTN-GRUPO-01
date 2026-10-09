"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const sections = [
  { id: "inicio", title: "Inicio", symbol: "⌂", description: "Tu espacio para conocer el proyecto y preparar tu próximo paso en la universidad." },
  { id: "profesores", title: "Profesores", symbol: "P", description: "Un espacio para conocer a los profesores a partir de la experiencia compartida por estudiantes.", detail: "Aquí podrás consultar opiniones y perspectivas sobre la enseñanza. Todavía no hay perfiles ni reseñas disponibles." },
  { id: "materias", title: "Materias", symbol: "M", description: "Información para acercarte a cada materia con más contexto antes de cursarla.", detail: "Aquí podrás explorar experiencias de cursada y conocer qué esperar de las materias. Este módulo todavía no está disponible." },
  { id: "experiencias", title: "Experiencias", symbol: "E", description: "Recorridos reales que aportan otra perspectiva a tus decisiones académicas.", detail: "Aquí podrás compartir y descubrir experiencias universitarias. Por ahora no hay publicaciones ni acciones habilitadas." },
  { id: "comunidad", title: "Comunidad", symbol: "C", description: "Un lugar de encuentro para quienes quieren compartir lo que aprendieron en el camino.", detail: "Aquí construiremos la participación de la comunidad estudiantil. Esta funcionalidad se encuentra en desarrollo." },
] as const;

export function SystemHome() {
  const { account } = useAuth();
  const [selected, setSelected] = useState<string>("inicio");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const section = sections.find((item) => item.id === selected) ?? sections[0];
  useEffect(() => { headingRef.current?.focus(); }, [selected]);
  return <div className="system-home">
    <aside className="system-sidebar" aria-label="Secciones del sistema">
      <p className="sidebar-title">Tu espacio</p>
      <nav aria-label="Funcionalidades"><ul>{sections.map((item) => <li key={item.id}><button type="button" aria-current={selected === item.id ? "page" : undefined} onClick={() => setSelected(item.id)}><span className="sidebar-symbol" aria-hidden="true">{item.symbol}</span><span>{item.title}</span></button></li>)}</ul></nav>
      <p className="sidebar-note">De estudiantes,<br />para estudiantes.</p>
    </aside>
    <section className="system-content" aria-labelledby="system-heading">
      <p className="eyebrow">{selected === "inicio" ? "Profesor Butchery" : "Lo que estamos construyendo"}</p>
      <h1 id="system-heading" tabIndex={-1} ref={headingRef}>{selected === "inicio" ? `Hola, ${account?.displayName ?? "bienvenido"}.` : section.title}</h1>
      <p className="system-description">{section.description}</p>
      {section.id === "inicio" ? <>
        <div className="system-empty"><span className="empty-symbol" aria-hidden="true">PB</span><h2>Este espacio está empezando a tomar forma</h2><p>Tu cuenta ya está lista. Estamos construyendo las herramientas para compartir información sobre profesores, materias y experiencias universitarias.</p><p>Elegí una sección del menú para conocer lo que vendrá. Mientras tanto, podés consultar tu perfil y gestionar la seguridad de tu cuenta.</p><Link className="button" href="/account">Ver mi perfil</Link></div>
        <p className="system-footnote">Las funcionalidades académicas estarán disponibles en próximas etapas. No hay contenido publicado todavía.</p>
      </> : <div className="system-empty"><span className="empty-symbol" aria-hidden="true">{section.symbol}</span><span className="upcoming-badge">Próximamente</span><h2>Estamos preparando esta sección</h2><p>{"detail" in section ? section.detail : ""}</p><p>Cuando esté disponible, encontrarás aquí la información y las opciones para participar.</p><button type="button" className="button-secondary" onClick={() => setSelected("inicio")}>Volver al inicio</button></div>}
    </section>
  </div>;
}
