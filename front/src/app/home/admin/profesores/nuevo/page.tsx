import type { Metadata } from "next";
import { AltaProfesor } from "@/components/admin/AltaProfesor";

export const metadata: Metadata = { title: "Nuevo profesor | Professors' butchery" };

export default function AltaProfesorPage() {
  return <AltaProfesor />;
}
