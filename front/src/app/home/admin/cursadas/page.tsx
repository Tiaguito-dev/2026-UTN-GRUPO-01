import type { Metadata } from "next";
import { Suspense } from "react";
import { CursadasAdminList } from "@/components/admin/CursadasAdminList";
export const metadata: Metadata = { title: "Cursadas | Professors' butchery" };
export default function ListPage() { return <Suspense fallback={<p role="status">Cargando cursadas…</p>}><CursadasAdminList /></Suspense>; }
