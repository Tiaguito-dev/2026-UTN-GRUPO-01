import { AccountForm } from "@/components/auth/AccountForm";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Card } from "@/components/ui/Card";

// The breadcrumb lives here and not in AccountForm, which this task must not touch (risk 2).
export default function ChangePasswordPage() {
  return <>
    <Breadcrumb items={[{ label: "Mi perfil", href: "/account" }, { label: "Cambiar contraseña" }]} />
    <Card variant="panel"><AccountForm mode="change" /></Card>
  </>;
}
