"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMateria } from "@/hooks/useMateria";
import {
  isAnioCarrera,
  isCarrera,
  materiaDetailHref,
  parseMateriaPage,
  parseMateriaContext,
} from "@/validations/materias";
import { MateriaFormPage } from "./MateriaFormPage";
import { safeAdminReturnTo } from "@/validations/admin";

export function EditarMateria({ materiaId }: { materiaId: string }) {
  const params = useSearchParams();
  const rawCarrera = params.get("carrera");
  const carrera = isCarrera(rawCarrera) ? rawCarrera : undefined;
  const rawAnio = params.get("anioCarrera");
  const anio = isAnioCarrera(rawAnio) ? rawAnio : undefined;
  const context = parseMateriaContext(params);
  const detailHref = materiaDetailHref(materiaId, carrera, anio, parseMateriaPage(params.get("listadoPage")), context);
  const backHref = safeAdminReturnTo(params.get("returnTo")) ?? detailHref;
  const { materia, error, retry } = useMateria(materiaId);
  if (error) return <p role="alert">Lo sentimos. No pudimos recuperar la materia. {error} <button className="button" type="button" onClick={retry}>Reintentar</button> <Link href={backHref}>Volver</Link></p>;
  if (!materia) return <p role="status">Cargando materia…</p>;
  if (materia.deletedAt) return <p role="alert">La materia está inactiva. <Link href={backHref}>Volver</Link></p>;
  return <MateriaFormPage key={materia.id} materia={materia} detailHref={detailHref} />;
}
