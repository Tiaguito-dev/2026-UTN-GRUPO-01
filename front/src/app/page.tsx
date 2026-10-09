import Link from "next/link";
import { FeatureCarousel } from "@/components/FeatureCarousel";
import { RequireGuest } from "@/components/auth/RequireGuest";

export default function HomePage() {
  return (
    <main id="main-content" className="landing"><RequireGuest>
      <section id="proyecto" className="hero" aria-labelledby="hero-title">
        <p className="eyebrow"><span aria-hidden="true" />De estudiantes, para estudiantes</p>
        <h1 id="hero-title">Tu carrera, con <span>más perspectiva.</span></h1>
        <p className="hero-description">Profesor Butchery nace para dar transparencia a la experiencia universitaria. Conocé las materias y a tus profesores a través de quienes ya estuvieron ahí, y elegí tu próximo paso con más información.</p>
        <div className="actions hero-actions"><Link className="button" href="/register">Crear cuenta <span aria-hidden="true">↗</span></Link><Link className="button button-secondary" href="/login">Iniciar sesión</Link></div>
        <p className="hero-note">Una comunidad para compartir lo que nos hubiera gustado saber.</p>
      </section>
      <section id="funcionalidades" className="features-section" aria-labelledby="features-title">
        <div className="section-heading"><p className="eyebrow">Lo que estamos construyendo</p><h2 id="features-title">La experiencia de otros,<br />a favor de tu recorrido.</h2><p>Hoy podés crear y gestionar tu cuenta. Estas funcionalidades son el próximo paso del proyecto.</p></div>
        <FeatureCarousel />
      </section>
      <footer className="landing-footer"><span>Profesor Butchery</span><p>Información compartida. Comunidad universitaria.</p></footer>
    </RequireGuest></main>
  );
}
