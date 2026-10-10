export interface Comision {
  id: string;
  cursadaId: string;
  nombre: string;
  activa: boolean;
  createdAt: Date;
  deletedAt: Date | null;
}
