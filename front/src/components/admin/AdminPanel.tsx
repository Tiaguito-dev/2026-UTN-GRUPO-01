"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { findSection } from "@/components/home/sections";

const ACCIONES = [
  { href: "/home/admin/materias/nueva", title: "Nueva materia", detail: "Primer nivel de la jerarquía. El nombre no puede repetirse." },
  { href: "/home/admin/profesores/nuevo", title: "Nuevo profesor", detail: "Queda disponible para asignarlo a cualquier cursada." },
  { href: "/home/admin/cursadas/nueva", title: "Nueva cursada", detail: "El dictado de una materia en un año y cuatrimestre, con un profesor a cargo." },
  { href: "/home/admin/comisiones/nueva", title: "Nueva comisión", detail: "Una comisión dentro de una cursada ya creada." },
  { href: "/home/admin/usuarios", title: "Usuarios registrados", detail: "Listado de consulta de las cuentas de la aplicación." },
];

export function AdminPanel() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  return <section aria-labelledby="admin-heading">
    <h1 ref={headingRef} tabIndex={-1} id="admin-heading">Administración</h1>
    <p className="system-description">{findSection("admin").description}</p>
    <div className="academic-panel">
      <ul className="academic-list">
        {ACCIONES.map((accion) => <li key={accion.href}>
          <Link href={accion.href}>{accion.title}</Link>
          <p className="academic-list-detail">{accion.detail}</p>
        </li>)}
      </ul>
    </div>
    <p className="system-footnote">Para cargar la jerarquía completa el orden es materia, profesor, cursada y comisión: cada nivel necesita el anterior. La edición y la baja todavía no están disponibles.</p>
  </section>;
}
