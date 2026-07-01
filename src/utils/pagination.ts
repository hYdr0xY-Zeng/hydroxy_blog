export type PaginationLink = {
  href: string;
  label: string;
  current: boolean;
};

export function pageHref(basePath: string, page: number) {
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return page <= 1 ? base : `${base}page/${page}/`;
}

export function pageRouteParam(page: number) {
  return page <= 1 ? undefined : `page/${page}`;
}

export function pageCount(totalItems: number, pageSize: number) {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function paginateItems<T>(items: T[], currentPage: number, pageSize: number, basePath: string) {
  const totalPages = pageCount(items.length, pageSize);
  const page = Math.min(Math.max(currentPage, 1), totalPages);
  const start = (page - 1) * pageSize;
  const visibleItems = items.slice(start, start + pageSize);
  const pages: PaginationLink[] = Array.from({ length: totalPages }, (_, index) => {
    const pageNumber = index + 1;
    return {
      href: pageHref(basePath, pageNumber),
      label: String(pageNumber),
      current: pageNumber === page
    };
  });

  return {
    items: visibleItems,
    currentPage: page,
    totalPages,
    totalItems: items.length,
    previousHref: page > 1 ? pageHref(basePath, page - 1) : undefined,
    nextHref: page < totalPages ? pageHref(basePath, page + 1) : undefined,
    pages
  };
}
