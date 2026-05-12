"use client";


import { useEffect, useMemo, useRef, useState } from "react";

import type { DateRange } from "react-day-picker";

import { ClipboardCheck, Eye, Trash2 } from "lucide-react";

import { toast } from "sonner";

import { AdminPageHeader, AdminFilterCard } from "@/components/admin/shared";

import { AdminEquipmentBorrowHistoryDetailContent } from "@/components/admin/history/content";

import {
  AdminHistoryBulkActions,
  AdminHistoryExportActions,
  AdminHistorySummaryCards,
  AdminHistoryTable,
  RelatedEquipmentDetailDialog,
  RelatedUserDetailDialog,
} from "@/components/admin/history";

import { DashboardDetailReviewPanel } from "@/components/dashboard/layout";

import {
  ActionTooltip,
  ConfirmDeleteDialog,
  DataPagination,
  InlineErrorAlert,
} from "@/components/shared";

import {
  Button,
  DateRangePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from "@/components/ui";

import {
  API_BORROWS_ALL_REQUESTERS,
  API_BORROW_DETAIL,
  API_BORROWS_BULK_DELETE,
  API_BORROWS_EXPORT,
} from "@/constants/api";

import { DEPARTMENT_VALUES } from "@/constants/departments";

import { useEquipmentOptions } from "@/hooks/shared/resources/equipments";

import {
  mapBorrow,
  useBorrowDetail,
  useBorrows,
  type BorrowRow,
} from "@/hooks/borrow-equipment";

import { useHistoryRequesterOptions } from "@/hooks/admin/history";

import { useDeleteRecord } from "@/hooks/use-delete-record";

import {
  formatDateKey,
  toEndOfDay,
  toStartOfDay,
} from "@/lib/date";

import { formatDateTimeWib } from "@/lib/date";

import { isWaitingForMentorApproval } from "@/lib/request";

import { BORROW_EXPORT_COLUMNS } from "@/lib/admin/export-config";

import {
  BORROW_STATUS_OPTIONS,
  getStatusBadgeClass,
  getStatusDisplayLabel,
  shouldShowReviewAction,
} from "@/lib/request";

import { REQUEST_PURPOSE_OPTIONS } from "@/constants/request-purpose";

import { useAdminRecordExport } from "@/hooks/admin";

const PAGE_SIZE = 20;
const STATUS_OPTIONS = BORROW_STATUS_OPTIONS;
const ORDERING_OPTIONS = [
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
];

function matchesSearch(row: BorrowRow, query: string) {
  if (!query) return true;
  const haystack = [row.code, row.equipmentName, row.requesterName, row.purpose]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export default function AdminEquipmentBorrowHistoryPage() {
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [purpose, setPurpose] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [department, setDepartment] = useState("");
  const [equipment, setEquipment] = useState("");
  const [ordering, setOrdering] = useState("newest");
  const [createdRange, setCreatedRange] = useState<DateRange | undefined>();
  const [filterOpen, setFilterOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<BorrowRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Array<number | string>>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<BorrowRow | null>(null);
  const [reviewTarget, setReviewTarget] = useState<BorrowRow | null>(null);
  const [relatedEquipmentId, setRelatedEquipmentId] = useState<string | number | null>(null);
  const [relatedUserId, setRelatedUserId] = useState<string | number | null>(null);
  const [isExportingSelectedPdf, setIsExportingSelectedPdf] = useState(false);
  const [isExportingSelectedExcel, setIsExportingSelectedExcel] = useState(false);
  const createdAfter = createdRange?.from ? formatDateKey(createdRange.from) : "";
  const createdBefore = createdRange?.to
    ? formatDateKey(createdRange.to)
    : createdRange?.from
      ? formatDateKey(createdRange.from)
      : "";
  const { deleteRecord, deleteRecords, isDeleting } = useDeleteRecord();
  const { requesters } = useHistoryRequesterOptions(`${API_BORROWS_ALL_REQUESTERS}?unscoped=1`);
  const { equipments } = useEquipmentOptions("", "", true, true);
  const { exportPdf, exportExcel, isExportingPdf, isExportingExcel } =
    useAdminRecordExport({
      endpoint: `${API_BORROWS_EXPORT}?unscoped=1`,
      filters: {
        q: debouncedSearch,
        status,
        purpose,
        requested_by: requestedBy,
        department,
        equipment,
        created_after: createdAfter ? toStartOfDay(createdAfter) : "",
        created_before: createdBefore ? toEndOfDay(createdBefore) : "",
      },
      mapItem: mapBorrow,
      title: "Riwayat Peminjaman Alat",
      pdfFilename: "record-peminjaman-alat.pdf",
      excelFilename: "record-peminjaman-alat.xlsx",
      columns: BORROW_EXPORT_COLUMNS,
      emptyMessage: "Tidak ada data peminjaman alat untuk diunduh.",
      pdfSuccessMessage: "PDF peminjaman alat berhasil diunduh.",
      excelSuccessMessage: "Excel peminjaman alat berhasil diunduh.",
    });

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(search.trim()), 500);
    return () => clearTimeout(timeoutId);
  }, [search]);

  const { borrows, totalCount, aggregates, isLoading, hasLoadedOnce, error } =
    useBorrows(
      page,
      PAGE_SIZE,
      {
        status,
        purpose,
        requestedBy,
        department,
        equipment,
        createdAfter: createdAfter ? toStartOfDay(createdAfter) : "",
        createdBefore: createdBefore ? toEndOfDay(createdBefore) : "",
      },
      reloadKey,
      "admin-all",
    );
  const {
    borrow: detailBorrow,
    isLoading: isDetailLoading,
    error: detailError,
  } = useBorrowDetail(detailTarget?.id ?? null, reloadKey, {
    enabled: Boolean(detailTarget),
  });
  const filteredBorrows = useMemo(
    () => borrows.filter((item) => matchesSearch(item, debouncedSearch)),
    [borrows, debouncedSearch],
  );
  const visibleBorrows = useMemo(() => {
    const items = [...filteredBorrows];

    if (ordering === "oldest") {
      items.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      return items;
    }

    items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return items;
  }, [filteredBorrows, ordering]);

  const totalPages = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil((totalCount || filteredBorrows.length) / PAGE_SIZE),
      ),
    [totalCount, filteredBorrows.length],
  );

  const selectedCount = selectedIds.length;
  const selectedRows = useMemo(() => {
    const selectedIdSet = new Set(selectedIds.map((id) => String(id)));
    return borrows.filter((item) => selectedIdSet.has(String(item.id)));
  }, [borrows, selectedIds]);
  const allVisibleSelected =
    visibleBorrows.length > 0 &&
    visibleBorrows.every((item) => selectedIds.includes(item.id));
  const someVisibleSelected =
    visibleBorrows.some((item) => selectedIds.includes(item.id)) &&
    !allVisibleSelected;

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) =>
        borrows.some((item) => String(item.id) === String(id)),
      ),
    );
  }, [borrows]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("");
    setPurpose("");
    setRequestedBy("");
    setDepartment("");
    setEquipment("");
    setOrdering("newest");
    setCreatedRange(undefined);
    setPage(1);
    setReloadKey((prev) => prev + 1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const result = await deleteRecord(API_BORROW_DETAIL(deleteTarget.id));
    if (result.ok) {
      toast.success("Riwayat peminjaman alat berhasil dihapus.");
      setDeleteTarget(null);
      setReloadKey((prev) => prev + 1);
      return;
    }
    toast.error(result.message);
  };

  const toggleItemSelection = (id: number | string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((itemId) => itemId !== id)
        : [...prev, id],
    );
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    if (!checked) {
      setSelectedIds((prev) =>
        prev.filter((id) => !visibleBorrows.some((item) => item.id === id)),
      );
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleBorrows.forEach((item) => next.add(item.id));
      return Array.from(next);
    });
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const result = await deleteRecords(API_BORROWS_BULK_DELETE, selectedIds);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    if (result.failedCount && result.deletedCount) {
      toast.success(`${result.deletedCount} record peminjaman alat berhasil dihapus.`);
      toast.error(
        result.message ?? `${result.failedCount} record peminjaman alat gagal dihapus.`,
      );
    } else {
      toast.success(
        result.message ??
          `${result.deletedCount} record peminjaman alat berhasil dihapus.`,
      );
    }

    setIsBulkDeleteOpen(false);
    setSelectedIds([]);
    setReloadKey((prev) => prev + 1);
  };

  const handleExportSelectedPdf = async () => {
    if (!selectedRows.length) return;
    try {
      setIsExportingSelectedPdf(true);
      const { exportAdminRecordPdf } = await import("@/lib/admin/export");
      await exportAdminRecordPdf({
        title: "Riwayat Peminjaman Alat Terpilih",
        subtitle: `Total data: ${selectedRows.length}`,
        filename: "record-peminjaman-alat-terpilih.pdf",
        columns: BORROW_EXPORT_COLUMNS,
        rows: selectedRows,
      });
      toast.success("PDF record peminjaman alat terpilih berhasil diunduh.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal mengunduh PDF data terpilih.",
      );
    } finally {
      setIsExportingSelectedPdf(false);
    }
  };

  const handleExportSelectedExcel = async () => {
    if (!selectedRows.length) return;
    try {
      setIsExportingSelectedExcel(true);
      const { exportAdminRecordExcel } = await import("@/lib/admin/export");
      await exportAdminRecordExcel({
        title: "Riwayat Peminjaman Alat Terpilih",
        filename: "record-peminjaman-alat-terpilih.xlsx",
        columns: BORROW_EXPORT_COLUMNS,
        rows: selectedRows,
      });
      toast.success("Excel record peminjaman alat terpilih berhasil diunduh.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal mengunduh Excel data terpilih.",
      );
    } finally {
      setIsExportingSelectedExcel(false);
    }
  };

  return (
    <section className="w-full min-w-0 space-y-4 px-4 pb-6">
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 space-y-4">
          <AdminPageHeader
            title="Riwayat Peminjaman Alat"
            description="Pantau histori peminjaman alat laboratorium."
            icon={<Eye className="h-5 w-5 text-sky-200" />}
          />

          <AdminHistorySummaryCards
            items={[
              { label: "Total", value: aggregates.total, tone: "blue" },
              { label: "Menunggu", value: aggregates.pending },
              { label: "Disetujui", value: aggregates.approved },
              { label: "Ditolak", value: aggregates.rejected },
              { label: "Kedaluwarsa", value: aggregates.expired },
              { label: "Dipinjam", value: aggregates.borrowed, tone: "blue" },
              {
                label: "Dikembalikan Menunggu Inspeksi",
                value: aggregates.returned_pending_inspection,
              },
              { label: "Dikembalikan", value: aggregates.returned },
              { label: "Terlambat", value: aggregates.overdue },
              { label: "Hilang/Rusak", value: aggregates.lost_damaged },
            ]}
          />

          <AdminFilterCard
            open={filterOpen}
            onToggle={() => setFilterOpen((prev) => !prev)}
            onReset={resetFilters}
          >
            <form
              className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
              }}
            >
              <div className="min-w-0">
                <label className="mb-0.5 block text-[11px] font-semibold text-slate-900/90">
                  Cari
                </label>
                <Input
                  type="search"
                  value={search}
                  placeholder="Kode, alat, atau peminjam"
                  className="h-8 border-slate-400 bg-white px-2 py-0 text-xs placeholder:text-xs md:text-xs shadow-xs focus-visible:border-sky-600 focus-visible:ring-sky-100"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="min-w-0">
                <label className="mb-0.5 block text-[11px] font-semibold text-slate-900/90">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                  className="h-8 w-full rounded-md border border-slate-400 bg-white px-2 text-xs outline-none shadow-xs focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-100"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className="mb-0.5 block text-[11px] font-semibold text-slate-900/90">
                  Kategori
                </label>
                <select
                  value={purpose}
                  onChange={(event) => {
                    setPurpose(event.target.value);
                    setPage(1);
                  }}
                  className="h-8 w-full rounded-md border border-slate-400 bg-white px-2 text-xs outline-none shadow-xs focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-100"
                >
                  <option value="">Semua kategori</option>
                  {REQUEST_PURPOSE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className="mb-0.5 block text-[11px] font-semibold text-slate-900/90">
                  Nama Pemohon
                </label>
                <select
                  value={requestedBy}
                  onChange={(event) => {
                    setRequestedBy(event.target.value);
                    setPage(1);
                  }}
                  className="h-8 w-full rounded-md border border-slate-400 bg-white px-2 text-xs outline-none shadow-xs focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-100"
                >
                  <option value="">Semua pemohon</option>
                  {requesters.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className="mb-0.5 block text-[11px] font-semibold text-slate-900/90">
                  Prodi Pemohon
                </label>
                <select
                  value={department}
                  onChange={(event) => {
                    setDepartment(event.target.value);
                    setPage(1);
                  }}
                  className="h-8 w-full rounded-md border border-slate-400 bg-white px-2 text-xs outline-none shadow-xs focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-100"
                >
                  <option value="">Semua prodi</option>
                  {DEPARTMENT_VALUES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className="mb-0.5 block text-[11px] font-semibold text-slate-900/90">
                  Alat
                </label>
                <select
                  value={equipment}
                  onChange={(event) => {
                    setEquipment(event.target.value);
                    setPage(1);
                  }}
                  className="h-8 w-full rounded-md border border-slate-400 bg-white px-2 text-xs outline-none shadow-xs focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-100"
                >
                  <option value="">Semua alat</option>
                  {equipments.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className="mb-0.5 block text-[11px] font-semibold text-slate-900/90">
                  Urutkan
                </label>
                <select
                  value={ordering}
                  onChange={(event) => {
                    setOrdering(event.target.value);
                    setPage(1);
                  }}
                  className="h-8 w-full rounded-md border border-slate-400 bg-white px-2 text-xs outline-none shadow-xs focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-100"
                >
                  {ORDERING_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className="mb-0.5 block text-[11px] font-semibold text-slate-900/90">
                  Tanggal Dibuat
                </label>
                <DateRangePicker
                  value={createdRange}
                  onChange={(value) => {
                    setCreatedRange(value);
                    setPage(1);
                  }}
                  clearable
                  buttonClassName="h-8 w-full rounded-md border-slate-400 bg-white px-2 text-xs shadow-xs focus-visible:border-sky-600 focus-visible:ring-sky-100"
                />
              </div>
            </form>
          </AdminFilterCard>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <AdminHistoryBulkActions
                selectedCount={selectedCount}
                isDeleting={isDeleting}
                isExportingSelectedExcel={isExportingSelectedExcel}
                isExportingSelectedPdf={isExportingSelectedPdf}
                onExportSelectedExcel={handleExportSelectedExcel}
                onExportSelectedPdf={handleExportSelectedPdf}
                onDeleteSelected={() => setIsBulkDeleteOpen(true)}
                onClearSelection={() => setSelectedIds([])}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <p className="text-xs text-slate-500 sm:text-right">
                Export mengikuti filter dan pencarian yang sedang aktif.
              </p>
              <AdminHistoryExportActions
                onExportExcel={exportExcel}
                onExportPdf={exportPdf}
                isExportingExcel={isExportingExcel}
                isExportingPdf={isExportingPdf}
              />
            </div>
          </div>

          {error ? (
            <InlineErrorAlert>{error}</InlineErrorAlert>
          ) : null}

          <AdminHistoryTable
            columns={[
              { label: "Kode" },
              { label: "Alat" },
              { label: "Pemohon" },
              { label: "Waktu Mulai" },
              { label: "Waktu Selesai" },
              { label: "Status" },
              {
                label: "Aksi",
                className:
                  "sticky right-0 z-10 relative whitespace-nowrap bg-slate-900 px-3 py-3 text-center font-medium text-slate-50 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-700",
              },
            ]}
            colSpan={8}
            hasRows={visibleBorrows.length > 0}
            isLoading={isLoading}
            hasLoadedOnce={hasLoadedOnce}
            emptyMessage="Tidak ada data peminjaman alat."
            allVisibleSelected={allVisibleSelected}
            onToggleSelectAll={toggleSelectAllVisible}
            selectAllRef={selectAllRef}
          >
            {visibleBorrows.map((item) => (
              <tr key={String(item.id)} className="border-b last:border-b-0">
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    aria-label={`Pilih record ${item.code}`}
                    className="h-4 w-4 rounded border-slate-300 align-middle"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleItemSelection(item.id)}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-medium">
                  {item.code}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {item.equipmentName}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                  {item.requesterName}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {formatDateTimeWib(item.startTime)}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {formatDateTimeWib(item.endTime)}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusBadgeClass(
                      item.status,
                    )}`}
                  >
                    {getStatusDisplayLabel(item.status)}
                  </span>
                </td>
                <td className="sticky right-0 z-10 relative bg-card px-3 py-2 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200">
                  <div className="flex justify-center gap-2">
                    {shouldShowReviewAction("borrow", item.status) &&
                    !isWaitingForMentorApproval(item) ? (
                      <ActionTooltip label="Review pengajuan">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => setReviewTarget(item)}
                        >
                          <ClipboardCheck className="h-4 w-4" />
                        </Button>
                      </ActionTooltip>
                    ) : null}
                    <ActionTooltip label="Lihat detail">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => setDetailTarget(item)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </ActionTooltip>
                    <ActionTooltip label="Hapus riwayat">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => setDeleteTarget(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </ActionTooltip>
                  </div>
                </td>
              </tr>
            ))}
          </AdminHistoryTable>

          <DataPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount || filteredBorrows.length}
            pageSize={PAGE_SIZE}
            itemLabel="peminjaman alat"
            isLoading={isLoading}
            onPageChange={setPage}
          />

          <ConfirmDeleteDialog
            open={Boolean(deleteTarget)}
            title="Hapus record peminjaman alat?"
            description={`Riwayat ${deleteTarget?.code ?? ""} akan dihapus permanen.`}
            isDeleting={isDeleting}
            onOpenChange={(open) => {
              if (!open) setDeleteTarget(null);
            }}
            onConfirm={handleDelete}
          />

          <ConfirmDeleteDialog
            open={isBulkDeleteOpen}
            title="Hapus record peminjaman alat terpilih?"
            description={`${selectedCount} record yang dipilih akan dihapus permanen.`}
            isDeleting={isDeleting}
            onOpenChange={setIsBulkDeleteOpen}
            onConfirm={handleBulkDelete}
          />

          <Dialog
            open={Boolean(reviewTarget)}
            onOpenChange={(open) => {
              if (!open) setReviewTarget(null);
            }}
          >
            <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:w-[50vw] sm:max-w-[760px] sm:min-w-[640px] sm:max-w-none">
              <DialogHeader className="sr-only">
                <DialogTitle>Review Pengajuan Peminjaman Alat</DialogTitle>
                <DialogDescription>
                  Review pengajuan peminjaman alat ditampilkan dalam modal.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[85vh] overflow-y-auto px-1 pt-1 pb-4">
                {reviewTarget ? (
                  <DashboardDetailReviewPanel
                    context={{ kind: "borrow", id: String(reviewTarget.id) }}
                    onActionComplete={() => {
                      setReviewTarget(null);
                      setReloadKey((prev) => prev + 1);
                    }}
                  />
                ) : null}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={Boolean(detailTarget)}
            onOpenChange={(open) => {
              if (!open) setDetailTarget(null);
            }}
          >
            <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:w-[50vw] sm:max-w-[960px] sm:min-w-[720px] sm:max-w-none">
              <DialogHeader className="sr-only">
                <DialogTitle>Detail Peminjaman Alat</DialogTitle>
                <DialogDescription>
                  Detail record peminjaman alat ditampilkan dalam modal.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[85vh] overflow-y-auto px-1 pt-1 pb-4">
                <div className="space-y-4">
                  <AdminEquipmentBorrowHistoryDetailContent
                    item={detailBorrow}
                    isLoading={isDetailLoading}
                    error={detailError}
                    backLabel="Tutup"
                    onBack={() => setDetailTarget(null)}
                    onOpenEquipmentDetail={setRelatedEquipmentId}
                    onOpenUserDetail={setRelatedUserId}
                  />
                  {detailTarget ? (
                    <DashboardDetailReviewPanel
                      context={{ kind: "borrow", id: String(detailTarget.id) }}
                      initialBorrow={detailBorrow}
                      onActionComplete={() => {
                        setDetailTarget(null);
                        setReloadKey((prev) => prev + 1);
                      }}
                    />
                  ) : null}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <RelatedEquipmentDetailDialog
            open={Boolean(relatedEquipmentId)}
            equipmentId={relatedEquipmentId}
            onOpenChange={(open) => {
              if (!open) setRelatedEquipmentId(null);
            }}
          />

          <RelatedUserDetailDialog
            open={Boolean(relatedUserId)}
            userId={relatedUserId}
            onOpenChange={(open) => {
              if (!open) setRelatedUserId(null);
            }}
          />
        </div>
      </div>
    </section>
  );
}
