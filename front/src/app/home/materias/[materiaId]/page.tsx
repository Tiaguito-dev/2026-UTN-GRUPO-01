import type { Metadata } from "next";
import { CursadasList } from "@/components/academic/CursadasList";

interface Params { materiaId: string }
interface SearchParams { nombre?: string }

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const { nombre } = await searchParams;
  return { title: `${nombre ?? "Materia"} | Profesor Butchery` };
}

export default async function CursadasPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SearchParams> }) {
  const { materiaId } = await params;
  const { nombre } = await searchParams;
  return <CursadasList materiaId={materiaId} materiaNombre={nombre} />;
}
