import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  // A constant template keeps child route metadata from changing the browser tab name.
  title: { default: "Profesor Butchery", template: "Profesor Butchery" },
  description: "Una comunidad de estudiantes para compartir experiencias sobre materias y profesores.",
  referrer: "no-referrer",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es">
      <body><AuthProvider><a href="#main-content" className="skip-link">Saltar al contenido</a><SiteHeader />{children}</AuthProvider></body>
    </html>
  );
}
