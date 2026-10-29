"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { sectionsForRole } from "./sections";
import { NavigationIcon } from "./NavigationIcon";
import styles from "./SidebarNav.module.css";

/** La sección activa sale de la URL, no de estado interno: el sidebar vive en el layout y
 *  persiste entre navegaciones, incluido el drill-down de /home/materias/**. */
function isCurrent(pathname: string, href: string): boolean {
  // /account/** marca Inicio: el perfil no tiene sección en el sidebar, se abre desde el menú de cuenta.
  if (href === "/home" || href === "/home/admin") return pathname === href || pathname === "/account" || pathname.startsWith("/account/") || (href === "/home/admin" && /^\/home\/admin\/(cursadas|comisiones)(\/|$)/.test(pathname));
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();
  const { status, account } = useAuth();
  // Una sección con rol se muestra solo con la sesión ya confirmada: mientras se comprueba no
  // aparece ni desaparece, queda oculta.
  const administrative = status === "authenticated" && account?.role === "ADMIN";
  const sections = sectionsForRole(administrative ? "ADMIN" : undefined);
  return <aside className="system-sidebar">
    <p className="sidebar-title">{administrative ? "Administración" : "Tu espacio"}</p>
    <nav aria-label="Navegación principal">
      <ul>
        {sections.map((item) => <li key={item.id}>
          <Link className={`button ${styles.link}`} href={item.href} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>
            <NavigationIcon section={item.id} />
            <span>{item.title}</span>
          </Link>
        </li>)}
      </ul>
    </nav>
    {administrative ? null : <p className="sidebar-note">De estudiantes,<br />para estudiantes.</p>}
  </aside>;
}
