import { Suspense } from "react";
import { AdminExperiencias } from "@/components/admin/AdminExperiencias";

export default function ExperienciasAdminPage() {
  return <Suspense fallback={<p role="status">Cargando experiencias…</p>}><AdminExperiencias /></Suspense>;
}
