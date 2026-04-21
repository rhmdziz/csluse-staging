"use client";


import type { DateRange } from "react-day-picker";

import { Calendar, HourlyScheduleTable, ScheduleFilters } from "@/components/admin/schedules";

import type { CalendarEvent } from "@/hooks/shared/calendar";

type RoomOption = {
  id: string | number;
  label: string;
};

type MonthKpi = {
  label: string;
  value: string;
  tone: string;
};

type CalendarTabContentProps = {
  filterOpen: boolean;
  query: string;
  roomFilter: string;
  sourceFilter: string;
  dateRange?: DateRange;
  rooms: RoomOption[];
  events: CalendarEvent[];
  selectedDate: Date;
  monthKpis: MonthKpi[];
  selectedDayEvents: CalendarEvent[];
  onToggleFilter: () => void;
  onResetFilter: () => void;
  onQueryChange: (value: string) => void;
  onRoomFilterChange: (value: string) => void;
  onSourceFilterChange: (value: string) => void;
  onDateRangeChange: (value: DateRange | undefined) => void;
  onSelectDate: (value: Date) => void;
};

export default function CalendarTabContent({
  filterOpen,
  query,
  roomFilter,
  sourceFilter,
  dateRange,
  rooms,
  events,
  selectedDate,
  monthKpis,
  selectedDayEvents,
  onToggleFilter,
  onResetFilter,
  onQueryChange,
  onRoomFilterChange,
  onSourceFilterChange,
  onDateRangeChange,
  onSelectDate,
}: CalendarTabContentProps) {
  return (
    <div className="space-y-4">
      <ScheduleFilters
        open={filterOpen}
        query={query}
        roomFilter={roomFilter}
        sourceFilter={sourceFilter}
        sourceOptions={[
          { value: "", label: "Semua Sumber" },
          { value: "schedule", label: "Jadwal Praktikum" },
          { value: "booking", label: "Booking" },
        ]}
        dateRange={dateRange}
        rooms={rooms}
        onToggle={onToggleFilter}
        onReset={onResetFilter}
        onQueryChange={onQueryChange}
        onRoomFilterChange={onRoomFilterChange}
        onSourceFilterChange={onSourceFilterChange}
        onDateRangeChange={onDateRangeChange}
      />

      <div className="grid items-start gap-4 xl:grid-cols-[auto_minmax(0,1fr)]">
        <Calendar
          events={events}
          selectedDate={selectedDate}
          onSelect={onSelectDate}
        />

        <div className="space-y-3">
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Ringkasan Bulan
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {selectedDate.toLocaleDateString("id-ID", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Rekap agenda otomatis berdasarkan bulan yang sedang dipilih.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 2xl:grid-cols-4">
              {monthKpis.map((item) => (
                <div
                  key={`sidebar-${item.label}`}
                  className={`rounded-2xl border border-slate-200 bg-gradient-to-br ${item.tone} px-4 py-4`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-3 text-3xl font-semibold leading-none text-slate-900">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tanggal Terpilih
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {selectedDate.toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Agenda harian difokuskan pada tabel per jam di bawah.
            </p>
          </article>
        </div>
      </div>

      <HourlyScheduleTable
        events={selectedDayEvents}
        title={`Agenda ${selectedDate.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}`}
      />
    </div>
  );
}
