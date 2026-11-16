import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { ResumenValoracionMateria } from "@/types/materias";
import { ValoracionMateria } from "@/components/academic/ValoracionMateria";
import styles from "./RankingList.module.css";

export interface RankingEntry {
  id: string;
  href: string;
  /** null: shown without a position (below the vote minimum or without votes). */
  posicion: number | null;
  title: ReactNode;
  detail?: ReactNode;
  valoracion: ResumenValoracionMateria;
}

/** Ranked rows with the same surface as the Materias list; the first three positions stand out. */
export function RankingList({ entries, label, positions = true }: { entries: RankingEntry[]; label: string; positions?: boolean }) {
  const List = positions ? "ol" : "ul";
  return <List className={styles.rows} aria-label={label}>
    {entries.map((entry) => <li key={entry.id}>
      <Link className={styles.row} href={entry.href}>
        {positions ? <span className={`${styles.position}${entry.posicion !== null && entry.posicion <= 3 ? ` ${styles.top}` : ""}${entry.posicion === null ? ` ${styles.unranked}` : ""}`}
          aria-label={entry.posicion === null ? "Sin puesto" : `Puesto ${entry.posicion}`}>{entry.posicion ?? "—"}</span> : null}
        <span className={styles.text}>
          <span className={styles.title}>{entry.title}</span>
          {entry.detail ? <span className={styles.detail}>{entry.detail}</span> : null}
          <ValoracionMateria valoracion={entry.valoracion} />
        </span>
        <ChevronRight className={styles.chevron} aria-hidden="true" focusable="false" size={18} strokeWidth={1.75} />
      </Link>
    </li>)}
  </List>;
}

/** "Mostrando 1–10 de 30", the summary line every paginated list in the app uses. */
export function rangoMostrado(page: number, pageSize: number, shown: number, total: number): string {
  const from = (page - 1) * pageSize + 1;
  return `Mostrando ${from}–${Math.min(total, from + shown - 1)} de ${total}`;
}
