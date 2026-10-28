import type { Metadata } from "next";
import { Suspense } from "react";
import { MateriasAdminList } from "@/components/admin/MateriasAdminList";
export const metadata: Metadata = { title: "Materias | Profesor Butchery" };
export default function ListPage() { return <Suspense fallback={<p role="status">Cargando materias…</p>}><MateriasAdminList /></Suspense>; }
