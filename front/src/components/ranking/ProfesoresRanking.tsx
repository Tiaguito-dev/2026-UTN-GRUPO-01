"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import { useId } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { PaginatedListView } from "@/components/ui/PaginatedListView";
import { SearchForm } from "@/components/ui/SearchForm";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { listarRankingProfesores, type RankingProfesor } from "@/services/ranking";
import { cargoLabel, validateMateriaSearch } from "@/validations/materias";
import { RankingList, rangoMostrado } from "./RankingList";
import { rutasRanking } from "./rutas";
import styles from "./Ranking.module.css";

const PAGE_SIZE = 10;

/** "Titular en 3 comisiones": the roles the professor holds where they were rated. */
function rolesResumen(item: RankingProfesor): string | undefined {
  if (!item.comisiones.length) return undefined;
  const cargos = [...new Set(item.comisiones.map((comision) => comision.cargo).filter((cargo) => cargo !== null))].map(cargoLabel);
  const cantidad = item.comisiones.length === 1 ? "1 comisión" : `${item.comisiones.length} comisiones`;
  return cargos.length ? `${cargos.join(" y ")} en ${cantidad}` : `Valorado en ${cantidad}`;
}

export function ProfesoresRanking({ admin = false }: { admin?: boolean }) {
  const rutas = rutasRanking(admin);
  const headingId = useId();
  const rankingId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const rawQ = params.get("q") ?? "";
  const q = validateMateriaSearch(rawQ) ? "" : rawQ.trim();
  const { page, setPage } = useUrlPagination();
  const search = (next: string) => router.replace(next ? `${pathname}?${new URLSearchParams({ q: next })}` : pathname, { scroll: false });

  return <section className={styles.page} aria-labelledby={headingId}>
    <div className={styles.header}>
      <div className={styles.pageHeader}>
        <PageHeader id={headingId} title={admin ? "Ranking de profesores" : "Profesores"} description="Los profesores mejor valorados por los estudiantes. Cada puesto junta las estrellas de todas las comisiones donde dictan." />
      </div>
      <Link className="button button-secondary" href={rutas.comisiones}><Trophy size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" />Ranking de comisiones</Link>
    </div>
    <div className={styles.panel}><SearchForm key={q} query={q} placeholder="Nombre del profesor" onSearch={search} /></div>
    <section className={styles.section} aria-labelledby={rankingId}>
      <h2 id={rankingId} className={styles.sectionTitle}><Trophy size={20} strokeWidth={1.75} aria-hidden="true" focusable="false" />{q ? "Resultados de la búsqueda" : "Ranking"}</h2>
      <PaginatedListView resetKey={`profesores:${q}`} page={page} onPageChange={setPage} loadingMessage="Cargando profesores…"
        errorMessage="Lo sentimos. No pudimos recuperar el ranking de profesores. Intentá nuevamente."
        fetchPage={(next) => listarRankingProfesores({ page: next, pageSize: PAGE_SIZE, q: q || undefined })}
        empty={q ? <div className={styles.empty}><p role="status">No hay profesores que coincidan con “{q}”.</p><button className="button button-secondary" type="button" onClick={() => search("")}>Limpiar búsqueda</button></div>
          : <p role="status" className={styles.empty}>Todavía no hay profesores con valoraciones. Aparecen acá cuando un estudiante comenta su comisión y lo elige como docente.</p>}>
        {(result) => <>
          <div className={styles.summary}>
            <p className={styles.total}>{q ? `${result.total === 1 ? "1 profesor" : `${result.total} profesores`} · “${q}”` : `${result.total === 1 ? "1 profesor" : `${result.total} profesores`} con valoraciones`}</p>
            <p>{rangoMostrado(result.page, result.pageSize, result.items.length, result.total)}</p>
          </div>
          <RankingList label={q ? "Profesores encontrados" : "Ranking de profesores"} entries={result.items.map((item) => ({
            id: item.profesor.id,
            href: rutas.profesor(item.profesor.id),
            posicion: item.posicion,
            title: item.profesor.nombreCompleto,
            detail: rolesResumen(item),
            valoracion: item.valoracion,
          }))} />
          {q && result.items.some((item) => item.posicion === null) ? <p className={styles.note}>Los profesores con pocas o ninguna valoración aparecen al final, sin puesto.</p> : null}
        </>}
      </PaginatedListView>
    </section>
  </section>;
}
