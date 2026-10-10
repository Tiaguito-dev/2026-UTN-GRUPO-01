import type { Metadata } from "next";
import { UpcomingSection } from "@/components/home/UpcomingSection";

export const metadata: Metadata = { title: "Experiencias | Profesor Butchery" };

export default function ExperienciasPage() {
  return <UpcomingSection id="experiencias" />;
}
