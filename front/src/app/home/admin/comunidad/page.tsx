import type { Metadata } from "next";
import { Suspense } from "react";
import { ComunidadAdminPageContent } from "@/components/comunidad/ComunidadAdminPageContent";

export const metadata: Metadata = { title: "Comunidad | Professors' butchery" };

export default function ComunidadAdminPage() {
  return <Suspense fallback={<p role="status">Cargando normas de convivencia…</p>}><ComunidadAdminPageContent /></Suspense>;
}
