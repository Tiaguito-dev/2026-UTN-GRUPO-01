"use client";

import { useId } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { PaginatedListView } from "@/components/ui/PaginatedListView";
import { FilterChips } from "@/components/ui/FilterChips";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { listarRankingComisiones } from "@/services/ranking";
import { carreraLabel } from "@/lib/format/carrera";
import { periodoLabel } from "@/lib/format/periodo";
import { RankingList, rangoMostrado } from "./RankingList";
import { rutasRanking } from "./rutas";
import styles from "./Ranking.module.css";

const MINIMOS = [{ value: "1", label: "Todas" }, { value: "3", label: "Con 3 o más" }, { value: "5", label: "Con 5 o más" }] as const;
type Minimo = typeof MINIMOS[number]["value"];
const isMinimo = (value: string | null): value is Minimo => MINIMOS.some((option) => option.value === value);

export function ComisionesRanking({ admin = false }: { admin?: boolean }) {
  const rutas = rutasRanking(admin);
  const headingId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const rawMin = params.get("min");
  const min: Minimo = isMinimo(rawMin) ? rawMin : "1";
  const { page, setPage } = useUrlPagination();

  return <section className={styles.page} aria-labelledby={headingId}>
    <div className={styles.pageHeader}>
      <PageHeader id={headingId} title="Ranking de comisiones" back={rutas.origen}
        breadcrumb={[{ label: rutas.origen.label, href: rutas.origen.href }, { label: "Ranking de comisiones" }]}
        description="Las comisiones mejor valoradas de todas las materias, según las estrellas de sus experiencias." />
    </div>
    <FilterChips label="Mínimo de valoraciones" options={[...MINIMOS]} value={min}
      onChange={(next) => router.replace(next === "1" ? pathname : `${pathname}?${new URLSearchParams({ min: next })}`, { scroll: false })} />
    <PaginatedListView resetKey={`ranking-comisiones:${min}`} page={page} onPageChange={setPage} loadingMessage="Cargando ranking…"
      errorMessage="Lo sentimos. No pudimos recuperar el ranking de comisiones. Intentá nuevamente."
      fetchPage={(next) => listarRankingComisiones({ page: next, pageSize: 10, minValoraciones: Number(min) })}
      empty={<p role="status" className={styles.empty}>{min === "1" ? "Todavía no hay comisiones con valoraciones." : `Ninguna comisión tiene ${min} valoraciones o más todavía.`}</p>}>
      {(result) => <>
        <div className={styles.summary}>
          <p className={styles.total}>{result.total === 1 ? "1 comisión" : `${result.total} comisiones`} con valoraciones</p>
          <p>{rangoMostrado(result.page, result.pageSize, result.items.length, result.total)}</p>
        </div>
        <RankingList label="Ranking de comisiones" entries={result.items.map((item) => ({
          id: item.comision.id,
          href: rutas.comision(item, rutas.comisiones),
          posicion: item.posicion,
          title: `Comisión ${item.comision.nombre} · ${item.materia.nombre}`,
          detail: `${carreraLabel(item.comision.carrera)} · ${periodoLabel(item.cursada.anio, item.cursada.cuatrimestre)}${item.comision.activa ? "" : " · Inactiva"}`,
          valoracion: item.valoracion,
        }))} />
      </>}
    </PaginatedListView>
  </section>;
}
