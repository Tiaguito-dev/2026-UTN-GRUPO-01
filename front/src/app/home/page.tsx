import { RequireAuth } from "@/components/auth/RequireAuth";
import { SystemHome } from "@/components/home/SystemHome";

export default function SystemHomePage() {
  return <main id="main-content" className="system-main"><RequireAuth><SystemHome /></RequireAuth></main>;
}
