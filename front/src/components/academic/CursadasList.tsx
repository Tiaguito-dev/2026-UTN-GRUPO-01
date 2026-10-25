"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isAnioCarrera, isCarrera, parseMateriaPage, parseMateriaContext } from "@/validations/materias";
import { useId, useState } from "react";
import { listarCursadasPorMateria } from "@/services/academic";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { PaginatedListView } from "@/components/ui/PaginatedListView";
import { Notice } from "@/components/ui/Notice";
import { Dialog } from "@/components/ui/Dialog";
import { RowLink } from "@/components/ui/RowLink";
import { AltaCursada } from "@/components/admin/AltaCursada";
import { periodoLabel } from "@/lib/format/periodo";

export function CursadasList({ materiaId, materiaNombre, materiasHref = "/home/materias", embedded = false }: { materiaId: string; materiaNombre: string | undefined; materiasHref?: string; embedded?: boolean }) {
  const headingId = useId();
  const isAdmin = useIsAdmin();
  const context = useSearchParams();
  const materiaLabel = materiaNombre ?? "Materia";
  const { page, setPage } = useUrlPagination();
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const back = <Link href={materiasHref}>Volver al listado de materias</Link>;
  const rawCarrera = context.get("carrera");
  const carrera = isCarrera(rawCarrera) ? rawCarrera : undefined;
  const careerYear = context.get("anioCarrera"), listPage = parseMateriaPage(context.get("listadoPage"));
  const searchContext = parseMateriaContext(context);

  const query = new URLSearchParams();
  if (carrera) query.set("carrera", carrera);
  if (isAnioCarrera(careerYear)) query.set("anioCarrera", careerYear);
  if (listPage > 1) query.set("listadoPage", String(listPage));
  if (searchContext.q) query.set("q", searchContext.q);
  if (searchContext.nivelElectiva) query.set("nivelElectiva", searchContext.nivelElectiva);
  const search = query.size ? `?${query}` : "";

  // TASK-054: desde el detalle de materia, "Nueva cursada" abre un Dialog con la materia ya fija
  // (en vez de navegar a /home/admin/cursadas/nueva, que queda intacta como ruta directa).
  const nueva = isAdmin ? <button className="button" type="button" onClick={() => setCreating(true)}>Nueva cursada</button> : null;

  return <section aria-labelledby={headingId} className={embedded ? "academic-panel" : undefined}>
    {embedded ? <div className="academic-panel-header">
      <div>
        <h2 id={headingId}>Cursadas</h2>
        <p>Cada período en que se dictó, con sus comisiones y carreras.</p>
      </div>
      {nueva}
    </div> : <>
      <PageHeader
        id={headingId}
        title={materiaLabel}
        breadcrumb={[{ label: "Materias", href: materiasHref }, { label: materiaLabel }]}
        focusKey={materiaId}
        back={{ href: materiasHref, label: "Materias" }}
      />
      <p className="system-description">Períodos en los que se dictó esta materia.</p>
      {nueva}
    </>}
    {created ? <Notice tone="success">{created}</Notice> : null}
    {isAdmin ? <Dialog open={creating} onClose={() => setCreating(false)} title="Nueva cursada" description={`Una cursada es el dictado de ${materiaLabel} en un año y cuatrimestre.`} busy={saving}>
      {creating ? <AltaCursada materiaId={materiaId} onCancel={() => setCreating(false)} onBusyChange={setSaving} onSuccess={(message) => {
        setCreating(false);
        setCreated(message);
        setRefreshKey((key) => key + 1);
      }} /> : null}
    </Dialog> : null}
    <div className="academic-panel-body">
      <PaginatedListView resetKey={materiaId} refreshKey={refreshKey} page={page} onPageChange={setPage} fetchPage={(next) => listarCursadasPorMateria(materiaId, { page: next })} loadingMessage="Cargando cursadas…"
        notFoundAction={back} empty={<p className="academic-empty"><strong>Esta materia todavía no tiene cursadas cargadas.</strong>{isAdmin ? " Creá la primera con el botón Nueva cursada: la materia ya va a venir elegida." : null}{embedded ? null : <> {back}</>}</p>}>
        {(result) => Array.from(new Set(result.items.map((cursada) => cursada.anio))).map((anio) => <div key={anio}>
          <h3 className="academic-group-label">{anio}</h3>
          <ul className="row-list">
            {result.items.filter((cursada) => cursada.anio === anio).map((cursada) => {
              const comisionesTexto = cursada.comisiones === 1 ? "1 comisión" : `${cursada.comisiones} comisiones`;
              const profesoresTexto = cursada.profesores === 1 ? "1 profesor" : `${cursada.profesores} profesores`;
              return <RowLink
                key={cursada.id}
                href={`/home/materias/${materiaId}/cursadas/${cursada.id}${search}`}
                detail={<>
                  {`${comisionesTexto} · ${profesoresTexto}`}
                  {cursada.carreras.map((carrera) => <span key={carrera} className="academic-tag">{carrera}</span>)}
                </>}
                trailing="Ver comisiones"
              >
                {periodoLabel(cursada.anio, cursada.cuatrimestre)}
              </RowLink>;
            })}
          </ul>
        </div>)}
      </PaginatedListView>
    </div>
  </section>;
}
