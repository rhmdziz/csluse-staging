"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { HourlyScheduleTable, InlineErrorAlert } from "@/components/shared";
import { useCalendarEvents } from "@/hooks/shared/calendar";
import type { CalendarEvent } from "@/hooks/shared/calendar";
import { parseDateKey } from "@/lib/date";
import { normalizeText } from "@/lib/text";

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function eventCoversDay(event: { start_time: string; end_time?: string | null }, date: Date) {
  const start = new Date(event.start_time);
  const end = event.end_time ? new Date(event.end_time) : new Date(event.start_time);
  const sel = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return sel >= startDay && sel <= endDay;
}

const wibDateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function adjustEventForDay(event: CalendarEvent, date: Date): CalendarEvent {
  const startDate = new Date(event.start_time);
  const endDate = event.end_time ? new Date(event.end_time) : startDate;
  if (isSameDay(startDate, endDate)) return event;

  const dayPrefix = wibDateFormatter.format(date);
  const isStartDay = isSameDay(startDate, date);
  const isEndDay = isSameDay(endDate, date);

  return {
    ...event,
    start_time: isStartDay ? event.start_time : `${dayPrefix}T08:00:00+07:00`,
    end_time: isEndDay ? event.end_time : `${dayPrefix}T17:00:00+07:00`,
  };
}

export default function SchedulePage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const roomFilter = searchParams.get("room") ?? "";
  const categoryFilter = searchParams.get("category") ?? "";
  const selectedDateParam = searchParams.get("date") ?? "";
  const selectedDate = selectedDateParam ? parseDateKey(selectedDateParam) ?? new Date() : new Date();
  const { events, error } = useCalendarEvents();

  const filteredEvents = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return events.filter((item) => {
      if (categoryFilter && item.source !== categoryFilter) return false;
      if (roomFilter && item.room_id !== roomFilter) return false;
      if (!normalizedQuery) return true;
      return normalizeText(`${item.title} ${item.room_name ?? ""}`).includes(normalizedQuery);
    });
  }, [categoryFilter, events, query, roomFilter]);

  const selectedDayEvents = useMemo(() => {
    if (isWeekend(selectedDate)) return [];
    return filteredEvents
      .filter((item) => eventCoversDay(item, selectedDate))
      .map((item) => adjustEventForDay(item, selectedDate))
      .sort(
        (left, right) =>
          new Date(left.start_time).getTime() -
          new Date(right.start_time).getTime(),
      );
  }, [filteredEvents, selectedDate]);

  return (
    <section className="space-y-4">
      {error ? (
        <InlineErrorAlert>{error}</InlineErrorAlert>
      ) : null}

      <HourlyScheduleTable
        events={selectedDayEvents}
        title={`Agenda ${selectedDate.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}`}
      />
    </section>
  );
}
