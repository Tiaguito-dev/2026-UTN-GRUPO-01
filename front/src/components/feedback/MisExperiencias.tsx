"use client";
import Link from "next/link";
import { listarFeedbackPropios } from "@/services/feedback";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { PaginatedListView } from "@/components/ui/PaginatedListView";
import { feedbackDetalleHref } from "@/validations/feedback";
import { ExperienceCard } from "./ExperienceCard";
import { FeedbackModerationStatus } from "./FeedbackModerationStatus";
import styles from "./feedback.module.css";

export function MisExperiencias() {
  const { page, setPage } = useUrlPagination();
  const origin = new URLSearchParams({ origen: "experiencias", experienciasSeccion: "propias", experienciasPage: String(page) });
  return <PaginatedListView resetKey="mis-experiencias" page={page} onPageChange={setPage}
    fetchPage={(next) => listarFeedbackPropios({ page: next, pageSize: 9 })}
    loadingMessage="Cargando tus experiencias…" empty={<p>Todavía no compartiste experiencias.</p>}>
    {(result) => <ul className={styles.experienceList}>{result.items.map((feedback) => <li key={feedback.id}>
      <ExperienceCard feedback={feedback} showContext origin={origin} readOnly />
      <FeedbackModerationStatus feedback={feedback} />
      <Link className="button button-secondary" href={feedbackDetalleHref(feedback.id, origin)}>Ver mi experiencia</Link>
    </li>)}</ul>}
  </PaginatedListView>;
}
