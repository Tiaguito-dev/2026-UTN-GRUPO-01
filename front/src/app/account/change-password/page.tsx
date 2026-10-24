import { RequireAuth } from "@/components/auth/RequireAuth";
import { AccountForm } from "@/components/auth/AccountForm";

export default function ChangePasswordPage() {
  return <main id="main-content" className="page"><div className="auth-card"><RequireAuth><AccountForm mode="change" /></RequireAuth></div></main>;
}
