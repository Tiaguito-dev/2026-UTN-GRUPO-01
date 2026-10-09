import { RequireAuth } from "@/components/auth/RequireAuth";
import { AccountPanel } from "@/components/auth/AccountPanel";
export default function AccountPage() { return <main id="main-content"><div className="account-container"><RequireAuth><AccountPanel /></RequireAuth></div></main>; }
