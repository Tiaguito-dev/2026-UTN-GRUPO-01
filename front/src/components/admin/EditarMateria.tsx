"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMateria } from "@/hooks/useMateria";
import { MateriaFormPage } from "./MateriaFormPage";
import { safeAdminReturnTo } from "@/validations/admin";

export function EditarMateria({ materiaId }: { materiaId: string }) {
  const params = useSearchParams();
  const backHref = safeAdminReturnTo(params.get("returnTo")) ?? `/home/admin/materias/${encodeURIComponent(materiaId)}`;
  const { materia, error, retry } = useMateria(materiaId);
  if (error) return <p role="alert">Lo sentimos. No pudimos recuperar la materia. {error} <button className="button" type="button" onClick={retry}>Reintentar</button> <Link href={backHref}>Volver</Link></p>;
  if (!materia) return <p role="status">Cargando materia…</p>;
  if (materia.deletedAt) return <p role="alert">La materia está inactiva. <Link href={backHref}>Volver</Link></p>;
  return <MateriaFormPage key={materia.id} materia={materia} />;
}
