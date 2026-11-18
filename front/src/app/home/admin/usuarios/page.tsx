import { BrandLoading } from "@/components/ui/BrandLoading";
import type { Metadata } from "next";
import { Suspense } from "react";
import { UsuariosList } from "@/components/admin/UsuariosList";

export const metadata: Metadata = { title: "Usuarios registrados | Professors' butchery" };

export default function UsuariosPage() {
  return <Suspense fallback={<BrandLoading message="Cargando usuarios…" />}><UsuariosList /></Suspense>;
}
