"use client";

import Link from "next/link";
import { useState } from "react";
import { crearComision, listarCursadasPorMateria, listarMaterias } from "@/services/academic";
import { MAX_PAGE_SIZE } from "@/services/pagination";
import { useAllPages } from "@/hooks/useAllPages";
import { periodoLabel } from "@/lib/format/periodo";
import { MAX_NOMBRE_COMISION, validateNombre, validateSeleccion } from "@/validations/academic";
import { FormField } from "@/components/ui/FormField";
import { AltaForm } from "./AltaForm";
import { bloqueoDeOpciones, opcionesListas } from "./opciones";

export function AltaComision() {
  // La materia no es parte del alta: solo acota qué cursadas se pueden elegir, porque el backend
  // lista cursadas por materia (GET /materias/:id/cursadas).
  const [materiaId, setMateriaId] = useState("");
  const materias = useAllPages("materias", (page) => listarMaterias({ page, pageSize: MAX_PAGE_SIZE }));
  const cursadas = useAllPages(materiaId, (page) => listarCursadasPorMateria(materiaId, { page, pageSize: MAX_PAGE_SIZE }));

  const filtro = <FormField
    name="materia-filtro"
    label="Materia"
    hint="Primero elegí la materia para ver sus cursadas."
    options={opcionesListas(materias.state).map((materia) => ({ value: materia.id, label: materia.nombre }))}
    value={materiaId}
    onChange={setMateriaId}
    required={false}
  />;

  return <AltaForm
    breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: "Nueva comisión" }]}
    heading="Nueva comisión"
    description="La comisión pertenece a una cursada. Dos cursadas distintas pueden tener comisiones con el mismo nombre, pero dentro de una cursada el nombre no se repite."
    submitLabel="Crear comisión"
    filter={filtro}
    blocked={bloqueoDeOpciones([
      { ...materias, nombre: "materias", vacio: <>Todavía no hay materias cargadas. <Link href="/home/admin/materias/nueva">Crear una materia</Link> antes de dar de alta una comisión.</> },
      {
        ...cursadas,
        nombre: "cursadas",
        // Con `materiaId` vacío `useAllPages` no pide nada y devuelve una lista vacía.
        vacio: materiaId
          ? <>Esta materia todavía no tiene cursadas. <Link href="/home/admin/cursadas/nueva">Crear una cursada</Link> antes de dar de alta una comisión.</>
          : <>Elegí una materia para ver sus cursadas.</>,
      },
    ])}
    fields={[
      {
        name: "cursadaId",
        label: "Cursada",
        options: opcionesListas(cursadas.state).map((cursada) => ({ value: cursada.id, label: `${periodoLabel(cursada.anio, cursada.cuatrimestre)} — ${cursada.profesor}` })),
        // La lista de cursadas cambia al cambiar de materia: no alcanza con que haya algo elegido,
        // tiene que seguir perteneciendo a la materia visible.
        validate: (value) => validateSeleccion(value) ?? (opcionesListas(cursadas.state).some((cursada) => cursada.id === value) ? undefined : "Elegí una cursada de la materia seleccionada."),
      },
      { name: "nombre", label: "Nombre de la comisión", hint: `Hasta ${MAX_NOMBRE_COMISION} caracteres.`, validate: (value) => validateNombre(value, MAX_NOMBRE_COMISION) },
    ]}
    onSubmit={async (values) => {
      const comision = await crearComision({ cursadaId: values.cursadaId, nombre: values.nombre.trim() });
      return `Comisión creada: ${comision.nombre}.`;
    }}
  />;
}
