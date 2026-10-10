import type { Metadata } from "next";
import { UpcomingSection } from "@/components/home/UpcomingSection";

export const metadata: Metadata = { title: "Profesores | Profesor Butchery" };

export default function ProfesoresPage() {
  return <UpcomingSection id="profesores" />;
}
