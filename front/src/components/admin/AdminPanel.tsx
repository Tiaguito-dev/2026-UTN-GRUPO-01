"use client";

import Link from "next/link";
import { Fragment, useId } from "react";
import { findSection } from "@/components/home/sections";
import { PageHeader } from "@/components/ui/PageHeader";
import styles from "./AdminPanel.module.css";

// Los listados administrativos conservan la selección de materia y cursada por URL.
const OFERTA = [
  { simbolo: "M", titulo: "Materias", detalle: "Con sus carreras. El nombre no puede repetirse.", requisito: null, nota: "Se carga sola", nueva: { label: "Nueva", nombre: "Nueva materia", href: "/home/admin/materias/nueva" }, ver: { label: "Ver todas", nombre: "Ver todas las materias", href: "/home/admin/materias" }, flecha: "→" },
  { simbolo: "Cu", titulo: "Cursadas", detalle: "El dictado de una materia en un año y período.", requisito: "materia", nota: null, nueva: { label: "Nueva", nombre: "Nueva cursada", href: "/home/admin/cursadas/nueva" }, ver: { label: "Ver todas", nombre: "Ver todas las cursadas", href: "/home/admin/cursadas" }, flecha: "→" },
  { simbolo: "Co", titulo: "Comisiones", detalle: "Carrera más número, por ejemplo S-31.", requisito: "cursada", nota: null, nueva: { label: "Nueva", nombre: "Nueva comisión", href: "/home/admin/comisiones/nueva" }, ver: { label: "Ver todas", nombre: "Ver todas las comisiones", href: "/home/admin/comisiones" }, flecha: "←" },
  { simbolo: "P", titulo: "Profesores", detalle: "Se asignan a cada comisión con su cargo: Titular, Adjunto o JTP.", requisito: null, nota: "Se carga solo", nueva: { label: "Nuevo", nombre: "Nuevo profesor", href: "/home/admin/profesores/nuevo" }, ver: { label: "Ver todos", nombre: "Ver todos los profesores", href: "/home/admin/profesores" }, flecha: null },
];

export function AdminPanel() {
  const headingId = useId();
  const ofertaId = useId();
  const cuentasId = useId();

  return <section aria-labelledby={headingId}>
    <PageHeader id={headingId} title="Administración" description={findSection("admin").description} />
    {/* TASK-054: accesos rápidos solo en móvil (el layout de hoy es 100% CSS responsive, sin nav propia). */}
    <nav className={styles.quickLinks} aria-label="Accesos rápidos">
      <a href="#oferta">Oferta académica</a>
      <a href="#cuentas-m">Cuentas</a>
    </nav>
    <section id="oferta" className={styles.group} aria-labelledby={ofertaId}>
      <div>
        <h2 id={ofertaId} className={styles.groupTitle}>Oferta académica</h2>
        <p className={styles.groupDescription}>Materias y profesores se cargan por separado. Una cursada es una materia en un año y período; dentro de ella se agregan las comisiones, y a cada comisión se le asignan sus profesores con el cargo.</p>
      </div>
      <div className={styles.flow}>
        {OFERTA.map((card) => <Fragment key={card.titulo}>
          <article className={styles.card}>
            <div className={styles.cardHead}><span className={styles.symbol} aria-hidden="true">{card.simbolo}</span><h3>{card.titulo}</h3></div>
            <p className={styles.detail}>{card.detalle}</p>
            <p className={styles.requirement}>{card.requisito ? <>Usa una <span className={styles.chip}>{card.requisito}</span> existente</> : <span className={styles.chipMuted}>{card.nota}</span>}</p>
            <div className={styles.actions}>
              <Link className="button" href={card.nueva.href} aria-label={card.nueva.nombre}>{card.nueva.label}</Link>
              <Link className="button button-secondary" href={card.ver.href} aria-label={card.ver.nombre}>{card.ver.label}</Link>
            </div>
          </article>
          {card.flecha ? <div className={styles.arrow} aria-hidden="true"><span>{card.flecha}</span></div> : null}
        </Fragment>)}
      </div>
    </section>
    <section id="cuentas-m" className={styles.group} aria-labelledby={cuentasId}>
      <h2 id={cuentasId} className={styles.groupTitle}>Cuentas y experiencias</h2>
      <div className={styles.accounts}>
        <article className={styles.card}>
          <div className={styles.cardHead}><span className={styles.symbol} aria-hidden="true">U</span><h3>Usuarios registrados</h3></div>
          <p className={styles.detail}>Listado de consulta de las cuentas de la aplicación, con su rol.</p>
          <div className={styles.actions}>
            <Link className="button button-secondary" href="/home/admin/usuarios" aria-label="Ver todos los usuarios registrados">Ver todos</Link>
          </div>
        </article>
        <article className={styles.card}>
          <div className={styles.cardHead}><h3>Experiencias</h3></div>
          <p className={styles.detail}>Consulta de los comentarios publicados, respetando su identidad pública.</p>
          <div className={styles.actions}><Link className="button button-secondary" href="/home/admin/experiencias">Ver experiencias</Link></div>
        </article>
      </div>
    </section>
    <p className="system-footnote">La administración permite crear y editar. No se realizan bajas desde este panel.</p>
  </section>;
}
