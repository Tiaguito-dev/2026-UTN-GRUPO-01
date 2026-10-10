import type { Metadata } from "next";
import { AltaCursada } from "@/components/admin/AltaCursada";

export const metadata: Metadata = { title: "Nueva cursada | Profesor Butchery" };

export default function AltaCursadaPage() {
  return <AltaCursada />;
}
