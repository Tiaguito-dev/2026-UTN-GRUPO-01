import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { SidebarNav } from "./SidebarNav";

/** Shell del espacio interno (/home y /account): el guard de sesión y el sidebar viven acá una
 *  sola vez por layout, así persisten entre las rutas del segmento sin remontarse al navegar. */
export function AppShell({ children }: { children: ReactNode }) {
  return <main id="main-content" className="system-main">
    <RequireAuth>
      <div>
        <SidebarNav />
        <div className="system-content">{children}</div>
      </div>
    </RequireAuth>
  </main>;
}
