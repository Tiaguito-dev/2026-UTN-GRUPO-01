import type { Metadata } from "next";
import { Suspense } from "react";
import { ComisionesAdminList } from "@/components/admin/ComisionesAdminList";
export const metadata: Metadata = { title: "Comisiones | Professors' butchery" };
export default function ListPage() { return <Suspense fallback={<p role="status">Cargando comisiones…</p>}><ComisionesAdminList /></Suspense>; }
