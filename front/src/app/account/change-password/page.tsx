import { RequireAuth } from "@/components/auth/RequireAuth";
import { AccountForm } from "@/components/auth/AccountForm";
import { Card } from "@/components/ui/Card";

export default function ChangePasswordPage() {
  return <main id="main-content" className="page"><Card variant="auth"><RequireAuth><AccountForm mode="change" /></RequireAuth></Card></main>;
}
