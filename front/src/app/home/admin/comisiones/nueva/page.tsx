import type { Metadata } from "next";
import { Suspense } from "react";
import { AltaComision } from "@/components/admin/AltaComision";

export const metadata: Metadata = { title: "Nueva comisión | Profesor Butchery" };

export default function AltaComisionPage() {
  return <Suspense fallback={<p role="status">Cargando materias…</p>}><AltaComision /></Suspense>;
}
