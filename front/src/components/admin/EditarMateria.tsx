"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMateria } from "@/hooks/useMateria";
import { isAnioCarrera, materiaDetailHref, parseMateriaPage, parseMateriaContext } from "@/validations/materias";
import { MateriaForm } from "./MateriaForm";
export function EditarMateria({ materiaId }: { materiaId: string }) {
  const params = useSearchParams();
  const rawAnio = params.get("anioCarrera");
  const context = parseMateriaContext(params);
  const detailHref = materiaDetailHref(materiaId, isAnioCarrera(rawAnio) ? rawAnio : undefined, parseMateriaPage(params.get("listadoPage")), context);
  const { materia, error, retry } = useMateria(materiaId);
  if (error) return <p role="alert">Lo sentimos. No pudimos recuperar la materia. {error} <button type="button" onClick={retry}>Reintentar</button> <Link href={detailHref}>Volver</Link></p>;
  if (!materia) return <p role="status">Cargando materia…</p>;
  if (materia.deletedAt) return <p role="alert">La materia está inactiva. <Link href={detailHref}>Volver</Link></p>;
  return <MateriaForm key={materia.id} materia={materia} detailHref={detailHref} />;
}
