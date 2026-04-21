"use client";

import { useEffect, useState } from "react";

import { API_CALENDAR } from "@/constants/api";
import { authFetch } from "@/lib/auth";

export type CalendarEvent = {
  id: string;
  source: "schedule" | "booking" | string;
  title: string;
  start_time: string;
  end_time?: string | null;
  room_id?: string | null;
  room_name?: string | null;
  room_number?: string | null;
  requested_by_name?: string | null;
  attendee_count?: number | null;
  purpose?: string | null;
};

export function useCalendarEvents(
  start?: string,
  end?: string,
  filters: { room?: string } = {},
  reloadKey = 0,
  enabled = true,
) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) {
      setEvents([]);
      setError("");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    let isAborted = false;

    const load = async () => {
      setIsLoading(true);
      setError("");

      try {
        const url = new URL(API_CALENDAR, window.location.origin);
        if (start) url.searchParams.set("start", start);
        if (end) url.searchParams.set("end", end);
        if (filters.room) url.searchParams.set("room", filters.room);

        const response = await authFetch(url.toString(), {
          method: "GET",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Gagal memuat agenda kalender (${response.status})`);
        }

        const payload = (await response.json().catch(() => [])) as CalendarEvent[];
        setEvents(Array.isArray(payload) ? payload : []);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Terjadi kesalahan saat memuat agenda.",
        );
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
  }, [start, end, filters.room, reloadKey, enabled]);

  return {
    events,
    setEvents,
    isLoading,
    error,
    setError,
  };
}

export default useCalendarEvents;
