import { es } from '../i18n/es';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPage }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  return (
    <nav className="pagination" aria-label={es.pagination.label}>
      <button
        type="button"
        className="button button--secondary"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        {es.pagination.previous}
      </button>
      <span aria-live="polite">{es.pagination.status(page, pages)}</span>
      <button
        type="button"
        className="button button--secondary"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        {es.pagination.next}
      </button>
    </nav>
  );
}
