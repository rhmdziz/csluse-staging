"use client";

import { useEffect, useRef, useState } from "react";

import {
  labClearanceService,
  type LabClearanceFilters,
  type LabClearanceListItem,
} from "@/services/lab-clearance";

export function useLabClearanceList(
  page: number,
  pageSize: number,
  scope: "my" | "all" = "my",
  reloadKey = 0,
  filters: LabClearanceFilters = {},
) {
  const [items, setItems] = useState<LabClearanceListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    labClearanceService
      .getList(page, pageSize, filters, scope, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          if (result.ok) {
            setItems(result.results);
            setTotalCount(result.count);
          } else {
            setError("Gagal memuat data permohonan.");
          }
          setHasLoadedOnce(true);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          if (err instanceof Error && err.name !== "AbortError") {
            setError("Terjadi kesalahan jaringan.");
          }
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    filters.batch,
    filters.createdAfter,
    filters.createdBefore,
    filters.ordering,
    filters.requestedBy,
    filters.search,
    filters.status,
    page,
    pageSize,
    reloadKey,
    scope,
  ]);

  return { items, totalCount, isLoading, hasLoadedOnce, error };
}
