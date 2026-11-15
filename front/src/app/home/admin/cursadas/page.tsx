import { BrandLoading } from "@/components/ui/BrandLoading";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CursadasAdminList } from "@/components/admin/CursadasAdminList";
export const metadata: Metadata = { title: "Cursadas | Professors' butchery" };
export default function ListPage() { return <Suspense fallback={<BrandLoading message="Cargando cursadas…" />}><CursadasAdminList /></Suspense>; }
