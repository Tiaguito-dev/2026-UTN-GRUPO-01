import type { Metadata } from "next";
import { MateriasList } from "@/components/academic/MateriasList";

export const metadata: Metadata = { title: "Materias | Profesor Butchery" };

export default function MateriasPage() {
  return <MateriasList />;
}
