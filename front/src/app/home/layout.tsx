import type { ReactNode } from "react";
import { AppShell } from "@/components/home/AppShell";
import { FeedbackDraftProvider } from "@/components/feedback/FeedbackDraftProvider";

export default function HomeLayout({ children }: { children: ReactNode }) {
  return <FeedbackDraftProvider><AppShell>{children}</AppShell></FeedbackDraftProvider>;
}
