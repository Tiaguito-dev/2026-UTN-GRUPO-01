import { AccountForm } from "@/components/auth/AccountForm";
import { RequireGuest } from "@/components/auth/RequireGuest";
import { Card } from "@/components/ui/Card";
export default function LoginPage() { return <main id="main-content" className="page"><RequireGuest preserveReturn><Card variant="auth"><AccountForm key="login" mode="login" /></Card></RequireGuest></main>; }
