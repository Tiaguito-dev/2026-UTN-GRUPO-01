import { Star } from "lucide-react";
import type { ResumenValoracionMateria } from "@/types/materias";
import styles from "./ValoracionMateria.module.css";

const promedioFormat = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const cantidadFormat = new Intl.NumberFormat("es-AR");

export function ValoracionMateria({ valoracion }: { valoracion: ResumenValoracionMateria }) {
  return <span className={styles.resumen}>
    <Star className={styles.estrella} size={16} strokeWidth={1.75} aria-hidden="true" focusable="false" />
    {valoracion.promedio === null ? <span>Sin valoraciones</span> : <>
      <span>{promedioFormat.format(valoracion.promedio)} de 5 estrellas</span>
      <span>{cantidadFormat.format(valoracion.cantidad)} {valoracion.cantidad === 1 ? "valoración" : "valoraciones"}</span>
    </>}
  </span>;
}
