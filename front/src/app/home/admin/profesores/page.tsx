import { BrandLoading } from "@/components/ui/BrandLoading";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfesoresList } from "@/components/admin/ProfesoresList";

export const metadata: Metadata = { title: "Profesores | Professors' butchery" };

export default function ProfesoresPage() {
  return <Suspense fallback={<BrandLoading message="Cargando profesores…" />}><ProfesoresList /></Suspense>;
}
