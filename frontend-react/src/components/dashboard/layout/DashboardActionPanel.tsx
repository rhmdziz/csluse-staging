"use client";


import { useEffect, useMemo, useState, type ReactNode } from "react";

import type { DateRange } from "react-day-picker";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

import {
  ChevronRight,
  ChevronsLeft,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";

import Link from "next/link";

import { BatchInput, MonthCalendar } from "@/components/shared";

import { Button, DateRangePicker, Input } from "@/components/ui";

import {
  API_BOOKINGS_ALL_REQUESTERS,
  API_BORROWS_ALL_REQUESTERS,
} from "@/constants/api";

import {
  EQUIPMENT_CATEGORY_OPTIONS,
  EQUIPMENT_STATUS_OPTIONS,
} from "@/constants/equipments";
import { BATCH_OPTIONS } from "@/constants/batches";

import {
  MATERIAL_CATEGORY_OPTIONS,
  MATERIAL_STATUS_OPTIONS,
} from "@/constants/materials";

import { useChangePassword } from "@/hooks/auth";

import { useCalendarEvents } from "@/hooks/shared/calendar";

import { useEquipmentOptions } from "@/hooks/shared/resources/equipments";

import { useHistoryRequesterOptions } from "@/hooks/admin/history";

import { useRoomOptions } from "@/hooks/shared/resources/rooms";

import { formatDateKey, getEventDateKeys, parseDateKey } from "@/lib/date";

import {
  BORROW_STATUS_OPTIONS,
  REQUEST_STATUS_OPTIONS,
  SAMPLE_TESTING_STATUS_OPTIONS,
} from "@/lib/request";

const LAB_CLEARANCE_STATUS_OPTIONS = [
  { value: "", label: "Semua Status" },
  { value: "Pending", label: "Menunggu" },
  { value: "Approved", label: "Disetujui" },
  { value: "Rejected", label: "Ditolak" },
] as const;

const LAB_CLEARANCE_ORDERING_OPTIONS = [
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
] as const;

type DashboardActionPanelProps = {
  width: string;
  isOpen: boolean;
  mobile?: boolean;
  menu: {
    id: string;
    label: string;
    description: string;
    actions: Array<{ id: string; label: string; description: string }>;
  };
  menuParam: string | null;
  actionParam: string | null;
  canChangePassword: boolean;
  getActionHref: (actionId: string) => string;
  getMenuHref: () => string;
  onClose: () => void;
};

type RequestFilterConfig = {
  keyword: string;
  status: string;
  dateRange?: DateRange;
  placeholder: string;
  statusOptions: Array<{ value: string; label: string }>;
  extraFields?: ReactNode;
  onKeywordChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onDateRangeChange: (value: DateRange | undefined) => void;
  onReset: () => void;
};

type EquipmentFilterConfig = {
  keyword: string;
  category: string;
  room: string;
  onKeywordChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onRoomChange: (value: string) => void;
  onReset: () => void;
  status?: string;
  onStatusChange?: (value: string) => void;
};

type SoftwareFilterConfig = {
  keyword: string;
  equipment: string;
  onKeywordChange: (value: string) => void;
  onEquipmentChange: (value: string) => void;
  onReset: () => void;
};

type MaterialFilterConfig = {
  keyword: string;
  status: string;
  category: string;
  room: string;
  onKeywordChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onRoomChange: (value: string) => void;
  onReset: () => void;
};

const FILTER_CONTROL_CLASS =
  "h-8 w-full rounded-md border border-slate-200 px-2.5 text-xs outline-none transition focus:border-[#0048B4]";

const FILTER_BUTTON_CLASS = "h-8 w-full px-2 text-xs";

function FilterCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#D2DDED] bg-white p-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <div className="mt-1.5 space-y-1.5">{children}</div>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <label className="text-[11px] font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function DebouncedSearchInput({
  value,
  onChange,
  placeholder,
  className = "h-8 text-xs placeholder:text-xs",
  delay = 350,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  delay?: number;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (draft !== value) {
        onChange(draft);
      }
    }, delay);

    return () => window.clearTimeout(timeoutId);
  }, [delay, draft, onChange, value]);

  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      type="search"
      placeholder={placeholder}
      className={className}
    />
  );
}

function AnimatedFilterSection({
  show,
  children,
}: {
  show: boolean;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden={!show}
      className={`overflow-hidden transition-all duration-250 ease-out ${
        show
          ? "mt-3 max-h-[1200px] translate-y-0 opacity-100"
          : "pointer-events-none mt-0 max-h-0 -translate-y-1 opacity-0"
      }`}
    >
      <div className={show ? "pt-0" : "pt-0"}>{children}</div>
    </div>
  );
}

