import type { Metadata } from "next";
import { AdminPanel } from "@/components/admin/AdminPanel";

export const metadata: Metadata = { title: "Administración | Profesor Butchery" };

export default function AdminPage() {
  return <AdminPanel />;
}
