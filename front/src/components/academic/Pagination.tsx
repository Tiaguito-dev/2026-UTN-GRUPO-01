export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return <nav aria-label="Paginación" className="pagination">
    <button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</button>
    <span role="status">Página {page} de {totalPages}</span>
    <button type="button" aria-label="Página siguiente" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Siguiente</button>
  </nav>;
}
