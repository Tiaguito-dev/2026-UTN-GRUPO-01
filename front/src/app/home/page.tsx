import type { Metadata } from "next";
import { InicioSection } from "@/components/home/InicioSection";

export const metadata: Metadata = { title: "Inicio | Professors' butchery" };

export default function SystemHomePage() {
  return <InicioSection />;
}
