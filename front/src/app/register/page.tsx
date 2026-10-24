import { AccountForm } from "@/components/auth/AccountForm";
import { RequireGuest } from "@/components/auth/RequireGuest";
export default function RegisterPage() { return <main id="main-content" className="page"><RequireGuest><div className="auth-card"><AccountForm key="register" mode="register" /></div></RequireGuest></main>; }
