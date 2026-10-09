import { AccountForm } from "@/components/auth/AccountForm";
import { RequireGuest } from "@/components/auth/RequireGuest";
export default function LoginPage() { return <main id="main-content"><RequireGuest preserveReturn><div className="auth-card"><AccountForm key="login" mode="login" /></div></RequireGuest></main>; }
