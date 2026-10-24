import type { ReactNode } from "react";
import { AppShell } from "@/components/home/AppShell";

/** El perfil comparte el shell de /home (TASK-032, decisión 1); sus URLs y los encabezados de
 *  next.config.ts no cambian. */
export default function AccountLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
