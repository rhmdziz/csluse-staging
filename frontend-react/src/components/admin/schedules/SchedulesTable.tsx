"use client";

import type { RefObject } from "react";
import { Eye, Loader2, Pencil, Trash2 } from "lucide-react";

import { TableActionIconButton } from "@/components/shared";
import type { ScheduleItem } from "@/hooks/shared/schedules";

export type ScheduleTableRow = {
  id: string | number;
  source: "schedule" | "booking";
  title: string;
  roomName: string;
  roomNumber?: string | null;
  startTime: string;
  endTime?: string | null;
  scheduleItem?: ScheduleItem;
};

function formatTimeWib(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const time = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return `${time} WIB`;
}

type SchedulesTableProps = {
  rows: ScheduleTableRow[];
  isLoading: boolean;
  emptyMessage?: string;
  selectedIds: Array<string | number>;
  allVisibleSelected: boolean;
  selectAllRef: RefObject<HTMLInputElement | null>;
  onToggleSelectAllVisible: (checked: boolean) => void;
  onToggleItemSelection: (item: ScheduleItem) => void;
  onView: (item: ScheduleItem) => void;
  onViewBooking: (bookingId: string | number) => void;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (item: ScheduleItem) => void;
};

export function SchedulesTable({
  rows,
  isLoading,
  emptyMessage = "Tidak ada data jadwal.",
  selectedIds,
  allVisibleSelected,
  selectAllRef,
  onToggleSelectAllVisible,
  onToggleItemSelection,
  onView,
  onViewBooking,
  onEdit,
  onDelete,
}: SchedulesTableProps) {
  return (
    <div className="w-full min-w-0 overflow-x-auto rounded border border-slate-200 bg-card [scrollbar-width:thin]">
      <table className="w-full min-w-[1028px] table-fixed">
        <thead className="border-b border-slate-800 bg-slate-900">
          <tr className="text-left text-sm">
            <th className="w-12 px-3 py-3 text-center font-medium text-slate-50">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 align-middle"
                checked={allVisibleSelected}
                onChange={(event) => onToggleSelectAllVisible(event.target.checked)}
                aria-label="Pilih semua jadwal yang tampil"
              />
            </th>
            <th className="w-[220px] px-3 py-3 font-medium text-slate-50">Judul</th>
            <th className="w-[140px] px-3 py-3 font-medium text-slate-50">Sumber</th>
            <th className="w-[180px] px-3 py-3 font-medium text-slate-50">Ruangan</th>
            <th className="w-[160px] px-3 py-3 font-medium text-slate-50">Tanggal</th>
            <th className="w-[180px] px-3 py-3 font-medium text-slate-50">Waktu Mulai</th>
            <th className="w-[180px] px-3 py-3 font-medium text-slate-50">Waktu Selesai</th>
            <th className="sticky right-0 z-10 relative w-[140px] bg-slate-900 px-3 py-3 text-center font-medium text-slate-50 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-700">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {isLoading ? (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              </td>
            </tr>
          ) : rows.length ? (
            rows.map((item) => {
              const isSchedule = item.source === "schedule" && Boolean(item.scheduleItem);
              return (
              <tr key={`${item.source}-${String(item.id)}`} className="border-b last:border-b-0">
                <td className="px-3 py-2 text-center align-middle">
                  {isSchedule ? (
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 align-middle"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => onToggleItemSelection(item.scheduleItem as ScheduleItem)}
                      aria-label={`Pilih jadwal ${item.title}`}
                    />
                  ) : (
                    <span className="inline-block h-4 w-4 rounded border border-dashed border-slate-200 bg-slate-50" />
                  )}
                </td>
                <td className="px-3 py-2 align-middle font-medium text-slate-900">
                  <div className="truncate">{item.title}</div>
                </td>
                <td className="px-3 py-2 align-middle">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      item.source === "schedule"
                        ? "bg-sky-100 text-sky-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {item.source === "schedule" ? "Jadwal Praktikum" : "Booking"}
                  </span>
                </td>
                <td className="px-3 py-2 align-middle text-muted-foreground">
                  {item.roomName
                    ? item.roomNumber
                      ? `${item.roomName} (${item.roomNumber})`
                      : item.roomName
                    : "-"}
                </td>
                <td className="px-3 py-2 align-middle">
                  {new Date(item.startTime).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-3 py-2 align-middle">{formatTimeWib(item.startTime)}</td>
                <td className="px-3 py-2 align-middle">{formatTimeWib(item.endTime)}</td>
                <td className="sticky right-0 z-10 relative bg-card px-3 py-2 align-middle before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200">
                  {isSchedule ? (
                    <div className="flex justify-center gap-2">
                      <TableActionIconButton
                        label="Lihat detail"
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => onView(item.scheduleItem as ScheduleItem)}
                        icon={<Eye className="h-4 w-4" />}
                      />
                      <TableActionIconButton
                        label="Edit jadwal"
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => onEdit(item.scheduleItem as ScheduleItem)}
                        icon={<Pencil className="h-4 w-4" />}
                      />
                      <TableActionIconButton
                        label="Hapus jadwal"
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => onDelete(item.scheduleItem as ScheduleItem)}
                        icon={<Trash2 className="h-4 w-4" />}
                      />
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <TableActionIconButton
                        label="Lihat booking"
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => onViewBooking(item.id)}
                        icon={<Eye className="h-4 w-4" />}
                      />
                    </div>
                  )}
                </td>
              </tr>
            )})
          ) : (
            <tr>
              <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default SchedulesTable;
