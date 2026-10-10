import type { Metadata } from "next";
import { UsuariosList } from "@/components/admin/UsuariosList";

export const metadata: Metadata = { title: "Usuarios registrados | Profesor Butchery" };

export default function UsuariosPage() {
  return <UsuariosList />;
}
