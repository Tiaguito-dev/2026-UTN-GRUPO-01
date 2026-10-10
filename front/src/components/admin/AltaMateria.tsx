"use client";

import { crearMateria } from "@/services/academic";
import { validateNombre } from "@/validations/academic";
import { AltaForm } from "./AltaForm";

export function AltaMateria() {
  return <AltaForm
    breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: "Nueva materia" }]}
    heading="Nueva materia"
    description="La materia es el primer nivel de la jerarquía académica. Su nombre no puede repetirse."
    submitLabel="Crear materia"
    fields={[{ name: "nombre", label: "Nombre de la materia", hint: "Hasta 150 caracteres.", validate: (value) => validateNombre(value, 150) }]}
    onSubmit={async (values) => {
      const materia = await crearMateria({ nombre: values.nombre.trim() });
      return `Materia creada: ${materia.nombre}.`;
    }}
  />;
}
