import type { Metadata } from "next";
import { AltaMateria } from "@/components/admin/AltaMateria";

export const metadata: Metadata = { title: "Nueva materia | Professors' butchery" };

export default function AltaMateriaPage() {
  return <AltaMateria />;
}
