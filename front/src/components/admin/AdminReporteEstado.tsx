import { Badge } from "@/components/ui/Badge";
import type { ReporteEstado } from "@/types/feedback-reportes";

const estados = {
  ABIERTO: { label: "Abierto", tone: "upcoming" },
  RESUELTO: { label: "Resuelto", tone: "solid" },
  DESESTIMADO: { label: "Desestimado", tone: "outline" },
} as const;

export function AdminReporteEstado({ estado }: { estado: ReporteEstado }) {
  const { label, tone } = estados[estado];
  return <Badge tone={tone}>{label}</Badge>;
}
