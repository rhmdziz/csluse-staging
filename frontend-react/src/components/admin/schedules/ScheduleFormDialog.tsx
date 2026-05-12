"use client";


import { format } from "date-fns";

import { ArrowUpRight, CalendarDays } from "lucide-react";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { USER_MODAL_WIDTH_CLASS } from "@/components/admin/user-management";

import { AdminDetailActions, AdminDetailDialogShell, InlineErrorAlert } from "@/components/shared";

import {
  Button,
  DatePicker,
  DialogFooter,
  Input,
  Textarea,
} from "@/components/ui";

import { toWibIsoString } from "@/lib/date";

const DIALOG_WIDTH_CLASS = `${USER_MODAL_WIDTH_CLASS} gap-0 p-0 [--primary:#0048B4] [--primary-foreground:#FFFFFF] [--ring:#3B82F6]`;

export type ScheduleCategory =
  | "Practicum";

export type ScheduleDetailMode = "view" | "edit";

export type ScheduleFormState = {
  title: string;
  className: string;
  description: string;
  category: ScheduleCategory;
  room: string;
  startTime: string;
  endTime: string;
};

export const SCHEDULE_CATEGORIES: ScheduleCategory[] = [
  "Practicum",
];

function combineDateTime(date: Date | undefined, time: string) {
  if (!date || !time) return "";
  return `${format(date, "yyyy-MM-dd")}T${time}`;
}

function updateDatePart(value: string, date: Date | undefined) {
  if (!date) return "";
  return `${format(date, "yyyy-MM-dd")}T${getTimeFromDateTime(value) || "00:00"}`;
}

function updateTimePart(value: string, time: string) {
  const currentDate = getDateFromDateTime(value);
  if (!currentDate) return value;
  return combineDateTime(currentDate, time);
}

function syncEndDateWithStart(startValue: string, endValue: string) {
  const startDate = getDateFromDateTime(startValue);
  if (!startDate) return endValue;
  const endTime = getTimeFromDateTime(endValue);
  return endTime ? combineDateTime(startDate, endTime) : "";
}

