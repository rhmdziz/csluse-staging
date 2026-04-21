"use client";


import type { ReactNode, RefObject } from "react";

import type { DateRange } from "react-day-picker";

import {
  ScheduleBulkActions,
  ScheduleFilters,
  SchedulesTable,
  type ScheduleTableRow,
} from "@/components/admin/schedules";

import { DataPagination } from "@/components/shared";

import type { ScheduleItem } from "@/hooks/shared/schedules";

type RoomOption = {
  id: string | number;
  label: string;
};

type ScheduleTabContentProps = {
  filterOpen: boolean;
  query: string;
  roomFilter: string;
  sourceFilter: string;
  dateRange?: DateRange;
  sortOrder: string;
  rooms: RoomOption[];
  rows: ScheduleTableRow[];
  isLoading: boolean;
  selectedIds: Array<string | number>;
  allVisibleSelected: boolean;
  selectAllRef: RefObject<HTMLInputElement | null>;
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  selectedCount: number;
  isDeleting: boolean;
  createAction: ReactNode;
  onToggleFilter: () => void;
  onResetFilter: () => void;
  onClearSelection: () => void;
  onQueryChange: (value: string) => void;
  onRoomFilterChange: (value: string) => void;
  onSourceFilterChange: (value: string) => void;
  onDateRangeChange: (value: DateRange | undefined) => void;
  onSortOrderChange: (value: string) => void;
  onToggleSelectAllVisible: (checked: boolean) => void;
  onToggleItemSelection: (item: ScheduleItem) => void;
  onView: (item: ScheduleItem) => void;
  onViewBooking: (bookingId: string | number) => void;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (item: ScheduleItem) => void;
  onDeleteSelected: () => void;
  onPageChange: (page: number) => void;
};

export default function ScheduleTabContent({
  filterOpen,
  query,
  roomFilter,
  sourceFilter,
  dateRange,
  sortOrder,
  rooms,
  rows,
  isLoading,
  selectedIds,
  allVisibleSelected,
  selectAllRef,
  page,
  totalPages,
  totalCount,
  pageSize,
  selectedCount,
  isDeleting,
  createAction,
  onToggleFilter,
  onResetFilter,
  onClearSelection,
  onQueryChange,
  onRoomFilterChange,
  onSourceFilterChange,
  onDateRangeChange,
  onSortOrderChange,
  onToggleSelectAllVisible,
  onToggleItemSelection,
  onView,
  onViewBooking,
  onEdit,
  onDelete,
  onDeleteSelected,
  onPageChange,
}: ScheduleTabContentProps) {
  return (
    <div className="space-y-3">
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
        sortOrder={sortOrder}
        rooms={rooms}
        onToggle={onToggleFilter}
        onReset={onResetFilter}
        onQueryChange={onQueryChange}
        onRoomFilterChange={onRoomFilterChange}
        onSourceFilterChange={onSourceFilterChange}
        onDateRangeChange={onDateRangeChange}
        onSortOrderChange={onSortOrderChange}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ScheduleBulkActions
          selectedCount={selectedCount}
          isDeleting={isDeleting}
          onClearSelection={onClearSelection}
          onDeleteSelected={onDeleteSelected}
        />
        {createAction}
      </div>

      <SchedulesTable
        rows={rows}
        isLoading={isLoading}
        selectedIds={selectedIds}
        allVisibleSelected={allVisibleSelected}
        selectAllRef={selectAllRef}
        onToggleSelectAllVisible={onToggleSelectAllVisible}
        onToggleItemSelection={onToggleItemSelection}
        onView={onView}
        onViewBooking={onViewBooking}
        onEdit={onEdit}
        onDelete={onDelete}
      />

      <DataPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        itemLabel="jadwal"
        isLoading={isLoading}
        onPageChange={onPageChange}
      />
    </div>
  );
}
