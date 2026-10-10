import type { Metadata } from "next";
import { UpcomingSection } from "@/components/home/UpcomingSection";

export const metadata: Metadata = { title: "Comunidad | Profesor Butchery" };

export default function ComunidadPage() {
  return <UpcomingSection id="comunidad" />;
}
