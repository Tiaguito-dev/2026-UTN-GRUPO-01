import { BrandLoading } from "@/components/ui/BrandLoading";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AltaComision } from "@/components/admin/AltaComision";

export const metadata: Metadata = { title: "Nueva comisión | Professors' butchery" };

export default function AltaComisionPage() {
  return <Suspense fallback={<BrandLoading message="Cargando materias…" />}><AltaComision /></Suspense>;
}
