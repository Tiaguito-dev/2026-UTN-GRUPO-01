"use client";

import { Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { ValoracionMateria } from "@/components/academic/ValoracionMateria";
import { listarRankingComisionesDeCursada } from "@/services/ranking";
import type { ResumenValoracionMateria } from "@/types/materias";
import styles from "./ValoracionComision.module.css";

export interface ValoracionesCursada { porComision: Map<string, ResumenValoracionMateria>; mejor: string | null }

const VACIO: ValoracionesCursada = { porComision: new Map(), mejor: null };

/**
 * Ratings of every commission of a cursada, from the commission ranking filtered by cursada. The
 * stars are a complement to the cards: if the request fails, the cards render without them.
 */
export function useValoracionesCursada(cursadaId: string): ValoracionesCursada {
  const [result, setResult] = useState<{ cursadaId: string; data: ValoracionesCursada } | null>(null);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => listarRankingComisionesDeCursada(cursadaId)).then((items) => {
      if (!active) return;
      const porComision = new Map(items.map((item) => [item.comision.id, item.valoracion]));
      // "Best" only means something when there is someone to compare with.
      setResult({ cursadaId, data: { porComision, mejor: items.length > 1 ? items[0]!.comision.id : null } });
    }).catch(() => { if (active) setResult({ cursadaId, data: VACIO }); });
    return () => { active = false; };
  }, [cursadaId]);
  return result?.cursadaId === cursadaId ? result.data : VACIO;
}

/** Stars line of a commission card, plus "Mejor valorada" on the best one of its cursada. */
export function ValoracionComision({ comisionId, valoraciones }: { comisionId: string; valoraciones: ValoracionesCursada }) {
  return <span className={styles.valoracion}>
    {valoraciones.mejor === comisionId ? <Badge tone="solid"><Trophy size={13} strokeWidth={1.75} aria-hidden="true" focusable="false" />Mejor valorada</Badge> : null}
    <ValoracionMateria valoracion={valoraciones.porComision.get(comisionId) ?? { promedio: null, cantidad: 0 }} />
  </span>;
}
