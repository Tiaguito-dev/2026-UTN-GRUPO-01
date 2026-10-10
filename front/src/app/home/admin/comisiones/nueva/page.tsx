import type { Metadata } from "next";
import { AltaComision } from "@/components/admin/AltaComision";

export const metadata: Metadata = { title: "Nueva comisión | Profesor Butchery" };

export default function AltaComisionPage() {
  return <AltaComision />;
}
