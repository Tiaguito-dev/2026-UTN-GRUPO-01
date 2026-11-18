import { RequireGuest } from "@/components/auth/RequireGuest";
import { WelcomeOptions } from "@/components/landing/WelcomeOptions";

export default function HomePage() {
  return <main id="main-content" tabIndex={-1} className="page landing guided-landing">
    <RequireGuest><WelcomeOptions /></RequireGuest>
  </main>;
}
