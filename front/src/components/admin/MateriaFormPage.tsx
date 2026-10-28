"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { safeAdminReturnTo } from "@/validations/admin";
import type { Materia } from "@/types/materias";
import {
  isAnioCarrera,
  isCarrera,
  materiaListHref,
  parseMateriaContext,
  parseMateriaPage,
} from "@/validations/materias";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { MateriaForm } from "./MateriaForm";

export function MateriaFormPage({ materia, detailHref }: { materia?: Materia; detailHref?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = safeAdminReturnTo(params.get("returnTo"));

  const listContext = new URL(detailHref ?? "/home/materias", "https://local.invalid").searchParams;
  const listCarrera = listContext.get("carrera");
  const listYear = listContext.get("anioCarrera");
  const backList = materiaListHref(
    isCarrera(listCarrera) ? listCarrera : undefined,
    isAnioCarrera(listYear) ? listYear : undefined,
    parseMateriaPage(listContext.get("listadoPage")),
    parseMateriaContext(listContext)
  );

  return (
    <section aria-labelledby="materia-form-heading">
      <PageHeader
        id="materia-form-heading"
        title={materia ? "Editar materia" : "Nueva materia"}
        description="Definí el nombre, la modalidad y las carreras de la materia."
        back={returnTo ? { href: returnTo, label: "listado administrativo" } : { href: materia ? detailHref ?? `/home/materias/${encodeURIComponent(materia.id)}` : backList, label: materia?.nombre ?? "Materias" }}
        breadcrumb={[{ label: returnTo ? "Administración" : "Materias", href: returnTo ?? backList }, ...(materia ? [{ label: materia.nombre, href: detailHref ?? `/home/materias/${encodeURIComponent(materia.id)}` }] : []), { label: materia ? "Editar materia" : "Nueva materia" }]}
      />
      <Card variant="panel">
        <MateriaForm
          materia={materia}
          onSuccess={(saved) => {
            const target = returnTo ?? (materia ? detailHref ?? `/home/materias/${encodeURIComponent(materia.id)}` : "/home/materias");
            const message = materia ? "Materia actualizada correctamente." : `Materia creada: ${saved.nombre}.`;
            router.push(`${target}${target.includes("?") ? "&" : "?"}successMessage=${encodeURIComponent(message)}`);
          }}
        />
      </Card>
    </section>
  );
}
