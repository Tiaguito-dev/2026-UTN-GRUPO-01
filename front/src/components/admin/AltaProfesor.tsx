"use client";
import { crearProfesor } from "@/services/academic";
import { MAX_NOMBRE_PROFESOR, validateNombre } from "@/validations/academic";
import { AltaForm, AltaFormFields } from "./AltaForm";
export function AltaProfesor({ onSuccess, onCancel, onBusyChange }: { onSuccess?: (message: string, nombreCompleto?: string) => void; onCancel?: () => void; onBusyChange?: (busy: boolean) => void } = {}) {
  const fields = [{ name: "nombreCompleto" as const, label: "Nombre completo", hint: `Hasta ${MAX_NOMBRE_PROFESOR} caracteres.`, validate: (value: string) => validateNombre(value, MAX_NOMBRE_PROFESOR) }];
  const onSubmit = async (values: { nombreCompleto: string }) => { const profesor = await crearProfesor({ nombreCompleto: values.nombreCompleto.trim() }); return `Profesor creado: ${profesor.nombreCompleto}.`; };
  if (onSuccess) return <AltaFormFields fields={fields} submitLabel="Crear profesor" onSubmit={onSubmit} onSuccess={(message, values) => onSuccess(message, values.nombreCompleto)} onCancel={onCancel} onBusyChange={onBusyChange} />;
  return <AltaForm defaultReturnTo="/home/admin/profesores" breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: "Nuevo profesor" }]} heading="Nuevo profesor" description="El profesor queda disponible para asignarlo a las comisiones." fields={fields} submitLabel="Crear profesor" onSubmit={onSubmit} />;
}
