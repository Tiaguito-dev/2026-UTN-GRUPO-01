"use client";

import { useSearchParams } from "next/navigation";
import { ComunidadPageContent } from "./ComunidadPageContent";

/** El guard del segmento ADMIN protege esta variante; la vista USER conserva su contrato. */
export function ComunidadAdminPageContent() {
  const params = useSearchParams();
  return <ComunidadPageContent administrative updated={params.get("actualizada") === "1"} />;
}
