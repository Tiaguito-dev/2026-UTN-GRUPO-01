import type { Metadata } from "next";
import { inicioFeedWindowKey, feedbackSuccessMessage } from "@/validations/feedback";
import { InicioSection } from "@/components/home/InicioSection";
import { Notice } from "@/components/ui/Notice";

export const metadata: Metadata = { title: "Inicio | Professors' butchery" };

export default async function SystemHomePage({ searchParams }: { searchParams: Promise<{ feedRefresh?: string | string[]; successMessage?: string | string[] }> }) {
  const query = await searchParams;
  const successMessage = feedbackSuccessMessage(query.successMessage);
  return <>{successMessage ? <Notice tone="success">{successMessage}</Notice> : null}<InicioSection key={inicioFeedWindowKey(query.feedRefresh)} /></>;
}
