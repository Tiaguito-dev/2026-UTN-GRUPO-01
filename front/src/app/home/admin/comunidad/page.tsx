import type { Metadata } from "next";
import { ComunidadPageContent } from "@/components/comunidad/ComunidadPageContent";

export const metadata: Metadata = { title: "Comunidad | Professors' butchery" };

export default function ComunidadAdminPage() {
  return <ComunidadPageContent />;
}
