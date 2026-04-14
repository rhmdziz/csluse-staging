"use client";

import { useEffect, useState } from "react";

import { API_SCHEDULE_FEED } from "@/constants/api";
import { authFetch } from "@/lib/auth";
import type { ScheduleItem } from "@/hooks/shared/schedules";

export type ScheduleFeedRow = {
  id: string;
  source: "schedule" | "booking";
  source_id: string;
  title: string;
  room_name?: string | null;
  room_number?: string | null;
  start_time: string;
  end_time?: string | null;
  category_label: string;
  schedule_item?: ScheduleItem | null;
};

type ScheduleFeedResponse = {
  count?: number;
  results?: ScheduleFeedRow[];
};

type ScheduleFeedFilters = {
  search?: string;
  room?: string;
  source?: string;
  start?: string;
  end?: string;
  ordering?: string;
};

export function useScheduleFeed(
  page: number,
  pageSize = 20,
  filters: ScheduleFeedFilters = {},
  reloadKey = 0,
) {
  const [rows, setRows] = useState<ScheduleFeedRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let isAborted = false;

    const load = async () => {
      setIsLoading(true);
      setError("");

      try {
        const url = new URL(API_SCHEDULE_FEED, window.location.origin);
        url.searchParams.set("page", String(page));
        url.searchParams.set("page_size", String(pageSize));
        if (filters.search) url.searchParams.set("search", filters.search);
        if (filters.room) url.searchParams.set("room", filters.room);
        if (filters.source) url.searchParams.set("source", filters.source);
        if (filters.start) url.searchParams.set("start", filters.start);
        if (filters.end) url.searchParams.set("end", filters.end);
        if (filters.ordering) url.searchParams.set("ordering", filters.ordering);

        const response = await authFetch(url.toString(), {
          method: "GET",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Gagal memuat feed jadwal (${response.status})`);
        }

        const payload = (await response.json()) as ScheduleFeedResponse | ScheduleFeedRow[];
        const items = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.results)
            ? payload.results
            : [];

        setRows(items);
        setTotalCount(Array.isArray(payload) ? items.length : (payload.count ?? items.length));
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Terjadi kesalahan.");
      } finally {
        if (isAborted || controller.signal.aborted) return;
        setIsLoading(false);
      }
    };

    void load();

    return () => {
      isAborted = true;
      controller.abort();
    };
  }, [
    page,
    pageSize,
    filters.search,
    filters.room,
    filters.source,
    filters.start,
    filters.end,
    filters.ordering,
    reloadKey,
  ]);

  return {
    rows,
    setRows,
    totalCount,
    setTotalCount,
    isLoading,
    error,
    setError,
  };
}

export default useScheduleFeed;
