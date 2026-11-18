import { BrandLoading } from "@/components/ui/BrandLoading";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ComisionesAdminList } from "@/components/admin/ComisionesAdminList";
export const metadata: Metadata = { title: "Comisiones | Professors' butchery" };
export default function ListPage() { return <Suspense fallback={<BrandLoading message="Cargando comisiones…" />}><ComisionesAdminList /></Suspense>; }
