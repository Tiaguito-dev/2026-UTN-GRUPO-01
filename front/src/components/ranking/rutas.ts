import { feedbackComisionHref } from "@/validations/feedback";
import { comisionDetailHref } from "@/validations/admin-academic-navigation";

interface ComisionRef { comision: { id: string }; materia: { id: string }; cursada: { id: string } }

/**
 * The same ranking screens live in the student space (/home/...) and in the admin space
 * (/home/admin/ranking/...), because roleDestination keeps an ADMIN inside /home/admin. Each
 * link points to the destination that belongs to the viewer's space.
 */
export function rutasRanking(admin: boolean) {
  return admin ? {
    profesores: "/home/admin/ranking",
    profesor: (id: string) => `/home/admin/ranking/profesores/${encodeURIComponent(id)}`,
    comisiones: "/home/admin/ranking/comisiones",
    comision: (item: ComisionRef, returnTo: string) => comisionDetailHref(item.comision.id, returnTo),
    origen: { href: "/home/admin/ranking", label: "Ranking" },
  } : {
    profesores: "/home/profesores",
    profesor: (id: string) => `/home/profesores/${encodeURIComponent(id)}`,
    comisiones: "/home/materias/ranking",
    comision: (item: ComisionRef) => feedbackComisionHref({ materiaId: item.materia.id, cursadaId: item.cursada.id, comisionId: item.comision.id }),
    origen: { href: "/home/materias", label: "Materias" },
  };
}
