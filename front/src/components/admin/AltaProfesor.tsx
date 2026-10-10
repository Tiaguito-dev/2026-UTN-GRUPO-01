"use client";

import { crearProfesor } from "@/services/academic";
import { validateNombre } from "@/validations/academic";
import { AltaForm } from "./AltaForm";

export function AltaProfesor() {
  return <AltaForm
    breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: "Nuevo profesor" }]}
    heading="Nuevo profesor"
    description="El profesor queda disponible para asignarlo a las cursadas de cualquier materia."
    submitLabel="Crear profesor"
    fields={[{ name: "nombreCompleto", label: "Nombre completo", hint: "Hasta 150 caracteres.", validate: (value) => validateNombre(value, 150) }]}
    onSubmit={async (values) => {
      const profesor = await crearProfesor({ nombreCompleto: values.nombreCompleto.trim() });
      return `Profesor creado: ${profesor.nombreCompleto}.`;
    }}
  />;
}
