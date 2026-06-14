"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui";

type DataPaginationProps = {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  itemLabel: string;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
};

type PaginationItem =
  | { type: "page"; value: number }
  | { type: "ellipsis"; key: string };

function buildPaginationItems(page: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => ({
      type: "page" as const,
      value: index + 1,
    }));
  }

  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const normalizedPages = Array.from(pages)
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);

  const items: PaginationItem[] = [];

  normalizedPages.forEach((value, index) => {
    const previous = normalizedPages[index - 1];

    if (typeof previous === "number" && value - previous > 1) {
      if (value - previous === 2) {
        items.push({ type: "page", value: previous + 1 });
      } else {
        items.push({ type: "ellipsis", key: `${previous}-${value}` });
      }
    }

    items.push({ type: "page", value });
  });

  return items;
}

export function DataPagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  itemLabel,
  isLoading = false,
  onPageChange,
}: DataPaginationProps) {
  const visibleItems = buildPaginationItems(page, totalPages);
  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-1">
        <div className="px-2.5 py-1 text-sm text-slate-600">
          Menampilkan <span className="text-slate-900">{startItem}-{endItem}</span>{" "}
          dari <span className="text-slate-900">{totalCount}</span> {itemLabel}
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="px-2.5 py-1 text-sm text-slate-600">
          Halaman <span className="text-slate-900">{page}</span> /{" "}
          <span className="text-slate-900">{totalPages}</span>
        </div>
      </div>
      <div className="flex w-fit max-w-full self-start flex-wrap items-center gap-1 rounded-lg border bg-card p-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={page <= 1 || isLoading}
          onClick={() => onPageChange(1)}
          aria-label="Halaman pertama"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={page <= 1 || isLoading}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {visibleItems.map((item) =>
          item.type === "ellipsis" ? (
            <span
              key={item.key}
              className="flex min-w-8 items-center justify-center px-1 text-sm text-slate-500"
              aria-hidden="true"
            >
              ...
            </span>
          ) : (
            <Button
              key={item.value}
              type="button"
              variant={item.value === page ? "default" : "ghost"}
              size="sm"
              className="min-w-8 px-2"
              disabled={isLoading}
              onClick={() => onPageChange(item.value)}
              aria-label={`Halaman ${item.value}`}
            >
              {item.value}
            </Button>
          ),
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={page >= totalPages || isLoading}
          onClick={() => onPageChange(page < totalPages ? page + 1 : page)}
          aria-label="Halaman berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={page >= totalPages || isLoading}
          onClick={() => onPageChange(totalPages)}
          aria-label="Halaman terakhir"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default DataPagination;
