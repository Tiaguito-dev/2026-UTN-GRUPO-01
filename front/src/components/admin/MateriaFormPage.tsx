"use client";

import Link from "next/link";
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
        breadcrumb={[{ label: returnTo ? "Administración" : "Materias", href: returnTo ?? backList }, { label: materia ? "Editar materia" : "Nueva materia" }]}
        back={returnTo ? { href: returnTo, label: "listado administrativo" } : undefined}
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
      {materia && !returnTo ? (
        <div className="form-links">
          <Link href={detailHref ?? "/home/materias"}>Volver</Link>
        </div>
      ) : null}
    </section>
  );
}
