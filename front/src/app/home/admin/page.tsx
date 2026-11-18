import type { Metadata } from "next";
import { AdminPanel } from "@/components/admin/AdminPanel";

export const metadata: Metadata = { title: "Administración | Professors' butchery" };

export default function AdminPage() {
  return <AdminPanel />;
}
