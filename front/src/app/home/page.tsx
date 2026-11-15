import type { Metadata } from "next";
import { inicioFeedWindowKey } from "@/validations/feedback";
import { InicioSection } from "@/components/home/InicioSection";

export const metadata: Metadata = { title: "Inicio | Professors' butchery" };

export default async function SystemHomePage({ searchParams }: { searchParams: Promise<{ feedRefresh?: string | string[] }> }) {
  const query = await searchParams;
  return <InicioSection key={inicioFeedWindowKey(query.feedRefresh)} />;
}
