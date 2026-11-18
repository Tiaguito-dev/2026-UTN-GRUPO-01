import type { Metadata } from "next";
import { NormasForm } from "@/components/comunidad/NormasForm";

export const metadata: Metadata = { title: "Administrar normas de convivencia | Professors' butchery" };

export default function EditarNormasPage() {
  return <NormasForm />;
}