export function DashboardActionPanel({
  width,
  isOpen,
  mobile = false,
  menu,
  menuParam,
  actionParam,
  canChangePassword,
  getActionHref,
  getMenuHref,
  onClose,
}: DashboardActionPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const needsRoomOptions =
    menu.id === "schedule" ||
    menu.id === "booking-rooms" ||
    menu.id === "borrow-equipment";
  const { rooms } = useRoomOptions(needsRoomOptions);
  const { equipments: softwareEquipmentOptionsList } = useEquipmentOptions(
    "",
    "",
    menu.id === "booking-rooms",
    undefined,
    "Computer",
  );
  const { equipments: borrowEquipmentOptionsList } = useEquipmentOptions(
    "",
    "",
    menu.id === "borrow-equipment",
    true,
    "",
    true,
  );
  const isScheduleMenu = menu.id === "schedule";
  const scheduleKeyword = searchParams.get("q") ?? "";
  const scheduleRoom = searchParams.get("room") ?? "";
  const scheduleCategory = searchParams.get("category") ?? "";
  const { events: scheduleCalendarEvents } = useCalendarEvents(
    undefined,
    undefined,
    isScheduleMenu && scheduleRoom ? { room: scheduleRoom } : {},
    0,
    isScheduleMenu,
  );
  const scheduleDate = searchParams.get("date") ?? "";
  const bookingKeyword = searchParams.get("q") ?? "";
  const bookingStatus = searchParams.get("status") ?? "";
  const bookingRoom = searchParams.get("room") ?? "";
  const bookingRequester = searchParams.get("requested_by") ?? "";
  const bookingCreatedAfter = searchParams.get("created_after") ?? "";
  const bookingCreatedBefore = searchParams.get("created_before") ?? "";
  const borrowKeyword = searchParams.get("q") ?? "";
  const borrowStatus = searchParams.get("status") ?? "";
  const borrowEquipment = searchParams.get("equipment") ?? "";
  const borrowRequester = searchParams.get("requested_by") ?? "";
  const borrowCreatedAfter = searchParams.get("created_after") ?? "";
  const borrowCreatedBefore = searchParams.get("created_before") ?? "";
  const labClearanceKeyword = searchParams.get("q") ?? "";
  const labClearanceStatus = searchParams.get("status") ?? "";
  const labClearanceBatch = searchParams.get("batch") ?? "";
  const labClearanceOrdering = searchParams.get("ordering") ?? "newest";
  const labClearanceCreatedAfter = searchParams.get("created_after") ?? "";
  const labClearanceCreatedBefore = searchParams.get("created_before") ?? "";
  const bookingCreatedRange: DateRange | undefined =
    bookingCreatedAfter || bookingCreatedBefore
      ? {
          from: bookingCreatedAfter ? parseDateKey(bookingCreatedAfter) : undefined,
          to: bookingCreatedBefore ? parseDateKey(bookingCreatedBefore) : undefined,
        }
      : undefined;
  const borrowCreatedRange: DateRange | undefined =
    borrowCreatedAfter || borrowCreatedBefore
      ? {
          from: borrowCreatedAfter ? parseDateKey(borrowCreatedAfter) : undefined,
          to: borrowCreatedBefore ? parseDateKey(borrowCreatedBefore) : undefined,
        }
      : undefined;
  const labClearanceCreatedRange: DateRange | undefined =
    labClearanceCreatedAfter || labClearanceCreatedBefore
      ? {
          from: labClearanceCreatedAfter ? parseDateKey(labClearanceCreatedAfter) : undefined,
          to: labClearanceCreatedBefore ? parseDateKey(labClearanceCreatedBefore) : undefined,
        }
      : undefined;
  const visibleScheduleCalendarDates = useMemo(() => {
    if (!isScheduleMenu) return new Set<string>();
    const normalizedScheduleQuery = scheduleKeyword.trim().toLowerCase();

    return new Set(
      scheduleCalendarEvents.flatMap((item) => {
        if (scheduleCategory && item.source !== scheduleCategory) return [];
        if (normalizedScheduleQuery) {
          const haystack = `${item.title} ${item.room_name ?? ""} ${item.requested_by_name ?? ""}`
            .trim()
            .toLowerCase();
          if (!haystack.includes(normalizedScheduleQuery)) return [];
        }

        return getEventDateKeys(item.start_time, item.end_time);
      }),
    );
  }, [
    isScheduleMenu,
    scheduleCalendarEvents,
    scheduleCategory,
    scheduleKeyword,
  ]);
  const roomKeyword = searchParams.get("q") ?? "";
  const roomFloor = searchParams.get("floor") ?? "";
  const equipmentKeyword = searchParams.get("q") ?? "";
  const equipmentStatus = searchParams.get("status") ?? "";
  const equipmentCategory = searchParams.get("category") ?? "";
  const equipmentRoom = searchParams.get("room") ?? "";
  const softwareKeyword = searchParams.get("q") ?? "";
  const softwareEquipment = searchParams.get("equipment") ?? "";
  const isBookingRequestListPage = pathname === "/booking-rooms";
  const isBookingAllRequestsPage = pathname === "/booking-rooms/approval";
  const isRoomsListPage = pathname === "/booking-rooms/rooms";
  const isEquipmentListPage = pathname === "/booking-rooms/equipment";
  const isSoftwareListPage = pathname === "/booking-rooms/software";
  const isMaterialsListPage = pathname === "/booking-rooms/materials";
  const materialKeyword = searchParams.get("q") ?? "";
  const materialStatus = searchParams.get("status") ?? "";
  const materialCategory = searchParams.get("category") ?? "";
  const materialRoom = searchParams.get("room") ?? "";
  const isBorrowRequestListPage = pathname === "/borrow-equipment";
  const isBorrowAllRequestsPage = pathname === "/borrow-equipment/approval";
  const isBorrowEquipmentListPage = pathname === "/borrow-equipment/equipment";
  const isSampleTestingRequestListPage = pathname === "/sample-testing";
  const isSampleTestingAllRequestsPage = pathname === "/sample-testing/approval";
  const isLabClearanceRequestListPage = pathname === "/lab-clearance";
  const isLabClearanceAllRequestsPage = pathname === "/lab-clearance/approval";
  const { requesters: bookingRequesters } = useHistoryRequesterOptions(
    API_BOOKINGS_ALL_REQUESTERS,
    isBookingAllRequestsPage,
  );
  const { requesters: borrowRequesters } = useHistoryRequesterOptions(
    API_BORROWS_ALL_REQUESTERS,
    isBorrowAllRequestsPage,
  );
  const replaceCurrentPath = (params: URLSearchParams) => {
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  };

  const resetFilters = (keys: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    keys.forEach((key) => params.delete(key));
    replaceCurrentPath(params);
  };

  const isActionPathActive = (
    currentActionId: string,
    requestActionId: string,
    requestPathActive: boolean,
    approvalPathActive = false,
  ) =>
    isActionActive(currentActionId) &&
    ((currentActionId === requestActionId && requestPathActive) ||
      (currentActionId === "all-requests" && approvalPathActive));

  const isActionActive = (currentActionId: string) =>
    actionParam === currentActionId && menuParam === menu.id;

  const updateScheduleFilter = (
    key: "q" | "room" | "category" | "date",
    value: string,
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    replaceCurrentPath(params);
  };

  const updateBookingFilter = (
    key:
      | "q"
      | "status"
      | "created_after"
      | "created_before"
      | "room"
      | "requested_by"
      | "equipment",
    value: string,
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    replaceCurrentPath(params);
  };

  const updateBorrowFilter = (
    key:
      | "q"
      | "status"
      | "created_after"
      | "created_before"
      | "equipment"
      | "requested_by",
    value: string,
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    replaceCurrentPath(params);
  };

  const updateLabClearanceFilter = (
    key: "q" | "status" | "batch" | "ordering",
    value: string,
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    replaceCurrentPath(params);
  };

  const updateDateRangeFilter = (
    type: "booking" | "borrow" | "lab-clearance",
    value: DateRange | undefined,
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    const queryKeys =
      type === "booking"
        ? ({
            keyword: bookingKeyword,
            status: bookingStatus,
          })
        : type === "lab-clearance"
          ? ({
              keyword: labClearanceKeyword,
              status: labClearanceStatus,
            })
        : ({
            keyword: borrowKeyword,
            status: borrowStatus,
          });

    if (queryKeys.keyword) {
      params.set("q", queryKeys.keyword);
    } else {
      params.delete("q");
    }

    if (queryKeys.status) {
      params.set("status", queryKeys.status);
    } else {
      params.delete("status");
    }

    if (value?.from) {
      params.set("created_after", formatDateKey(value.from));
    } else {
      params.delete("created_after");
    }

    if (value?.to) {
      params.set("created_before", formatDateKey(value.to));
    } else if (value?.from) {
      params.set("created_before", formatDateKey(value.from));
    } else {
      params.delete("created_before");
    }

    replaceCurrentPath(params);
  };

  const updateRoomFilter = (key: "q" | "floor", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    replaceCurrentPath(params);
  };

  const updateEquipmentFilter = (
    key: "q" | "status" | "category" | "room",
    value: string,
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    replaceCurrentPath(params);
  };

  const updateMaterialFilter = (
    key: "q" | "status" | "category" | "room",
    value: string,
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    replaceCurrentPath(params);
  };

  const updateSoftwareFilter = (
    key: "q" | "equipment",
    value: string,
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    replaceCurrentPath(params);
  };

  const renderRequestFilters = ({
    keyword,
    status,
    dateRange,
    placeholder,
    statusOptions,
    extraFields,
    onKeywordChange,
    onStatusChange,
    onDateRangeChange,
    onReset,
  }: RequestFilterConfig) => (
    <FilterCard title="Filter Pengajuan">
      <FilterField label="Cari">
        <DebouncedSearchInput
          value={keyword}
          onChange={onKeywordChange}
          placeholder={placeholder}
          className="h-8 text-xs placeholder:text-xs"
        />
      </FilterField>
      <FilterField label="Status">
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          className={FILTER_CONTROL_CLASS}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FilterField>
      {extraFields}
      <FilterField label="Tanggal Dibuat">
        <DateRangePicker
          value={dateRange}
          onChange={onDateRangeChange}
          clearable
          buttonClassName="h-8 border-slate-200 px-2.5 text-xs"
        />
      </FilterField>
      <Button type="button" variant="outline" className={FILTER_BUTTON_CLASS} onClick={onReset}>
        Reset Filter
      </Button>
    </FilterCard>
  );

  const renderRoomFilters = () => (
    <FilterCard title="Filter Ruangan">
      <FilterField label="Cari">
        <DebouncedSearchInput
          value={roomKeyword}
          onChange={(value) => updateRoomFilter("q", value)}
          placeholder="Nama ruangan atau nomor"
          className="h-8 text-xs placeholder:text-xs"
        />
      </FilterField>
      <FilterField label="Lantai">
        <Input
          value={roomFloor}
          onChange={(event) => updateRoomFilter("floor", event.target.value)}
          placeholder="Semua lantai"
          className={FILTER_CONTROL_CLASS}
        />
      </FilterField>
      <Button
        type="button"
        variant="outline"
        className={FILTER_BUTTON_CLASS}
        onClick={() => resetFilters(["q", "floor"])}
      >
        Reset Filter
      </Button>
    </FilterCard>
  );

  const renderEquipmentFilters = ({
    keyword,
    category,
    room,
    onKeywordChange,
    onCategoryChange,
    onRoomChange,
    onReset,
    status,
    onStatusChange,
  }: EquipmentFilterConfig) => (
    <FilterCard title="Filter Peralatan">
      <FilterField label="Cari">
        <DebouncedSearchInput
          value={keyword}
          onChange={onKeywordChange}
          placeholder="Nama atau kategori"
          className="h-8 text-xs placeholder:text-xs"
        />
      </FilterField>
      {typeof status === "string" && onStatusChange ? (
        <FilterField label="Status">
          <select
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
            className={FILTER_CONTROL_CLASS}
          >
            <option value="">Semua Status</option>
            {EQUIPMENT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FilterField>
      ) : null}
      <FilterField label="Kategori">
        <select
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
          className={FILTER_CONTROL_CLASS}
        >
          <option value="">Semua Kategori</option>
          {EQUIPMENT_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FilterField>
      <FilterField label="Ruangan">
        <select
          value={room}
          onChange={(event) => onRoomChange(event.target.value)}
          className={FILTER_CONTROL_CLASS}
        >
          <option value="">Semua Ruangan</option>
          {rooms.map((roomOption) => (
            <option key={roomOption.id} value={roomOption.id}>
              {roomOption.label}
            </option>
          ))}
        </select>
      </FilterField>
      <Button type="button" variant="outline" className={FILTER_BUTTON_CLASS} onClick={onReset}>
        Reset Filter
      </Button>
    </FilterCard>
  );

  const renderSoftwareFilters = ({
    keyword,
    equipment,
    onKeywordChange,
    onEquipmentChange,
    onReset,
  }: SoftwareFilterConfig) => (
    <FilterCard title="Filter Software">
      <FilterField label="Cari">
        <DebouncedSearchInput
          value={keyword}
          onChange={onKeywordChange}
          placeholder="Nama software"
          className="h-8 text-xs placeholder:text-xs"
        />
      </FilterField>
      <FilterField label="Peralatan">
        <select
          value={equipment}
          onChange={(event) => onEquipmentChange(event.target.value)}
          className={FILTER_CONTROL_CLASS}
        >
          <option value="">Semua Peralatan</option>
          {softwareEquipmentOptionsList.map((equipmentOption) => (
            <option key={equipmentOption.id} value={equipmentOption.id}>
              {equipmentOption.label}
            </option>
          ))}
        </select>
      </FilterField>
      <Button type="button" variant="outline" className={FILTER_BUTTON_CLASS} onClick={onReset}>
        Reset Filter
      </Button>
    </FilterCard>
  );

  const renderMaterialFilters = ({
    keyword,
    status,
    category,
    room,
    onKeywordChange,
    onStatusChange,
    onCategoryChange,
    onRoomChange,
    onReset,
  }: MaterialFilterConfig) => (
    <FilterCard title="Filter Bahan">
      <FilterField label="Cari">
        <DebouncedSearchInput
          value={keyword}
          onChange={onKeywordChange}
          placeholder="Nama atau kategori"
          className="h-8 text-xs placeholder:text-xs"
        />
      </FilterField>
      <FilterField label="Status">
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          className={FILTER_CONTROL_CLASS}
        >
          <option value="">Semua Status</option>
          {MATERIAL_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FilterField>
      <FilterField label="Kategori">
        <select
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
          className={FILTER_CONTROL_CLASS}
        >
          <option value="">Semua Kategori</option>
          {MATERIAL_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FilterField>
      <FilterField label="Ruangan">
        <select
          value={room}
          onChange={(event) => onRoomChange(event.target.value)}
          className={FILTER_CONTROL_CLASS}
        >
          <option value="">Semua Ruangan</option>
          {rooms.map((roomOption) => (
            <option key={roomOption.id} value={roomOption.id}>
              {roomOption.label}
            </option>
          ))}
        </select>
      </FilterField>
      <Button type="button" variant="outline" className={FILTER_BUTTON_CLASS} onClick={onReset}>
        Reset Filter
      </Button>
    </FilterCard>
  );

  const handleActionClick = () => {
    if (mobile) onClose();
  };

  return (
    <aside
      aria-hidden={!isOpen}
      className={
        mobile
          ? "flex h-full w-full flex-col bg-[#E8F0FB]"
          : `fixed top-16 bottom-0 left-20 z-30 hidden border-r border-[#C5D3E8] bg-[#E8F0FB] shadow-[6px_0_24px_rgba(15,23,42,0.08)] transition-all duration-300 ease-in-out md:flex ${
              isOpen
                ? "translate-x-0 opacity-100"
                : "-translate-x-full opacity-0 pointer-events-none"
            }`
      }
      style={mobile ? undefined : { width }}
    >
      <div className="flex h-full w-full flex-col">
        <div
          className={`flex items-center justify-between border-b px-4 py-3 ${
            mobile ? "min-h-16" : ""
          }`}
        >
          <p className="text-sm font-semibold text-slate-800">{menu.label}</p>
          {!mobile ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 overflow-y-auto p-3">
          <div className="rounded-lg border border-[#D2DDED] bg-white p-3">
            <p className="text-sm text-slate-700">{menu.description}</p>
          </div>

          {menu.id === "schedule" && (
            <>
              <FilterCard title="">
                <MonthCalendar
                  value={scheduleDate ? (parseDateKey(scheduleDate) ?? new Date()) : new Date()}
                  onSelect={(value) => updateScheduleFilter("date", formatDateKey(value))}
                  renderMarker={(date, { isToday }) =>
                    date.getDay() !== 0 &&
                    date.getDay() !== 6 &&
                    visibleScheduleCalendarDates.has(formatDateKey(date)) ? (
                      <span
                        className={`block h-2 w-2 rounded-full ${isToday ? "bg-slate-900" : "bg-sky-500"}`}
                      />
                    ) : null
                  }
                  className="overflow-hidden rounded-lg border border-slate-200 shadow-none"
                  contentClassName="p-2"
                />
              </FilterCard>
              <FilterCard title="Filter Jadwal">
              <FilterField label="Cari Jadwal">
                <DebouncedSearchInput
                  value={scheduleKeyword}
                  onChange={(value) =>
                    updateScheduleFilter("q", value)
                  }
                  placeholder="Cari jadwal praktikum..."
                  className="h-8 text-xs placeholder:text-xs"
                />
              </FilterField>
              <FilterField label="Kategori">
                <select
                  value={scheduleCategory}
                  onChange={(event) =>
                    updateScheduleFilter("category", event.target.value)
                  }
                  className={FILTER_CONTROL_CLASS}
                >
                  <option value="">Semua Kategori</option>
                  <option value="schedule">Jadwal Praktikum</option>
                  <option value="booking">Peminjaman Lab</option>
                </select>
              </FilterField>
              <FilterField label="Ruangan">
                <select
                  value={scheduleRoom}
                  onChange={(event) =>
                    updateScheduleFilter("room", event.target.value)
                  }
                  className={FILTER_CONTROL_CLASS}
                >
                  <option value="">Semua Ruangan</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.label}
                    </option>
                  ))}
                </select>
              </FilterField>
              <Button
                type="button"
                variant="outline"
                className={FILTER_BUTTON_CLASS}
                onClick={() => resetFilters(["q", "category", "room", "date"])}
              >
                Reset Filter
              </Button>
              </FilterCard>
            </>
          )}

          {menu.actions.length > 0
            ? menu.actions.map((action) => {
                const actionIsActive = isActionActive(action.id);
                const showBookingFilters =
                  menu.id === "booking-rooms" &&
                  isActionPathActive(
                    action.id,
                    "request-list",
                    isBookingRequestListPage,
                    isBookingAllRequestsPage,
                  );
                const showRoomFilters =
                  menu.id === "booking-rooms" &&
                  actionIsActive &&
                  action.id === "rooms" &&
                  isRoomsListPage;
                const showEquipmentFilters =
                  menu.id === "booking-rooms" &&
                  actionIsActive &&
                  action.id === "equipment" &&
                  isEquipmentListPage;
                const showSoftwareFilters =
                  menu.id === "booking-rooms" &&
                  actionIsActive &&
                  action.id === "software" &&
                  isSoftwareListPage;
                const showMaterialFilters =
                  menu.id === "booking-rooms" &&
                  actionIsActive &&
                  action.id === "materials" &&
                  isMaterialsListPage;
                const showBorrowFilters =
                  menu.id === "borrow-equipment" &&
                  isActionPathActive(
                    action.id,
                    "request-list",
                    isBorrowRequestListPage,
                    isBorrowAllRequestsPage,
                  );
                const showBorrowEquipmentFilters =
                  menu.id === "borrow-equipment" &&
                  actionIsActive &&
                  action.id === "equipment" &&
                  isBorrowEquipmentListPage;
                const showSampleTestingFilters =
                  menu.id === "sample-testing" &&
                  isActionPathActive(
                    action.id,
                    "request-list",
                    isSampleTestingRequestListPage,
                    isSampleTestingAllRequestsPage,
                  );
                const showLabClearanceFilters =
                  menu.id === "bebas-laboratorium" &&
                  actionIsActive &&
                  action.id === "all-requests" &&
                  isLabClearanceAllRequestsPage;
                return (
                  <div key={action.id}>
                    <Link
                      href={getActionHref(action.id)}
                      onClick={(event) => {
                        if (actionIsActive && event.detail === 2) {
                          event.preventDefault();
                          router.push(getMenuHref());
                          handleActionClick();
                          return;
                        }
                        handleActionClick();
                      }}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                        actionIsActive
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span className="truncate">{action.label}</span>
                      <ChevronRight className="h-4 w-4 opacity-70" />
                    </Link>

                    <AnimatedFilterSection
                      show={
                        showBookingFilters ||
                        showSampleTestingFilters ||
                        showLabClearanceFilters
                      }
                    >
                      {renderRequestFilters({
                          keyword: showLabClearanceFilters
                            ? labClearanceKeyword
                            : bookingKeyword,
                          status: showLabClearanceFilters
                            ? labClearanceStatus
                            : bookingStatus,
                          dateRange: showLabClearanceFilters
                            ? labClearanceCreatedRange
                            : bookingCreatedRange,
                          placeholder: showLabClearanceFilters
                            ? "Cari pemohon..."
                            : "Cari pengajuan...",
                          statusOptions: showLabClearanceFilters
                            ? [...LAB_CLEARANCE_STATUS_OPTIONS]
                            : showSampleTestingFilters
                              ? SAMPLE_TESTING_STATUS_OPTIONS
                              : REQUEST_STATUS_OPTIONS,
                          extraFields: showBookingFilters ? (
                            <>
                              <FilterField label="Ruangan">
                                <select
                                    value={bookingRoom}
                                  onChange={(event) =>
                                    updateBookingFilter("room", event.target.value)
                                  }
                                  className={FILTER_CONTROL_CLASS}
                                >
                                  <option value="">Semua Ruangan</option>
                                  {rooms.map((room) => (
                                    <option key={room.id} value={room.id}>
                                      {room.label}
                                    </option>
                                  ))}
                                </select>
                              </FilterField>
                              {isBookingAllRequestsPage ? (
                                <FilterField label="Pemohon">
                                  <select
                                    value={bookingRequester}
                                    onChange={(event) =>
                                      updateBookingFilter("requested_by", event.target.value)
                                    }
                                    className={FILTER_CONTROL_CLASS}
                                  >
                                    <option value="">Semua Pemohon</option>
                                    {bookingRequesters.map((requester) => (
                                      <option key={requester.id} value={requester.id}>
                                        {requester.label}
                                      </option>
                                    ))}
                                  </select>
                                </FilterField>
                              ) : null}
                            </>
                          ) : showLabClearanceFilters ? (
                            <>
                              <FilterField label="Angkatan">
                                <BatchInput
                                  value={labClearanceBatch}
                                  onChange={(value) => updateLabClearanceFilter("batch", value)}
                                  options={BATCH_OPTIONS}
                                  placeholder="Semua atau ketik angkatan"
                                  className={FILTER_CONTROL_CLASS}
                                />
                              </FilterField>
                              <FilterField label="Urutkan">
                                <select
                                  value={labClearanceOrdering}
                                  onChange={(event) =>
                                    updateLabClearanceFilter("ordering", event.target.value)
                                  }
                                  className={FILTER_CONTROL_CLASS}
                                >
                                  {LAB_CLEARANCE_ORDERING_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </FilterField>
                            </>
                          ) : undefined,
                          onKeywordChange: (value) =>
                            showLabClearanceFilters
                              ? updateLabClearanceFilter("q", value)
                              : updateBookingFilter("q", value),
                          onStatusChange: (value) =>
                            showLabClearanceFilters
                              ? updateLabClearanceFilter("status", value)
                              : updateBookingFilter("status", value),
                          onDateRangeChange: (value) =>
                            updateDateRangeFilter(
                              showLabClearanceFilters ? "lab-clearance" : "booking",
                              value,
                            ),
                          onReset: () =>
                            resetFilters(
                              showLabClearanceFilters
                                ? [
                                    "q",
                                    "status",
                                    "batch",
                                    "ordering",
                                    "created_after",
                                    "created_before",
                                  ]
                                : [
                                    "q",
                                    "status",
                                    "room",
                                    "requested_by",
                                    "created_after",
                                    "created_before",
                                  ],
                            ),
                        })}
                    </AnimatedFilterSection>

                    <AnimatedFilterSection show={showRoomFilters}>
                      {renderRoomFilters()}
                    </AnimatedFilterSection>


                    <AnimatedFilterSection show={showEquipmentFilters}>
                      {renderEquipmentFilters({
                          keyword: equipmentKeyword,
                          status: equipmentStatus,
                          category: equipmentCategory,
                          room: equipmentRoom,
                          onKeywordChange: (value) =>
                            updateEquipmentFilter("q", value),
                          onStatusChange: (value) =>
                            updateEquipmentFilter("status", value),
                          onCategoryChange: (value) =>
                            updateEquipmentFilter("category", value),
                          onRoomChange: (value) =>
                            updateEquipmentFilter("room", value),
                          onReset: () =>
                            resetFilters([
                              "q",
                              "status",
                              "category",
                              "room",
                            ]),
                        })}
                    </AnimatedFilterSection>

                    <AnimatedFilterSection show={showSoftwareFilters}>
                      {renderSoftwareFilters({
                          keyword: softwareKeyword,
                          equipment: softwareEquipment,
                          onKeywordChange: (value) =>
                            updateSoftwareFilter("q", value),
                          onEquipmentChange: (value) =>
                            updateSoftwareFilter("equipment", value),
                          onReset: () =>
                            resetFilters(["q", "equipment"]),
                        })}
                    </AnimatedFilterSection>

                    <AnimatedFilterSection show={showMaterialFilters}>
                      {renderMaterialFilters({
                          keyword: materialKeyword,
                          status: materialStatus,
                          category: materialCategory,
                          room: materialRoom,
                          onKeywordChange: (value) =>
                            updateMaterialFilter("q", value),
                          onStatusChange: (value) =>
                            updateMaterialFilter("status", value),
                          onCategoryChange: (value) =>
                            updateMaterialFilter("category", value),
                          onRoomChange: (value) =>
                            updateMaterialFilter("room", value),
                          onReset: () =>
                            resetFilters(["q", "status", "category", "room"]),
                        })}
                    </AnimatedFilterSection>

                    <AnimatedFilterSection show={showBorrowFilters}>
                      {renderRequestFilters({
                          keyword: borrowKeyword,
                          status: borrowStatus,
                          dateRange: borrowCreatedRange,
                          placeholder: "Cari pengajuan...",
                          statusOptions: BORROW_STATUS_OPTIONS,
                          extraFields: (
                            <>
                              <FilterField label="Alat">
                                <select
                                  value={borrowEquipment}
                                  onChange={(event) =>
                                    updateBorrowFilter("equipment", event.target.value)
                                  }
                                  className={FILTER_CONTROL_CLASS}
                                >
                                  <option value="">Semua Alat</option>
                                  {borrowEquipmentOptionsList.map((equipment) => (
                                    <option key={equipment.id} value={equipment.id}>
                                      {equipment.label}
                                    </option>
                                  ))}
                                </select>
                              </FilterField>
                              {isBorrowAllRequestsPage ? (
                                <FilterField label="Pemohon">
                                  <select
                                    value={borrowRequester}
                                    onChange={(event) =>
                                      updateBorrowFilter("requested_by", event.target.value)
                                    }
                                    className={FILTER_CONTROL_CLASS}
                                  >
                                    <option value="">Semua Pemohon</option>
                                    {borrowRequesters.map((requester) => (
                                      <option key={requester.id} value={requester.id}>
                                        {requester.label}
                                      </option>
                                    ))}
                                  </select>
                                </FilterField>
                              ) : null}
                            </>
                          ),
                          onKeywordChange: (value) =>
                            updateBorrowFilter("q", value),
                          onStatusChange: (value) =>
                            updateBorrowFilter("status", value),
                          onDateRangeChange: (value) =>
                            updateDateRangeFilter("borrow", value),
                          onReset: () =>
                            resetFilters([
                              "q",
                              "status",
                              "equipment",
                              "requested_by",
                              "created_after",
                              "created_before",
                            ]),
                        })}
                    </AnimatedFilterSection>

                    <AnimatedFilterSection show={showBorrowEquipmentFilters}>
                      {renderEquipmentFilters({
                          keyword: equipmentKeyword,
                          category: equipmentCategory,
                          room: equipmentRoom,
                          onKeywordChange: (value) =>
                            updateEquipmentFilter("q", value),
                          onCategoryChange: (value) =>
                            updateEquipmentFilter("category", value),
                          onRoomChange: (value) =>
                            updateEquipmentFilter("room", value),
                          onReset: () =>
                            resetFilters(["q", "category", "room"]),
                        })}
                    </AnimatedFilterSection>
                  </div>
                );
              })
            : null}

          {menu.id === "my-profile" &&
          actionParam === "change-password" &&
          canChangePassword ? (
            <ProfileSecurityPanel />
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function ProfileSecurityPanel() {
  const {
    formData: passwordFormData,
    status: passwordStatus,
    message: passwordMessage,
    handleChange: handlePasswordChange,
    handleSubmit: handlePasswordSubmit,
  } = useChangePassword();

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="rounded-lg border border-[#D2DDED] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-slate-600" />
        <h2 className="text-sm font-semibold text-slate-900">Keamanan Akun</h2>
      </div>

      <form
        className="mt-3 space-y-3 rounded-md border border-[#E3EAF4] bg-white p-2.5"
        onSubmit={handlePasswordSubmit}
      >
        <PasswordField
          id="currentPassword"
          label="Password Lama"
          name="currentPassword"
          value={passwordFormData.currentPassword}
          onChange={handlePasswordChange}
          show={showCurrentPassword}
          setShow={setShowCurrentPassword}
        />
        <PasswordField
          id="newPassword"
          label="Password Baru"
          name="newPassword"
          value={passwordFormData.newPassword}
          onChange={handlePasswordChange}
          show={showNewPassword}
          setShow={setShowNewPassword}
        />
        <PasswordField
          id="confirmPassword"
          label="Konfirmasi Password Baru"
          name="confirmPassword"
          value={passwordFormData.confirmPassword}
          onChange={handlePasswordChange}
          show={showConfirmPassword}
          setShow={setShowConfirmPassword}
        />

        {passwordMessage ? (
          <div
            className={`rounded-md border px-3 py-2 text-sm ${
              passwordStatus === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-destructive/20 bg-destructive/5 text-destructive"
            }`}
          >
            {passwordMessage}
          </div>
        ) : null}

        <Button
          type="submit"
          className="w-full"
          disabled={passwordStatus === "submitting"}
        >
          {passwordStatus === "submitting" ? "Menyimpan..." : "Ganti Password"}
        </Button>
      </form>
    </div>
  );
}

function PasswordField({
  id,
  label,
  name,
  value,
  onChange,
  show,
  setShow,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  show: boolean;
  setShow: (value: boolean) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-600">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          className="pr-9"
        />
        <button
          type="button"
          className="absolute inset-y-0 right-2 flex items-center text-slate-500"
          onClick={() => setShow(!show)}
          aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
