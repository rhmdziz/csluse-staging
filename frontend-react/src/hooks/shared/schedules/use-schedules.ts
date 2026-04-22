"use client";

import { useEffect, useState } from "react";

import { API_SCHEDULES } from "@/constants/api";
import { authFetch } from "@/lib/auth";

export type ScheduleCategory =
  | "Practicum";

export type ScheduleItem = {
  id: string | number;
  title: string;
  class_name?: string | null;
  description: string;
  start_time: string;
  end_time: string;
  category: ScheduleCategory | string;
  room?: string | number | null;
  room_detail?: {
    id?: string | number | null;
    name?: string | null;
  } | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type ScheduleListResponse = {
  count?: number;
  results?: ScheduleItem[];
};

export type ScheduleFilters = {
  search?: string;
  room?: string;
  isActive?: string;
  start?: string;
  end?: string;
};

export function useSchedules(
  page: number,
  pageSize = 10,
  filters: ScheduleFilters = {},
  reloadKey = 0,
) {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
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
        const url = new URL(API_SCHEDULES, window.location.origin);
        url.searchParams.set("page", String(page));
        url.searchParams.set("page_size", String(pageSize));
        if (filters.search) url.searchParams.set("search", filters.search);
        if (filters.room) url.searchParams.set("room", filters.room);
        if (filters.isActive) url.searchParams.set("is_active", filters.isActive);
        if (filters.start) url.searchParams.set("start", filters.start);
        if (filters.end) url.searchParams.set("end", filters.end);

        const response = await authFetch(url.toString(), {
          method: "GET",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Gagal memuat jadwal (${response.status})`);
        }

        const payload = (await response.json()) as ScheduleListResponse | ScheduleItem[];
        const items = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.results)
            ? payload.results
            : [];

        setSchedules(items);
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
    filters.isActive,
    filters.start,
    filters.end,
    reloadKey,
  ]);

  return {
    schedules,
    setSchedules,
    totalCount,
    setTotalCount,
    isLoading,
    error,
    setError,
  };
}

export function useAllSchedules(
  filters: ScheduleFilters = {},
  reloadKey = 0,
) {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let isAborted = false;

    const buildUrl = (page: number, pageSize: number) => {
      const url = new URL(API_SCHEDULES, window.location.origin);
      url.searchParams.set("page", String(page));
      url.searchParams.set("page_size", String(pageSize));
      if (filters.search) url.searchParams.set("search", filters.search);
      if (filters.room) url.searchParams.set("room", filters.room);
      if (filters.isActive) url.searchParams.set("is_active", filters.isActive);
      if (filters.start) url.searchParams.set("start", filters.start);
      if (filters.end) url.searchParams.set("end", filters.end);
      return url;
    };

    const load = async () => {
      setIsLoading(true);
      setError("");

      try {
        const firstPageSize = 100;
        const firstResponse = await authFetch(buildUrl(1, firstPageSize).toString(), {
          method: "GET",
          signal: controller.signal,
        });

        if (!firstResponse.ok) {
          throw new Error(`Gagal memuat jadwal (${firstResponse.status})`);
        }

        const firstPayload = (await firstResponse.json()) as
          | ScheduleListResponse
          | ScheduleItem[];

        const firstItems = Array.isArray(firstPayload)
          ? firstPayload
          : Array.isArray(firstPayload.results)
            ? firstPayload.results
            : [];
        const count = Array.isArray(firstPayload)
          ? firstItems.length
          : (firstPayload.count ?? firstItems.length);

        const totalPages = Math.max(1, Math.ceil(count / firstPageSize));
        if (totalPages === 1) {
          setSchedules(firstItems);
          setTotalCount(count);
          return;
        }

        const remainingResponses = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) =>
            authFetch(buildUrl(index + 2, firstPageSize).toString(), {
              method: "GET",
              signal: controller.signal,
            }),
          ),
        );

        const failedResponse = remainingResponses.find((response) => !response.ok);
        if (failedResponse) {
          throw new Error(`Gagal memuat jadwal (${failedResponse.status})`);
        }

        const remainingPayloads = (await Promise.all(
          remainingResponses.map((response) => response.json()),
        )) as Array<ScheduleListResponse | ScheduleItem[]>;

        const remainingItems = remainingPayloads.flatMap((payload) =>
          Array.isArray(payload)
            ? payload
            : Array.isArray(payload.results)
              ? payload.results
              : [],
        );

        setSchedules([...firstItems, ...remainingItems]);
        setTotalCount(count);
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
    filters.search,
    filters.room,
    filters.isActive,
    filters.start,
    filters.end,
    reloadKey,
  ]);

  return {
    schedules,
    setSchedules,
    totalCount,
    setTotalCount,
    isLoading,
    error,
    setError,
  };
}

export default useSchedules;
