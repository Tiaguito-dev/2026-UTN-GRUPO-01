"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { crearComision, listarCursadasPorMateria, listarMaterias, obtenerCursada } from "@/services/academic";
import type { Carrera } from "@/types/materias";
import { MAX_PAGE_SIZE } from "@/services/pagination";
import { useAllPages } from "@/hooks/useAllPages";
import { periodoLabel } from "@/lib/format/periodo";
import {
  NUMERO_COMISION_MAXIMO,
  NUMERO_COMISION_MINIMO,
  validateNumeroComision,
  validateSeleccion,
} from "@/validations/academic";
import { carreraLabel } from "@/validations/materias";
import { FormField } from "@/components/ui/FormField";
import { AltaForm } from "./AltaForm";
import { bloqueoDeOpciones, opcionesListas } from "./opciones";

export function AltaComision() {
  // TASK-043 decision 2: "Nueva comisión" from a cursada arrives with ?cursadaId; its materia comes
  // from the cursada detail. If that lookup fails, the admin picks both by hand.
  const cursadaInicial = useSearchParams().get("cursadaId") ?? "";
  const [materiaDeCursada, setMateriaDeCursada] = useState("");
  const [materiaElegida, setMateriaElegida] = useState<string>();
  const materiaId = materiaElegida ?? materiaDeCursada;
  useEffect(() => {
    if (!cursadaInicial) return;
    let active = true;
    obtenerCursada(cursadaInicial).then((cursada) => { if (active) setMateriaDeCursada(cursada.materia.id); }, () => {});
    return () => { active = false; };
  }, [cursadaInicial]);
  const [carreraVal, setCarreraVal] = useState("");
  const [numeroVal, setNumeroVal] = useState("");

  const materias = useAllPages("materias", (page) => listarMaterias({ page, pageSize: MAX_PAGE_SIZE }));
  const cursadas = useAllPages(materiaId, (page) => listarCursadasPorMateria(materiaId, { page, pageSize: MAX_PAGE_SIZE }));

  const selectedMateria = opcionesListas(materias.state).find((m) => m.id === materiaId);
  const carrerasMateria: Carrera[] = selectedMateria?.carreras.map((c) => c.carrera) ?? [];

  const preview =
    carreraVal && /^[0-9]+$/u.test(numeroVal.trim()) && Number(numeroVal) >= 1 && Number(numeroVal) <= 999
      ? `${carreraVal}-${Number(numeroVal)}`
      : "";

  const filtro = (
    <FormField
      name="materia-filtro"
      label="Materia"
      hint="Primero elegí la materia para ver sus cursadas y carreras."
      options={opcionesListas(materias.state).map((materia) => ({ value: materia.id, label: materia.nombre }))}
      value={materiaId}
      onChange={(id) => {
        setMateriaElegida(id);
        setCarreraVal("");
      }}
      required={false}
    />
  );

  return (
    <AltaForm
      breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: "Nueva comisión" }]}
      heading="Nueva comisión"
      description="La comisión pertenece a una cursada y a una carrera. El nombre se genera automáticamente (por ejemplo: S-31)."
      submitLabel="Crear comisión"
      filter={filtro}
      blocked={bloqueoDeOpciones([
        {
          ...materias,
          nombre: "materias",
          vacio: (
            <>
              Todavía no hay materias cargadas. <Link href="/home/admin/materias/nueva">Crear una materia</Link> antes de dar de alta una comisión.
            </>
          ),
        },
        {
          ...cursadas,
          nombre: "cursadas",
          vacio: materiaId ? (
            <>
              Esta materia todavía no tiene cursadas. <Link href="/home/admin/cursadas/nueva">Crear una cursada</Link> antes de dar de alta una comisión.
            </>
          ) : (
            <>Elegí una materia para ver sus cursadas.</>
          ),
        },
      ])}
      fields={[
        {
          name: "cursadaId",
          label: "Cursada",
          options: opcionesListas(cursadas.state).map((cursada) => ({
            value: cursada.id,
            label: periodoLabel(cursada.anio),
          })),
          defaultValue: opcionesListas(cursadas.state).some((cursada) => cursada.id === cursadaInicial) ? cursadaInicial : undefined,
          validate: (value) =>
            validateSeleccion(value) ??
            (opcionesListas(cursadas.state).some((cursada) => cursada.id === value)
              ? undefined
              : "Elegí una cursada de la materia seleccionada."),
        },
        {
          name: "carrera",
          label: "Carrera",
          hint: materiaId ? undefined : "Elegí una materia para ver sus carreras disponibles.",
          options: carrerasMateria.map((c) => ({
            value: c,
            label: `${c} — ${carreraLabel(c)}`,
          })),
          onChange: setCarreraVal,
          validate: (value) =>
            validateSeleccion(value) ??
            (carrerasMateria.includes(value as Carrera)
              ? undefined
              : "Elegí una carrera de la materia seleccionada."),
        },
        {
          name: "numero",
          label: "Número de comisión",
          hint: preview ? `Vista previa del nombre: ${preview}` : `Un número entero entre ${NUMERO_COMISION_MINIMO} y ${NUMERO_COMISION_MAXIMO}.`,
          numeric: { min: NUMERO_COMISION_MINIMO, max: NUMERO_COMISION_MAXIMO },
          onChange: setNumeroVal,
          validate: validateNumeroComision,
        },
      ]}
      onSubmit={async (values) => {
        const comision = await crearComision({
          cursadaId: values.cursadaId,
          carrera: values.carrera as Carrera,
          numero: Number(values.numero.trim()),
        });
        return `Comisión creada: ${comision.nombre}.`;
      }}
    />
  );
}
