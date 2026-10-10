/** Forma de paginación compartida por todos los listados del backend (ver docs/standards/paginacion.md). */
export interface PaginationInput { page?: number; pageSize?: number }
export interface PaginatedResult<T> { items: T[]; total: number; page: number; pageSize: number }

/** `pageSize` máximo que acepta el backend; sirve para poblar un <select> en pocas llamadas. */
export const MAX_PAGE_SIZE = 100;

export function toQuery(pagination: PaginationInput): string {
  const params = new URLSearchParams();
  if (pagination.page) params.set("page", String(pagination.page));
  if (pagination.pageSize) params.set("pageSize", String(pagination.pageSize));
  const text = params.toString();
  return text ? `?${text}` : "";
}
