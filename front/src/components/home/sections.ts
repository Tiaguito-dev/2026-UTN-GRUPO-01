import type { Role } from "@/types/auth";

export interface SystemSection {
  id: string;
  title: string;
  symbol: string;
  href: string;
  description: string;
  /** Texto de la pantalla "Próximamente"; ausente en las secciones ya implementadas. */
  detail?: string;
  /** Rol exigido para ver la sección en el menú; ausente ⇒ la ve cualquier cuenta con sesión. */
  role?: Role;
}

export const SYSTEM_SECTIONS: SystemSection[] = [
  {
    id: "inicio", title: "Inicio", symbol: "⌂", href: "/home",
    description: "Tu espacio para conocer el proyecto y preparar tu próximo paso en la universidad.",
  },
  {
    id: "profesores", title: "Profesores", symbol: "P", href: "/home/profesores",
    description: "Un espacio para conocer a los profesores a partir de la experiencia compartida por estudiantes.",
    detail: "Aquí podrás consultar opiniones y perspectivas sobre la enseñanza. Todavía no hay perfiles ni reseñas disponibles.",
  },
  {
    id: "materias", title: "Materias", symbol: "M", href: "/home/materias",
    description: "Información para acercarte a cada materia con más contexto antes de cursarla.",
  },
  {
    id: "experiencias", title: "Experiencias", symbol: "E", href: "/home/experiencias",
    description: "Recorridos reales que aportan otra perspectiva a tus decisiones académicas.",
    detail: "Aquí podrás compartir y descubrir experiencias universitarias. Por ahora no hay publicaciones ni acciones habilitadas.",
  },
  {
    id: "comunidad", title: "Comunidad", symbol: "C", href: "/home/comunidad",
    description: "Un lugar de encuentro para quienes quieren compartir lo que aprendieron en el camino.",
    detail: "Aquí construiremos la participación de la comunidad estudiantil. Esta funcionalidad se encuentra en desarrollo.",
  },
  {
    id: "admin", title: "Administración", symbol: "A", href: "/home/admin",
    description: "Alta de materias, profesores, cursadas y comisiones, y consulta de las cuentas registradas.",
    role: "ADMIN",
  },
];

export function findSection(id: string): SystemSection {
  const section = SYSTEM_SECTIONS.find((item) => item.id === id);
  if (!section) throw new Error(`Sección desconocida: ${id}`);
  return section;
}
