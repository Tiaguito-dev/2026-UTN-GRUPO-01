"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { UsersRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import type { AsyncState } from "@/hooks/usePaginatedFetch";
import { obtenerNormas } from "@/services/comunidad";
import { HttpError } from "@/services/http";
import type { NormasConvivencia } from "@/types/comunidad";
import styles from "./ComunidadPageContent.module.css";

/** Un documento de consulta para ambos roles. Las capacidades futuras se compondrán aquí. */
export function ComunidadPageContent({ administrative = false, updated = false }: { administrative?: boolean; updated?: boolean } = {}) {
  const headingId = useId();
  const messageId = useId();
  const rulesId = useId();
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{ attempt: number; state: AsyncState<NormasConvivencia> } | null>(null);

  useEffect(() => {
    let active = true;
    obtenerNormas().then(
      data => { if (active) setSettled({ attempt, state: { status: "ready", data } }); },
      (failure: unknown) => {
        if (!active) return;
        const notFound = failure instanceof HttpError && failure.status === 404;
        setSettled({ attempt, state: { status: "error", notFound,
          error: notFound ? "Todavía no hay normas de convivencia disponibles." : "No pudimos cargar las normas de convivencia.",
        } });
      },
    );
    return () => { active = false; };
  }, [attempt]);

  const state: AsyncState<NormasConvivencia> = settled?.attempt === attempt ? settled.state : { status: "loading" };

  return <section aria-labelledby={headingId}>
    <PageHeader id={headingId} title="Comunidad" description="Un espacio para compartir experiencias y ayudarnos desde el respeto." />
    {administrative ? <p><Link className="button button-secondary" href="/home/admin/comunidad/editar">Administrar normas de convivencia</Link></p> : null}
    {administrative && updated ? <Notice tone="success">Las normas de convivencia se actualizaron correctamente.</Notice> : null}
    {state.status === "loading" ? <p role="status">Cargando normas de convivencia…</p> : null}
    {state.status === "error" ? <Notice tone={state.notFound ? "warning" : "error"}>
      <p>{state.error}</p>
      <button type="button" className="button button-secondary" onClick={() => setAttempt(value => value + 1)}>Reintentar</button>
    </Notice> : null}
    {state.status === "ready" ? <div className={styles.content}>
      <Card variant="panel" as="section" aria-labelledby={messageId}>
        <div className={styles.messageHeading}>
          <span className={styles.symbol} aria-hidden="true"><UsersRound size={28} strokeWidth={1.75} /></span>
          <h2 id={messageId} className={styles.title}>{state.data.titulo}</h2>
        </div>
        <div className={styles.paragraphs}>{paragraphs(state.data.introduccion)}</div>
      </Card>
      <Card variant="panel" as="section" aria-labelledby={rulesId}>
        <h2 id={rulesId} className={styles.title}>Normas de convivencia</h2>
        <ol className={styles.rules}>{state.data.normas.map((norma, index) => <li key={index}>{norma}</li>)}</ol>
        <div className={`${styles.paragraphs} ${styles.closing}`}>{paragraphs(state.data.cierre)}</div>
      </Card>
    </div> : null}
  </section>;
}

function paragraphs(text: string) {
  return text.split(/\r?\n\s*\r?\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>);
}
