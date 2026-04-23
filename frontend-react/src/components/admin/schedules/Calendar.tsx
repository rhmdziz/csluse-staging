"use client";

import { MonthCalendar } from "@/components/shared";
import type { CalendarEvent } from "@/hooks/shared/calendar";

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function getCalendarDotClass(source: string) {
  if (source === "schedule") return "bg-sky-500";
  if (source === "booking") return "bg-emerald-500";
  return "bg-slate-500";
}

type CalendarProps = {
  events: CalendarEvent[];
  selectedDate: Date;
  onSelect: (value: Date) => void;
};

export default function Calendar({
  events,
  selectedDate,
  onSelect,
}: CalendarProps) {
  const renderCell = (date: Date) => {
    if (date.getDay() === 0 || date.getDay() === 6) return null;

    const sel = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayItems = events.filter((item) => {
      const start = new Date(item.start_time);
      const end = item.end_time ? new Date(item.end_time) : start;
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      return sel >= startDay && sel <= endDay;
    });

    if (!dayItems.length) return null;

    const hasBooking = dayItems.some((item) => item.source === "booking");
    const markerClass = hasBooking
      ? getCalendarDotClass("booking")
      : getCalendarDotClass("schedule");

    return (
      <div className="mt-1 flex justify-center">
        <span className={`block h-2 w-2 rounded-full ${markerClass}`} />
      </div>
    );
  };

  return (
    <MonthCalendar
      value={selectedDate}
      onSelect={onSelect}
      renderMarker={renderCell}
      className="inline-block w-fit max-w-full justify-self-start"
      contentClassName="w-[388px] max-w-full"
    />
  );
}
