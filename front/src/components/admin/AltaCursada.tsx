"use client";

import Link from "next/link";
import { crearCursada, listarMaterias, listarProfesores, type Cuatrimestre } from "@/services/academic";
import { MAX_PAGE_SIZE } from "@/services/pagination";
import { useAllPages } from "@/hooks/useAllPages";
import { CUATRIMESTRE_LABEL, periodoLabel } from "@/components/academic/periodo";
import { ANIO_MINIMO, anioMaximo, validateAnio, validateSeleccion } from "@/validations/academic";
import { AltaForm } from "./AltaForm";
import { bloqueoDeOpciones } from "./opciones";

export function AltaCursada() {
  const materias = useAllPages("materias", (page) => listarMaterias({ page, pageSize: MAX_PAGE_SIZE }));
  const profesores = useAllPages("profesores", (page) => listarProfesores({ page, pageSize: MAX_PAGE_SIZE }));
  const maximo = anioMaximo();

  return <AltaForm
    breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: "Nueva cursada" }]}
    heading="Nueva cursada"
    description="Una cursada es el dictado de una materia en un período, con un profesor a cargo. No puede repetirse la misma materia en el mismo año y cuatrimestre."
    submitLabel="Crear cursada"
    blocked={bloqueoDeOpciones([
      { ...materias, nombre: "materias", vacio: <>Todavía no hay materias cargadas. <Link href="/home/admin/materias/nueva">Crear una materia</Link> antes de dar de alta una cursada.</> },
      { ...profesores, nombre: "profesores", vacio: <>Todavía no hay profesores cargados. <Link href="/home/admin/profesores/nuevo">Crear un profesor</Link> antes de dar de alta una cursada.</> },
    ])}
    fields={[
      { name: "materiaId", label: "Materia", options: (materias.items ?? []).map((materia) => ({ value: materia.id, label: materia.nombre })), validate: validateSeleccion },
      { name: "profesorId", label: "Profesor", options: (profesores.items ?? []).map((profesor) => ({ value: profesor.id, label: profesor.nombreCompleto })), validate: validateSeleccion },
      { name: "anio", label: "Año", hint: `Un año entre ${ANIO_MINIMO} y ${maximo}.`, numeric: { min: ANIO_MINIMO, max: maximo }, validate: validateAnio },
      { name: "cuatrimestre", label: "Cuatrimestre", options: [{ value: "PRIMERO", label: CUATRIMESTRE_LABEL.PRIMERO }, { value: "SEGUNDO", label: CUATRIMESTRE_LABEL.SEGUNDO }], validate: validateSeleccion },
    ]}
    onSubmit={async (values) => {
      const cursada = await crearCursada({
        materiaId: values.materiaId,
        profesorId: values.profesorId,
        anio: Number(values.anio.trim()),
        cuatrimestre: values.cuatrimestre as Cuatrimestre,
      });
      const materia = materias.items?.find((item) => item.id === cursada.materiaId)?.nombre ?? "la materia elegida";
      return `Cursada creada: ${materia}, ${periodoLabel(cursada.anio, cursada.cuatrimestre)}.`;
    }}
  />;
}
