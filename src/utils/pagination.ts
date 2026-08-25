export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export function buildPagination(page: number, limit: number, total: number): Pagination {
  return { page, limit, total, pages: Math.ceil(total / limit) };
}
