import type { Metadata } from "next";
import { Suspense } from "react";
import { UsuariosList } from "@/components/admin/UsuariosList";

export const metadata: Metadata = { title: "Usuarios registrados | Profesor Butchery" };

export default function UsuariosPage() {
  return <Suspense fallback={<p role="status">Cargando usuarios…</p>}><UsuariosList /></Suspense>;
}
