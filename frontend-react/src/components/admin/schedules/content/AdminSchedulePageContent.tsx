"use client";


import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { CalendarDays, FileUp, Plus } from "lucide-react";

import type { DateRange } from "react-day-picker";

import { AdminPageHeader } from "@/components/admin/shared";

import { CalendarTabContent, ScheduleTabContent } from "@/components/admin/schedules/content";

import {
  AdminRoomBookingHistoryDetailDialog as AdminRoomBookingRecordDetailDialog,
  RelatedRoomDetailDialog,
  RelatedUserDetailDialog,
} from "@/components/admin/history";

import {
  formatDateTimeLocalInput,
  type ScheduleCategory,
  type ScheduleDetailMode,
  ScheduleFormDialog,
  type ScheduleFormState,
  validateScheduleForm,
  ScheduleBulkCreateDialog,
  type ScheduleTableRow,
} from "@/components/admin/schedules";

import { ConfirmDeleteDialog, InlineErrorAlert } from "@/components/shared";

import { Button } from "@/components/ui";

import { useBookingDetail } from "@/hooks/booking-rooms";

import { useCalendarEvents } from "@/hooks/shared/calendar";

import { useRoomOptions } from "@/hooks/shared/resources/rooms";

import { useCreateSchedule } from "@/hooks/shared/schedules";

import { useDeleteSchedule } from "@/hooks/shared/schedules";

import {
  type ScheduleItem,
} from "@/hooks/shared/schedules";

import { useScheduleFeed } from "@/hooks/shared/schedules";

import { useUpdateSchedule } from "@/hooks/shared/schedules";

import { normalizeText } from "@/lib/text";

import { toEndOfDay, toStartOfDay } from "@/lib/date";

import { toast } from "sonner";

const PAGE_SIZE = 20;

const EMPTY_FORM: ScheduleFormState = {
  title: "",
  className: "",
  description: "",
  category: "Practicum",
  room: "",
  startTime: "",
  endTime: "",
};

