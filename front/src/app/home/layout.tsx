import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { SidebarNav } from "@/components/home/SidebarNav";

/** Shell del espacio interno: el sidebar y el guard viven acá una sola vez, así persisten
 *  entre todas las rutas bajo /home sin remontarse al navegar. */
export default function HomeLayout({ children }: { children: ReactNode }) {
  return <main id="main-content" className="system-main">
    <RequireAuth>
      <div className="system-home">
        <SidebarNav />
        <div className="system-content">{children}</div>
      </div>
    </RequireAuth>
  </main>;
}
