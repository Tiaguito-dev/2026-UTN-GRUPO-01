"use client";

import { useState, type KeyboardEvent } from "react";

const features = [
  { title: "Conocé a tus profesores", category: "Reseñas docentes", description: "Experiencias de otros estudiantes para conocer estilos de enseñanza y llegar con más contexto a tu próxima cursada.", symbol: "01" },
  { title: "Una mirada a cada materia", category: "Panorama de la carrera", description: "Información compartida sobre materias para orientarte al planificar tu recorrido académico.", symbol: "02" },
  { title: "Aprendé de otras experiencias", category: "De estudiante a estudiante", description: "Consejos y experiencias entre pares para que las decisiones de tu carrera no dependan solo del boca a boca.", symbol: "03" },
  { title: "Construyamos una comunidad", category: "Participación respetuosa", description: "Un espacio de intercambio honesto y constructivo, donde compartir información también ayude a quienes vienen después.", symbol: "04" },
];

export function FeatureCarousel() {
  const [active, setActive] = useState(0);
  const move = (direction: number) => setActive((current) => (current + direction + features.length) % features.length);
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") move(1);
    else if (event.key === "ArrowLeft") move(-1);
    else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(features.length - 1);
    else return;
    event.preventDefault();
  }
  return <div className="feature-carousel" role="region" aria-roledescription="carrusel" aria-label="Próximas funcionalidades" tabIndex={0} onKeyDown={navigate}>
    <p className="carousel-help">Explorá con las flechas o los botones.</p>
    <div className="carousel-stage">
      {features.map((feature, index) => {
        const offset = (index - active + features.length) % features.length;
        const position = offset === 0 ? "active" : offset === 1 ? "next" : offset === features.length - 1 ? "previous" : "hidden";
        return <article key={feature.symbol} className={`feature-card feature-card-${position}`} aria-hidden={index !== active}>
          <div className="feature-topline"><span className="feature-symbol">{feature.symbol}</span><span className="upcoming-badge">Próximamente</span></div>
          <p className="feature-category">{feature.category}</p>
          <h3>{feature.title}</h3>
          <p className="feature-description">{feature.description}</p>
          <span className="feature-footer">Más contexto. Mejores decisiones.</span>
        </article>;
      })}
    </div>
    <div className="carousel-controls">
      <button className="carousel-arrow" type="button" aria-label="Funcionalidad anterior" onClick={() => move(-1)}>←</button>
      <div className="carousel-dots">{features.map((feature, index) => <button key={feature.symbol} type="button" className="carousel-dot" aria-label={`Mostrar ${feature.category}`} aria-pressed={active === index} onClick={() => setActive(index)} />)}</div>
      <button className="carousel-arrow" type="button" aria-label="Funcionalidad siguiente" onClick={() => move(1)}>→</button>
    </div>
    <p className="carousel-status" aria-live="polite" aria-atomic="true">{active + 1} de {features.length} · {features[active]!.category}</p>
  </div>;
}
