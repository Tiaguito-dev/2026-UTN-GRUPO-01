import type { ReactNode } from "react";
import { RequireRole } from "@/components/auth/RequireRole";

/** El panel completo es solo para ADMIN: el guard vive acá una vez, no en cada página, para que
 *  escribir la URL a mano tampoco alcance. El `<main>`, el sidebar y el guard de sesión los
 *  aporta `AppShell` en app/home/layout.tsx. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RequireRole roles={["ADMIN"]}>{children}</RequireRole>;
}