function getYearBounds(date: Date) {
  const year = date.getFullYear();
  return {
    start: new Date(year, 0, 1, 0, 0, 0).toISOString(),
    end: new Date(year, 11, 31, 23, 59, 59).toISOString(),
  };
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isSameMonth(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

function isWithinRange(dateValue: string, range?: DateRange) {
  if (!range?.from && !range?.to) return true;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  if (range.from) {
    const start = new Date(range.from);
    start.setHours(0, 0, 0, 0);
    if (date < start) return false;
  }

  if (range.to) {
    const end = new Date(range.to);
    end.setHours(23, 59, 59, 999);
    if (date > end) return false;
  }

  return true;
}

export default function AdminSchedulePage() {
  const [activeTab, setActiveTab] = useState<"utama" | "kalender">("utama");
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [page, setPage] = useState(1);
  const [scheduleQuery, setScheduleQuery] = useState("");
  const [scheduleRoomFilter, setScheduleRoomFilter] = useState("");
  const [scheduleSourceFilter, setScheduleSourceFilter] = useState("");
  const [scheduleDateRange, setScheduleDateRange] = useState<DateRange | undefined>();
  const [scheduleSortOrder, setScheduleSortOrder] = useState("newest");
  const [scheduleFilterOpen, setScheduleFilterOpen] = useState(false);
  const [calendarQuery, setCalendarQuery] = useState("");
  const [calendarRoomFilter, setCalendarRoomFilter] = useState("");
  const [calendarSourceFilter, setCalendarSourceFilter] = useState("");
  const [calendarDateRange, setCalendarDateRange] = useState<DateRange | undefined>();
  const [calendarFilterOpen, setCalendarFilterOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkCreateOpen, setIsBulkCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ScheduleFormState>(EMPTY_FORM);
  const [detailTarget, setDetailTarget] = useState<ScheduleItem | null>(null);
  const [detailMode, setDetailMode] = useState<ScheduleDetailMode>("view");
  const [detailForm, setDetailForm] = useState<ScheduleFormState>(EMPTY_FORM);
  const [bookingDetailId, setBookingDetailId] = useState<string | number | null>(null);
  const [relatedRoomId, setRelatedRoomId] = useState<string | number | null>(null);
  const [relatedUserId, setRelatedUserId] = useState<string | number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const yearBounds = useMemo(() => getYearBounds(selectedDate), [selectedDate]);
  const { rooms } = useRoomOptions();
  const {
    booking: bookingDetail,
    isLoading: isBookingDetailLoading,
    error: bookingDetailError,
  } = useBookingDetail(bookingDetailId);
  const {
    events,
    error: calendarError,
  } = useCalendarEvents(undefined, undefined, { room: calendarRoomFilter }, reloadKey);
  const {
    rows,
    totalCount,
    isLoading: isSchedulesLoading,
    error: schedulesError,
    setError: setSchedulesError,
  } = useScheduleFeed(
    page,
    PAGE_SIZE,
    {
      search: scheduleQuery,
      room: scheduleRoomFilter,
      source: scheduleSourceFilter,
      start: scheduleDateRange?.from
        ? toStartOfDay(scheduleDateRange.from.toISOString().slice(0, 10))
        : yearBounds.start,
      end: scheduleDateRange?.to
        ? toEndOfDay(scheduleDateRange.to.toISOString().slice(0, 10))
        : scheduleDateRange?.from
          ? toEndOfDay(scheduleDateRange.from.toISOString().slice(0, 10))
          : yearBounds.end,
      ordering: scheduleSortOrder,
    },
    reloadKey,
  );
  const {
    createSchedule,
    isSubmitting: isCreating,
    errorMessage: createError,
    setErrorMessage: setCreateError,
  } = useCreateSchedule();
  const {
    updateSchedule,
    isSubmitting: isUpdating,
    errorMessage: updateError,
    setErrorMessage: setUpdateError,
  } = useUpdateSchedule();
  const {
    deleteSchedule,
    bulkDeleteSchedules,
    isDeleting,
    errorMessage: deleteError,
    setErrorMessage: setDeleteError,
  } = useDeleteSchedule();

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) =>
        rows.some(
          (item) => item.source === "schedule" && item.schedule_item?.id === id,
        ),
      ),
    );
  }, [rows]);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = normalizeText(calendarQuery);
    return events.filter((item) => {
      if (calendarRoomFilter && item.room_id !== calendarRoomFilter) return false;
      if (calendarSourceFilter && item.source !== calendarSourceFilter) return false;
      if (!isWithinRange(item.start_time, calendarDateRange)) return false;
      if (!normalizedQuery) return true;
      return normalizeText(
        `${item.title} ${item.room_name ?? ""} ${item.requested_by_name ?? ""}`,
      ).includes(normalizedQuery);
    });
  }, [events, calendarQuery, calendarRoomFilter, calendarSourceFilter, calendarDateRange]);

  const monthEvents = useMemo(() => {
    return filteredEvents.filter((item) =>
      isSameMonth(new Date(item.start_time), selectedDate),
    );
  }, [filteredEvents, selectedDate]);

  const monthKpis = useMemo(() => {
    const scheduleCount = monthEvents.filter((item) => item.source === "schedule").length;
    const bookingCount = monthEvents.filter((item) => item.source === "booking").length;
    const useCount = monthEvents.filter((item) => item.source === "use").length;
    const roomCount = new Set(
      monthEvents.map((item) => item.room_name).filter(Boolean),
    ).size;

    return [
      {
        label: "Agenda Bulan Ini",
        value: String(monthEvents.length),
        tone: "from-sky-500/15 to-sky-100",
      },
      {
        label: "Praktikum",
        value: String(scheduleCount),
        tone: "from-emerald-500/15 to-emerald-100",
      },
      {
        label: "Booking",
        value: String(bookingCount),
        tone: "from-amber-500/15 to-amber-100",
      },
      {
        label: "Penggunaan Alat",
        value: String(useCount),
        tone: "from-orange-500/15 to-orange-100",
      },
      {
        label: "Ruangan Terpakai",
        value: String(roomCount),
        tone: "from-violet-500/15 to-violet-100",
      },
    ];
  }, [monthEvents]);

  const selectedDayEvents = useMemo(() => {
    return filteredEvents
      .filter((item) => isSameDay(new Date(item.start_time), selectedDate))
      .sort(
        (left, right) =>
          new Date(left.start_time).getTime() - new Date(right.start_time).getTime(),
      );
  }, [filteredEvents, selectedDate]);

  const scheduleRows = useMemo<ScheduleTableRow[]>(
    () =>
      rows.map((item) => ({
        id: item.source_id,
        source: item.source,
        title: item.title,
        roomName: item.room_name ?? "-",
        roomNumber: item.room_number ?? null,
        startTime: item.start_time,
        endTime: item.end_time,
        scheduleItem:
          item.source === "schedule" && item.schedule_item ? item.schedule_item : undefined,
      })),
    [rows],
  );

  const visibleScheduleItems = useMemo(
    () =>
      scheduleRows
        .filter(
          (item): item is ScheduleTableRow & { scheduleItem: ScheduleItem } =>
            item.source === "schedule" && Boolean(item.scheduleItem),
        )
        .map((item) => item.scheduleItem),
    [scheduleRows],
  );

  const totalMergedCount = totalCount;
  const totalPages = Math.max(1, Math.ceil(totalMergedCount / PAGE_SIZE));
  const allVisibleSelected =
    visibleScheduleItems.length > 0 &&
    visibleScheduleItems.every((item) => selectedIds.includes(item.id));
  const someVisibleSelected =
    visibleScheduleItems.some((item) => selectedIds.includes(item.id)) &&
    !allVisibleSelected;
  const selectedCount = selectedIds.length;

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleCreateDialogChange = (open: boolean) => {
    setIsCreateOpen(open);
    if (!open) {
      setCreateForm(EMPTY_FORM);
      setCreateError("");
    }
  };

  const handleDetailDialogChange = (open: boolean) => {
    if (!open) {
      setDetailTarget(null);
      setDetailMode("view");
      setDetailForm(EMPTY_FORM);
      setUpdateError("");
    }
  };

  const handleDetailOpen = (item: ScheduleItem, mode: ScheduleDetailMode) => {
    setDetailTarget(item);
    setDetailMode(mode);
    setDetailForm({
      title: item.title,
      className: item.class_name ?? "",
      description: item.description ?? "",
      category: (item.category as ScheduleCategory) || "Practicum",
      room: item.room ? String(item.room) : "",
      startTime: formatDateTimeLocalInput(item.start_time),
      endTime: formatDateTimeLocalInput(item.end_time),
    });
    setUpdateError("");
  };

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError("");
    const payload = validateScheduleForm(createForm, setCreateError);
    if (!payload) return;

    const result = await createSchedule(payload);
    if (!result.ok) return;

    handleCreateDialogChange(false);
    setReloadKey((prev) => prev + 1);
    toast.success("Jadwal berhasil ditambahkan.");
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detailTarget) return;
    setUpdateError("");
    const payload = validateScheduleForm(detailForm, setUpdateError);
    if (!payload) return;

    const result = await updateSchedule(detailTarget.id, payload);
    if (!result.ok) return;

    handleDetailDialogChange(false);
    setReloadKey((prev) => prev + 1);
    toast.success("Jadwal berhasil diperbarui.");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError("");
    const result = await deleteSchedule(deleteTarget.id);
    if (!result.ok) {
      setSchedulesError(result.message || "Gagal menghapus jadwal.");
      return;
    }
    setDeleteTarget(null);
    setReloadKey((prev) => prev + 1);
    toast.success("Jadwal berhasil dihapus.");
  };

  const handleToggleItemSelection = (item: ScheduleItem) => {
    setSelectedIds((current) =>
      current.includes(item.id)
        ? current.filter((id) => id !== item.id)
        : [...current, item.id],
    );
  };

  const handleToggleSelectAllVisible = (checked: boolean) => {
    if (checked) {
      setSelectedIds((current) => {
        const next = new Set(current);
        visibleScheduleItems.forEach((item) => next.add(item.id));
        return Array.from(next);
      });
      return;
    }

    setSelectedIds((current) =>
      current.filter((id) => !visibleScheduleItems.some((item) => item.id === id)),
    );
  };

  const handleDeleteSelected = async () => {
    if (!selectedIds.length) return;
    setDeleteError("");
    const idsToDelete = [...selectedIds];
    const result = await bulkDeleteSchedules(idsToDelete);

    if (!result.ok) {
      setSchedulesError(result.message || "Gagal menghapus jadwal terpilih.");
      return;
    }

    const failedIds = (result.failedIds ?? []).map((id) => String(id));
    if (failedIds.length) {
      setSchedulesError(result.message || "Sebagian jadwal gagal dihapus.");
      setSelectedIds(failedIds);
      setBulkDeleteOpen(false);
      setReloadKey((prev) => prev + 1);
      return;
    }

    setSelectedIds([]);
    setBulkDeleteOpen(false);
    setReloadKey((prev) => prev + 1);
    toast.success(result.message || "Jadwal terpilih berhasil dihapus.");
  };

  return (
    <section className="space-y-4 px-4">
      <AdminPageHeader
        title="Jadwal"
        description="Kelola jadwal dan pantau agenda gabungan dari jadwal admin, peminjaman lab, dan penggunaan alat."
        icon={<CalendarDays className="h-5 w-5 text-blue-100" />}
      />

      <ScheduleFormDialog
        open={Boolean(detailTarget)}
        onOpenChange={handleDetailDialogChange}
        title="Edit Jadwal"
        description="Perbarui detail jadwal."
        readOnlyTitle="Detail Jadwal"
        readOnlyDescription="Tinjau detail jadwal."
        initialMode={detailMode}
        onCancelEdit={() => {
          if (!detailTarget) return;
          setDetailForm({
            title: detailTarget.title,
            className: detailTarget.class_name ?? "",
            description: detailTarget.description ?? "",
            category: (detailTarget.category as ScheduleCategory) || "Practicum",
            room: detailTarget.room ? String(detailTarget.room) : "",
            startTime: formatDateTimeLocalInput(detailTarget.start_time),
            endTime: formatDateTimeLocalInput(detailTarget.end_time),
          });
          setUpdateError("");
        }}
        onDeleteRequest={() => {
          if (!detailTarget) return;
          setDeleteTarget(detailTarget);
        }}
        form={detailForm}
        onChange={(field, value) => setDetailForm((prev) => ({ ...prev, [field]: value }))}
        onSubmit={handleEditSubmit}
        onOpenRoomDetail={setRelatedRoomId}
        rooms={rooms}
        error={updateError}
        isSubmitting={isUpdating}
        useDetailHeader
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => (!open ? setDeleteTarget(null) : null)}
        title="Hapus jadwal?"
        description="Jadwal yang dihapus tidak bisa dikembalikan."
        isDeleting={isDeleting}
        onConfirm={handleDelete}
      />

      <ConfirmDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Hapus jadwal terpilih?"
        description={`${selectedCount} jadwal yang dipilih akan dihapus permanen.`}
        isDeleting={selectedCount === 0 || isDeleting}
        onConfirm={handleDeleteSelected}
      />

      {calendarError ? (
        <InlineErrorAlert>{calendarError}</InlineErrorAlert>
      ) : null}
      {schedulesError ? (
        <InlineErrorAlert>{schedulesError}</InlineErrorAlert>
      ) : null}
      {deleteError ? (
        <InlineErrorAlert>{deleteError}</InlineErrorAlert>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("utama")}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "utama"
                ? "bg-gradient-to-r from-[#0052C7] via-[#0048B4] to-[#003C99] text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Jadwal
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("kalender")}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "kalender"
                ? "bg-gradient-to-r from-[#0052C7] via-[#0048B4] to-[#003C99] text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Preview Kalender
          </button>
        </div>
      </div>

      {activeTab === "utama" ? (
        <ScheduleTabContent
          filterOpen={scheduleFilterOpen}
          query={scheduleQuery}
          roomFilter={scheduleRoomFilter}
          sourceFilter={scheduleSourceFilter}
          dateRange={scheduleDateRange}
          sortOrder={scheduleSortOrder}
          rooms={rooms}
          rows={scheduleRows}
          isLoading={isSchedulesLoading}
          selectedIds={selectedIds}
          allVisibleSelected={allVisibleSelected}
          selectAllRef={selectAllRef}
          page={page}
          totalPages={totalPages}
          totalCount={totalMergedCount}
          pageSize={PAGE_SIZE}
          selectedCount={selectedCount}
          isDeleting={isDeleting}
          createAction={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ScheduleBulkCreateDialog
                open={isBulkCreateOpen}
                onOpenChange={setIsBulkCreateOpen}
                rooms={rooms}
                onCompleted={() => {
                  setReloadKey((prev) => prev + 1);
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => setIsBulkCreateOpen(true)}
              >
                <FileUp className="h-4 w-4" />  
                Import Jadwal
              </Button>
              <ScheduleFormDialog
                open={isCreateOpen}
                onOpenChange={handleCreateDialogChange}
                form={createForm}
                onChange={(field, value) =>
                  setCreateForm((prev) => ({ ...prev, [field]: value }))
                }
                onSubmit={handleCreateSubmit}
                rooms={rooms}
                title="Tambah Jadwal"
                description="Masukkan jadwal seperti praktikum tetap, maintenance, atau agenda laboratorium."
                error={createError}
                isSubmitting={isCreating}
                useDetailHeader
                trigger={
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#0052C7] text-white hover:bg-[#0048B4]"
                  >
                    <Plus className="h-4 w-4" />
                    Tambah Jadwal
                  </Button>
                }
              />
            </div>
          }
          onToggleFilter={() => setScheduleFilterOpen((prev) => !prev)}
          onResetFilter={() => {
            setScheduleQuery("");
            setScheduleRoomFilter("");
            setScheduleSourceFilter("");
            setScheduleDateRange(undefined);
            setScheduleSortOrder("newest");
            setPage(1);
          }}
          onClearSelection={() => setSelectedIds([])}
          onQueryChange={(value) => {
            setScheduleQuery(value);
            setPage(1);
          }}
          onRoomFilterChange={(value) => {
            setScheduleRoomFilter(value);
            setPage(1);
          }}
          onSourceFilterChange={(value) => {
            setScheduleSourceFilter(value);
            setPage(1);
          }}
          onDateRangeChange={(value) => {
            setScheduleDateRange(value);
            setPage(1);
          }}
          onSortOrderChange={(value) => {
            setScheduleSortOrder(value);
            setPage(1);
          }}
          onToggleSelectAllVisible={handleToggleSelectAllVisible}
          onToggleItemSelection={handleToggleItemSelection}
          onView={(item) => handleDetailOpen(item, "view")}
          onViewBooking={setBookingDetailId}
          onEdit={(item) => handleDetailOpen(item, "edit")}
          onDelete={(item) => setDeleteTarget(item)}
          onDeleteSelected={() => setBulkDeleteOpen(true)}
          onPageChange={setPage}
        />
      ) : (
        <CalendarTabContent
          filterOpen={calendarFilterOpen}
          query={calendarQuery}
          roomFilter={calendarRoomFilter}
          sourceFilter={calendarSourceFilter}
          dateRange={calendarDateRange}
          rooms={rooms}
          events={filteredEvents}
          selectedDate={selectedDate}
          monthKpis={monthKpis}
          selectedDayEvents={selectedDayEvents}
          onToggleFilter={() => setCalendarFilterOpen((prev) => !prev)}
          onResetFilter={() => {
            setCalendarQuery("");
            setCalendarRoomFilter("");
            setCalendarSourceFilter("");
            setCalendarDateRange(undefined);
          }}
          onQueryChange={setCalendarQuery}
          onRoomFilterChange={setCalendarRoomFilter}
          onSourceFilterChange={setCalendarSourceFilter}
          onDateRangeChange={setCalendarDateRange}
          onSelectDate={setSelectedDate}
        />
      )}

      <AdminRoomBookingRecordDetailDialog
        open={Boolean(bookingDetailId)}
        booking={bookingDetail}
        isLoading={isBookingDetailLoading}
        error={bookingDetailError}
        onOpenChange={(open) => {
          if (!open) setBookingDetailId(null);
        }}
        backLabel="Tutup"
        onOpenRoomDetail={setRelatedRoomId}
        onOpenUserDetail={setRelatedUserId}
      />

      <RelatedRoomDetailDialog
        open={Boolean(relatedRoomId)}
        roomId={relatedRoomId}
        onOpenChange={(open) => {
          if (!open) setRelatedRoomId(null);
        }}
      />

      <RelatedUserDetailDialog
        open={Boolean(relatedUserId)}
        userId={relatedUserId}
        onOpenChange={(open) => {
          if (!open) setRelatedUserId(null);
        }}
      />
    </section>
  );
}
