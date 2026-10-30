import { Suspense } from "react";
import { ExperienciasList } from "@/components/feedback/ExperienciasList";

export default function ExperienciasAdminPage() {
  return <Suspense fallback={<p role="status">Cargando experiencias…</p>}><ExperienciasList administrative /></Suspense>;
}
