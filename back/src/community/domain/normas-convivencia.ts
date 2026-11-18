/** Documento único vigente de Comunidad; las normas conservan su orden editorial. */
export interface NormasConvivencia {
  id: string;
  titulo: string;
  introduccion: string;
  normas: string[];
  cierre: string;
  createdAt: Date;
  updatedAt: Date;
}
