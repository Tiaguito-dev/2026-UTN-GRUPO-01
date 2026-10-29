"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { adminCreationHref, adminSuccessHref, safeAdminReturnTo } from "@/validations/admin";
import type { Materia } from "@/types/materias";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { MateriaForm } from "./MateriaForm";

export function MateriaFormPage({ materia }: { materia?: Materia }) {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = safeAdminReturnTo(params.get("returnTo"));

  const backList = "/home/admin/materias";
  const detailHref = materia ? `/home/admin/materias/${encodeURIComponent(materia.id)}${returnTo ? `?${new URLSearchParams({ returnTo })}` : ""}` : undefined;

  return (
    <section aria-labelledby="materia-form-heading">
      <PageHeader
        id="materia-form-heading"
        title={materia ? "Editar materia" : "Nueva materia"}
        description="Definí el nombre, la modalidad y las carreras de la materia."
        back={{ href: returnTo ?? detailHref ?? backList, label: "contexto administrativo" }}
        breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: "Materias", href: backList }, ...(materia ? [{ label: materia.nombre, href: detailHref }] : []), { label: materia ? "Editar materia" : "Nueva materia" }]}
      />
      <Card variant="panel">
        <MateriaForm
          materia={materia}
          onSuccess={(saved) => {
            const target = materia ? detailHref! : returnTo ?? backList;
            const message = materia ? "Materia actualizada correctamente." : `Materia creada: ${saved.nombre}.`;
            router.push(materia ? adminSuccessHref(target, message) : adminCreationHref(target, message, saved));
            router.refresh();
          }}
        />
      </Card>
    </section>
  );
}
