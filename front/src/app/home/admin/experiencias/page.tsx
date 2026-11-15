import { BrandLoading } from "@/components/ui/BrandLoading";
import { Suspense } from "react";
import { AdminExperiencias } from "@/components/admin/AdminExperiencias";

export default function ExperienciasAdminPage() {
  return <Suspense fallback={<BrandLoading message="Cargando experiencias…" />}><AdminExperiencias /></Suspense>;
}
