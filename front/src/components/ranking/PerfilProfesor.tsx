"use client";

import { Trophy } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { PaginatedListView } from "@/components/ui/PaginatedListView";
import { Notice } from "@/components/ui/Notice";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ExperienceCard } from "@/components/feedback/ExperienceCard";
import { useFeedbackResource } from "@/components/feedback/useFeedbackResource";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { listarFeedback } from "@/services/feedback";
import { obtenerRankingProfesor } from "@/services/ranking";
import { feedbackDetalleHref } from "@/validations/feedback";
import { cargoLabel } from "@/validations/materias";
import { carreraLabel } from "@/lib/format/carrera";
import { periodoLabel } from "@/lib/format/periodo";
import { RankingList, rangoMostrado } from "./RankingList";
import feedbackStyles from "@/components/feedback/feedback.module.css";
import { rutasRanking } from "./rutas";
import styles from "./Ranking.module.css";
import perfil from "./PerfilProfesor.module.css";

export function PerfilProfesor({ profesorId, admin = false }: { profesorId: string; admin?: boolean }) {
  const rutas = rutasRanking(admin);
  const headingId = useId();
  const comisionesId = useId();
  const comentariosId = useId();
  const [reported, setReported] = useState(0);
  const router = useRouter();
  const { page, setPage } = useUrlPagination();
  const profesor = useFeedbackResource(`ranking-profesor:${profesorId}`, () => obtenerRankingProfesor(profesorId));
  const nombre = profesor.data?.profesor.nombreCompleto ?? (profesor.error ? "Profesor" : "Cargando…");
  const back = { href: rutas.profesores, label: admin ? "Ranking" : "Profesores" };

  return <section className={styles.page} aria-labelledby={headingId}>
    <div className={styles.pageHeader}>
      <PageHeader id={headingId} title={nombre} focusKey={profesorId} back={back} breadcrumb={[back, { label: nombre }]}
        description={profesor.data ? "Lo que cuentan los estudiantes de sus comisiones." : undefined} />
    </div>
    {profesor.loading ? <p role="status">Cargando profesor…</p> : profesor.error || !profesor.data ? <Notice tone="error">
      {profesor.notFound ? <>Este profesor no existe o ya no está disponible. <Link href={back.href}>Volver a {back.label}</Link></> : <>{profesor.error} <button className="button" type="button" onClick={profesor.retry}>Reintentar</button></>}
    </Notice> : <>
      <Card variant="panel" as="section" aria-label="Valoración general"><div className={perfil.resumen}>
        <p className={perfil.promedio}>{profesor.data.valoracion.promedio === null ? "—" : profesor.data.valoracion.promedio.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</p>
        <div className={perfil.detalle}>
          <RankingValoracion valoracion={profesor.data.valoracion} comisiones={profesor.data.comisiones.length} />
        </div>
        {profesor.data.posicion !== null ? <Badge tone="solid"><Trophy size={14} strokeWidth={1.75} aria-hidden="true" focusable="false" />Puesto {profesor.data.posicion} del ranking</Badge> : null}
      </div></Card>
      <section className={styles.section} aria-labelledby={comisionesId}>
        <h2 id={comisionesId} className={styles.sectionTitle}>Por comisión</h2>
        {profesor.data.comisiones.length ? <RankingList positions={false} label="Valoración por comisión" entries={profesor.data.comisiones.map((item, index) => ({
          id: item.comision.id,
          href: rutas.comision(item, rutas.profesor(profesorId)),
          posicion: index + 1,
          title: `Comisión ${item.comision.nombre} · ${item.materia.nombre}`,
          detail: [carreraLabel(item.comision.carrera), periodoLabel(item.cursada.anio, item.cursada.cuatrimestre), item.cargo ? cargoLabel(item.cargo) : null].filter(Boolean).join(" · "),
          valoracion: item.valoracion,
        }))} /> : <p role="status" className={styles.empty}>Todavía nadie lo valoró en sus comisiones.</p>}
      </section>
      <section className={styles.section} aria-labelledby={comentariosId}>
        <h2 id={comentariosId} className={styles.sectionTitle}>Comentarios</h2>
        {reported ? <Notice tone="success">El reporte se envió correctamente. El equipo administrativo lo revisará.</Notice> : null}
        <PaginatedListView resetKey={`comentarios-profesor:${profesorId}:${reported}`} page={page} onPageChange={setPage} loadingMessage="Cargando comentarios…"
          errorMessage="Lo sentimos. No pudimos recuperar los comentarios."
          fetchPage={(next) => listarFeedback({ page: next, pageSize: 9, profesorId })}
          empty={<p role="status" className={styles.empty}>Todavía no hay comentarios sobre este profesor.</p>}>
          {(result) => <>
            <div className={styles.summary}><p className={styles.total}>{result.total === 1 ? "1 comentario" : `${result.total} comentarios`}</p><p>{rangoMostrado(result.page, result.pageSize, result.items.length, result.total)}</p></div>
            <ul className={feedbackStyles.experienceList}>{result.items.map((feedback) => <li key={feedback.id}>
              <ExperienceCard feedback={feedback} onReported={() => { setReported(value => value + 1); profesor.retry(); }} showContext administrative={admin} returnTo={admin ? rutas.profesor(profesorId) : undefined} onManage={() => router.push(feedbackDetalleHref(feedback.id))} />
            </li>)}</ul>
          </>}
        </PaginatedListView>
      </section>
    </>}
  </section>;
}

function RankingValoracion({ valoracion, comisiones }: { valoracion: { promedio: number | null; cantidad: number }; comisiones: number }) {
  if (valoracion.promedio === null) return <p className={perfil.texto}>Sin valoraciones todavía.</p>;
  const votos = valoracion.cantidad === 1 ? "1 valoración" : `${valoracion.cantidad} valoraciones`;
  return <>
    <p className={perfil.titulo}>de 5 estrellas</p>
    <p className={perfil.texto}>{votos} en {comisiones === 1 ? "1 comisión" : `${comisiones} comisiones`}</p>
  </>;
}
