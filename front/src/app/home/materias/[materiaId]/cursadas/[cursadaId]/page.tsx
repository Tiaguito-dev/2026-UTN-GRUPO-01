import type { Metadata } from "next";
import { ComisionesList } from "@/components/academic/ComisionesList";
import { periodoLabel } from "@/components/academic/periodo";
import type { Cuatrimestre } from "@/services/academic";

interface Params { materiaId: string; cursadaId: string }
interface SearchParams { nombre?: string; anio?: string; cuatrimestre?: string }

function parseCuatrimestre(value: string | undefined): Cuatrimestre | undefined {
  return value === "PRIMERO" || value === "SEGUNDO" ? value : undefined;
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const { anio, cuatrimestre } = await searchParams;
  const anioNumero = anio ? Number(anio) : undefined;
  const cuatrimestreValido = parseCuatrimestre(cuatrimestre);
  const periodo = anioNumero && cuatrimestreValido ? periodoLabel(anioNumero, cuatrimestreValido) : "Comisiones";
  return { title: `${periodo} | Profesor Butchery` };
}

export default async function ComisionesPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SearchParams> }) {
  const { materiaId, cursadaId } = await params;
  const { nombre, anio, cuatrimestre } = await searchParams;
  return <ComisionesList
    materiaId={materiaId}
    cursadaId={cursadaId}
    materiaNombre={nombre}
    anio={anio ? Number(anio) : undefined}
    cuatrimestre={parseCuatrimestre(cuatrimestre)}
  />;
}
