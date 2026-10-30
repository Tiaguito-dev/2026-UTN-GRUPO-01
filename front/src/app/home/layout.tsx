import type { ReactNode } from "react";
import { AppShell } from "@/components/home/AppShell";

export default function HomeLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