function getDateFromDateTime(value: string) {
  if (!value) return undefined;
  const [datePart] = value.split("T");
  if (!datePart) return undefined;
  const parsed = new Date(`${datePart}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function getTimeFromDateTime(value: string) {
  if (!value) return "";
  const [, timePart = ""] = value.split("T");
  return timePart.slice(0, 5);
}

function TimePickerField({
  id,
  label,
  value,
  onChange,
  disabled,
  minTime,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minTime?: string;
  className?: string;
}) {
  const selectedTime = getTimeFromDateTime(value);

  return (
    <label className={className ?? "space-y-2"}>
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <Input
        type="time"
        id={id}
        value={selectedTime}
        onChange={(event) => onChange(event.target.value)}
        step="60"
        min={minTime}
        placeholder="HH:MM"
        className="h-11 border-slate-300 bg-white px-3 focus-visible:border-slate-500 focus-visible:ring-[3px] focus-visible:ring-slate-200"
        disabled={disabled}
      />
    </label>
  );
}

function DateOnlyPickerField({
  label,
  value,
  onChange,
  disabled,
  className,
}: {
  label: string;
  value: Date | undefined;
  onChange: (value: Date | undefined) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={className ?? "space-y-2 md:col-span-2"}>
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <DatePicker
        value={value}
        onChange={onChange}
        disabled={disabled}
        defaultMonth={value}
        className="w-full"
        buttonClassName="w-full rounded-md border-sky-300 bg-sky-50/60 px-3 text-sm shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
      />
    </div>
  );
}

function ScheduleDetailField({
  label,
  value,
  multiline = false,
  onClick,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-700">{label}</p>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-sky-700 transition hover:text-sky-800"
        >
          {value || "-"}
          <ArrowUpRight className="ml-2 inline h-3.5 w-3.5 align-text-top text-sky-500" />
        </button>
      ) : (
        <div
          className={`rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 ${
            multiline ? "min-h-24 whitespace-pre-wrap break-words" : ""
          }`}
        >
          {value || "-"}
        </div>
      )}
    </div>
  );
}

export function validateScheduleForm(
  form: ScheduleFormState,
  setError: (message: string) => void,
) {
  const title = form.title.trim();
  const className = form.className.trim();
  const description = form.description.trim();
  const startTime = form.startTime.trim();
  const endTime = form.endTime.trim();

  if (!title) {
    setError("Judul jadwal wajib diisi.");
    return null;
  }
  if (!startTime || !endTime) {
    setError("Waktu mulai dan waktu selesai wajib diisi.");
    return null;
  }
  if (new Date(toWibIsoString(startTime)) >= new Date(toWibIsoString(endTime))) {
    setError("Waktu selesai harus setelah waktu mulai.");
    return null;
  }

  return {
    title,
    class_name: className || null,
    description,
    category: form.category,
    room: form.room || null,
    start_time: toWibIsoString(startTime),
    end_time: toWibIsoString(endTime),
  };
}

export function formatDateTimeLocalInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(date).replace(" ", "T");
}

export function ScheduleFormDialog({
  open,
  onOpenChange,
  title,
  description,
  readOnlyTitle,
  readOnlyDescription,
  initialMode = "edit",
  onCancelEdit,
  onDeleteRequest,
  onOpenRoomDetail,
  form,
  onChange,
  onSubmit,
  rooms,
  error,
  isSubmitting,
  trigger,
  useDetailHeader = false,
  readOnly = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  readOnlyTitle?: string;
  readOnlyDescription?: string;
  initialMode?: ScheduleDetailMode;
  onCancelEdit?: () => void;
  onDeleteRequest?: () => void;
  onOpenRoomDetail?: (roomId: string | number) => void;
  form: ScheduleFormState;
  onChange: (field: keyof ScheduleFormState, value: string | boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  rooms: Array<{ id: string | number; label: string }>;
  error: string;
  isSubmitting: boolean;
  trigger?: ReactNode;
  useDetailHeader?: boolean;
  readOnly?: boolean;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const openedInEditMode = initialMode === "edit";

  useEffect(() => {
    if (!open) return;
    setIsEditing(initialMode === "edit" && !readOnly);
  }, [initialMode, open, readOnly]);

  const isReadOnly = readOnly || !isEditing;
  const shellTitle = isReadOnly ? (readOnlyTitle ?? title) : title;
  const shellDescription =
    isReadOnly ? (readOnlyDescription ?? description) : description;

  const startDate = getDateFromDateTime(form.startTime);
  const startTime = getTimeFromDateTime(form.startTime);
  const minEndTime =
    startDate ? startTime || undefined : undefined;
  const roomLabel = rooms.find((room) => String(room.id) === form.room)?.label || "";

  return (
    <AdminDetailDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseReset={() => setIsEditing(false)}
      title={shellTitle}
      description={shellDescription}
      icon={<CalendarDays className="h-5 w-5" />}
      trigger={trigger}
      contentClassName={DIALOG_WIDTH_CLASS}
    >
      <form
        ref={formRef}
        className={`space-y-4 ${useDetailHeader ? "px-5 py-4 sm:px-6" : "px-6 pb-6"}`}
        onSubmit={onSubmit}
      >
        {isReadOnly ? (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ScheduleDetailField label="Judul Jadwal" value={form.title} />
              <ScheduleDetailField label="Kelas" value={form.className} />
              <ScheduleDetailField label="Waktu Mulai" value={form.startTime.replace("T", " ")} />
              <ScheduleDetailField label="Waktu Selesai" value={form.endTime.replace("T", " ")} />
              <ScheduleDetailField
                label="Ruangan"
                value={roomLabel || "Semua / Tidak spesifik"}
                onClick={
                  form.room && onOpenRoomDetail
                    ? () => onOpenRoomDetail(form.room)
                    : undefined
                }
              />
            </div>
            <ScheduleDetailField label="Deskripsi" value={form.description} multiline />
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-800">Judul Jadwal</span>
                <Input
                  value={form.title}
                  onChange={(event) => onChange("title", event.target.value)}
                  placeholder="Contoh: Praktikum Kimia Dasar"
                  className="h-11 border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-800">Kelas</span>
                <Input
                  value={form.className}
                  onChange={(event) => onChange("className", event.target.value)}
                  placeholder="Contoh: TI-2A"
                  className="h-11 border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
                />
              </label>

              <div className="grid grid-cols-1 gap-4 md:col-span-2 md:grid-cols-2">
                <DateOnlyPickerField
                  label="Tanggal"
                  value={startDate}
                  onChange={(nextDate) => {
                    const nextStart = updateDatePart(form.startTime, nextDate);
                    onChange("startTime", nextStart);
                    onChange("endTime", syncEndDateWithStart(nextStart, form.endTime));
                  }}
                  disabled={isSubmitting}
                  className="space-y-2"
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <TimePickerField
                    id="schedule-start-time-only"
                    label="Waktu Mulai"
                    value={form.startTime}
                    onChange={(value) => {
                      const nextStart = updateTimePart(form.startTime, value);
                      onChange("startTime", nextStart);
                      onChange("endTime", syncEndDateWithStart(nextStart, form.endTime));
                    }}
                    disabled={isSubmitting}
                    className="space-y-2"
                  />

                  <TimePickerField
                    id="schedule-end-time"
                    label="Waktu Selesai"
                    value={form.endTime}
                    onChange={(value) => onChange("endTime", updateTimePart(form.startTime, value))}
                    disabled={isSubmitting}
                    minTime={minEndTime}
                    className="space-y-2"
                  />
                </div>
              </div>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-800">Ruangan</span>
                <select
                  value={form.room}
                  onChange={(event) => onChange("room", event.target.value)}
                  className="h-11 w-full rounded-md border border-sky-300 bg-sky-50/60 px-3 text-sm text-slate-700 outline-none focus:border-sky-600 focus:ring-[3px] focus:ring-sky-200"
                >
                  <option value="">Semua / Tidak spesifik</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">Deskripsi</span>
              <Textarea
                value={form.description}
                onChange={(event) => onChange("description", event.target.value)}
                placeholder="Tambahkan detail jadwal, kelas, atau catatan lain."
                className="min-h-28 resize-y border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
              />
            </label>
          </>
        )}

        {error ? <InlineErrorAlert>{error}</InlineErrorAlert> : null}

        {trigger ? (
          <DialogFooter>
            <Button
              type="submit"
              className="bg-[#0052C7] text-white hover:bg-[#0048B4]"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        ) : (
          <AdminDetailActions
            isEditing={!isReadOnly}
            isSubmitting={isSubmitting}
            showDeleteAction={Boolean(onDeleteRequest)}
            deleteLabel="Hapus"
            saveLabel="Simpan Perubahan"
            onEdit={() => setIsEditing(true)}
            onCancelEdit={() => {
              setIsEditing(false);
              if (openedInEditMode) {
                onOpenChange(false);
                return;
              }
              if (onCancelEdit) {
                onCancelEdit();
                return;
              }
              onOpenChange(false);
            }}
            onSave={() => formRef.current?.requestSubmit()}
            onDelete={onDeleteRequest}
          />
        )}
      </form>
    </AdminDetailDialogShell>
  );
}
