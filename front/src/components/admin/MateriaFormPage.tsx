"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
        breadcrumb={[{ label: "Materias", href: backList }, { label: materia ? "Editar materia" : "Nueva materia" }]}
      />
      <Card variant="panel">
        <MateriaForm
          materia={materia}
          onSuccess={(saved) => {
            const target = materia ? detailHref ?? `/home/materias/${encodeURIComponent(materia.id)}` : "/home/materias";
            const message = materia ? "Materia actualizada correctamente." : `Materia creada: ${saved.nombre}.`;
            router.push(`${target}${target.includes("?") ? "&" : "?"}successMessage=${encodeURIComponent(message)}`);
          }}
        />
      </Card>
      {materia ? (
        <div className="form-links">
          <Link href={detailHref ?? "/home/materias"}>Volver</Link>
        </div>
      ) : null}
    </section>
  );
}
