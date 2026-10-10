"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { SYSTEM_SECTIONS } from "./sections";

/** La sección activa sale de la URL, no de estado interno: el sidebar vive en el layout y
 *  persiste entre navegaciones, incluido el drill-down de /home/materias/**. */
function isCurrent(pathname: string, href: string): boolean {
  return href === "/home" ? pathname === "/home" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();
  const { status, account } = useAuth();
  // Una sección con rol se muestra solo con la sesión ya confirmada: mientras se comprueba no
  // aparece ni desaparece, queda oculta.
  const sections = SYSTEM_SECTIONS.filter((item) => !item.role || (status === "authenticated" && account?.role === item.role));
  return <aside className="system-sidebar" aria-label="Secciones del sistema">
    <p className="sidebar-title">Tu espacio</p>
    <nav aria-label="Funcionalidades">
      <ul>
        {sections.map((item) => <li key={item.id}>
          <Link className="button" href={item.href} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>
            <span className="sidebar-symbol" aria-hidden="true">{item.symbol}</span>
            <span>{item.title}</span>
          </Link>
        </li>)}
      </ul>
    </nav>
    <p className="sidebar-note">De estudiantes,<br />para estudiantes.</p>
  </aside>;
}
