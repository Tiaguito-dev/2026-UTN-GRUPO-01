import { AccountForm } from "@/components/auth/AccountForm";
import { RequireGuest } from "@/components/auth/RequireGuest";
import { Card } from "@/components/ui/Card";
export default function RegisterPage() { return <main id="main-content" className="page"><RequireGuest><Card variant="auth"><AccountForm key="register" mode="register" /></Card></RequireGuest></main>; }
