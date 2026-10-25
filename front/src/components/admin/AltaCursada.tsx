"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { crearCursada, listarMaterias, type Cuatrimestre } from "@/services/academic";
import { MAX_PAGE_SIZE } from "@/services/pagination";
import { useAllPages } from "@/hooks/useAllPages";
import { CUATRIMESTRE_LABEL, periodoLabel } from "@/lib/format/periodo";
import { ANIO_MINIMO, anioMaximo, validateAnio, validateSeleccion } from "@/validations/academic";
import { AltaForm, AltaFormFields } from "./AltaForm";
import { bloqueoDeOpciones, opcionesListas } from "./opciones";

const isCuatrimestre = (value: string): value is Cuatrimestre => value === "PRIMERO" || value === "SEGUNDO";

export function AltaCursada({ materiaId: materiaIdProp, onSuccess, onCancel, onBusyChange }: {
  /** Fija la materia (TASK-054: detalle de materia en un `Dialog`), sin pasar por la URL. */
  materiaId?: string;
  /** Dentro del `Dialog`: cierra el modal y refresca el listado en vez de mostrar el mensaje en el lugar. */
  onSuccess?: (message: string) => void;
  onCancel?: () => void;
  onBusyChange?: (busy: boolean) => void;
} = {}) {
  const materias = useAllPages("materias", (page) => listarMaterias({ page, pageSize: MAX_PAGE_SIZE }));
  const maximo = anioMaximo();
  // TASK-043 decision 2 / TASK-054: la materia llega fija por prop (modal) o por ?materiaId (página).
  const params = useSearchParams();
  const materiaInicial = materiaIdProp ?? (params.get("materiaId") ?? "");
  const opcionesMateria = opcionesListas(materias.state);

  async function crear(materiaId: string, anio: string, cuatrimestre: string) {
    if (!isCuatrimestre(cuatrimestre)) throw new Error("Elegí un cuatrimestre de la lista.");
    const cursada = await crearCursada({ materiaId, anio: Number(anio.trim()), cuatrimestre });
    const materia = opcionesMateria.find((item) => item.id === cursada.materiaId)?.nombre ?? "la materia elegida";
    return `Cursada creada: ${materia}, ${periodoLabel(cursada.anio, cursada.cuatrimestre)}.`;
  }

  // TASK-054: materia fija desde el detalle (modal) es un formulario corto; "Alta en modal" de
  // frontend-pantallas.md usa AltaFormFields, sin el encabezado de página de AltaForm.
  if (materiaIdProp) {
    return <AltaFormFields
      submitLabel="Crear cursada"
      fields={[
        { name: "anio", label: "Año", hint: `Un año entre ${ANIO_MINIMO} y ${maximo}.`, numeric: { min: ANIO_MINIMO, max: maximo }, validate: validateAnio },
        { name: "cuatrimestre", label: "Cuatrimestre", options: [{ value: "PRIMERO", label: CUATRIMESTRE_LABEL.PRIMERO }, { value: "SEGUNDO", label: CUATRIMESTRE_LABEL.SEGUNDO }], validate: validateSeleccion },
      ]}
      onSubmit={(values) => crear(materiaIdProp, values.anio, values.cuatrimestre)}
      onSuccess={onSuccess}
      onCancel={onCancel}
      onBusyChange={onBusyChange}
    />;
  }

  return <AltaForm
    breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: "Nueva cursada" }]}
    heading="Nueva cursada"
    description="Una cursada es el dictado de una materia en un período. No puede repetirse la misma materia en el mismo año y cuatrimestre."
    submitLabel="Crear cursada"
    blocked={bloqueoDeOpciones([
      { ...materias, nombre: "materias", vacio: <>Todavía no hay materias cargadas. <Link href="/home/admin/materias/nueva">Crear una materia</Link> antes de dar de alta una cursada.</> },
    ])}
    fields={[
      { name: "materiaId", label: "Materia", options: opcionesMateria.map((materia) => ({ value: materia.id, label: materia.nombre })), defaultValue: opcionesMateria.some((materia) => materia.id === materiaInicial) ? materiaInicial : undefined, validate: validateSeleccion },
      { name: "anio", label: "Año", hint: `Un año entre ${ANIO_MINIMO} y ${maximo}.`, numeric: { min: ANIO_MINIMO, max: maximo }, validate: validateAnio },
      { name: "cuatrimestre", label: "Cuatrimestre", options: [{ value: "PRIMERO", label: CUATRIMESTRE_LABEL.PRIMERO }, { value: "SEGUNDO", label: CUATRIMESTRE_LABEL.SEGUNDO }], validate: validateSeleccion },
    ]}
    onSubmit={(values) => crear(values.materiaId, values.anio, values.cuatrimestre)}
  />;
}
