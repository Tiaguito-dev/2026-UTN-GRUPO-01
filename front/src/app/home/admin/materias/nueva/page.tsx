import type { Metadata } from "next";
import { AltaMateria } from "@/components/admin/AltaMateria";

export const metadata: Metadata = { title: "Nueva materia | Profesor Butchery" };

export default function AltaMateriaPage() {
  return <AltaMateria />;
}
