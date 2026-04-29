"use client";


import { useEffect, useMemo, useRef, useState } from "react";

import type { DateRange } from "react-day-picker";

import { Eye, FileText, History, Trash2 } from "lucide-react";

import { useSearchParams } from "next/navigation";

import { toast } from "sonner";

import { AdminPageHeader, AdminFilterCard } from "@/components/admin/shared";

import { AdminSampleTestingHistoryDetailContent } from "@/components/admin/history/content";

import {
  AdminHistoryBulkActions,
  AdminHistoryExportActions,
  AdminHistorySummaryCards,
  AdminHistoryTable,
  RelatedUserDetailDialog,
  SampleTestingHistoryLegacyImportDialog,
} from "@/components/admin/history";

import { SampleTestingDocumentsDialog } from "@/components/dashboard/sample-testing";

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
  API_PENGUJIANS_ALL_REQUESTERS,
  API_PENGUJIAN_DETAIL,
  API_PENGUJIANS_BULK_DELETE,
  API_PENGUJIANS_EXPORT,
} from "@/constants/api";

import { DEPARTMENT_VALUES } from "@/constants/departments";

import { useHistoryRequesterOptions } from "@/hooks/admin/history";

import {
  mapSampleTesting,
  useSampleTestingDetail,
  useSampleTestingList,
  type SampleTestingRow,
} from "@/hooks/sample-testing";

import { useDeleteRecord } from "@/hooks/use-delete-record";

import { SAMPLE_TESTING_EXPORT_COLUMNS } from "@/lib/admin/export-config";

import { formatDateKey, toEndOfDay, toStartOfDay } from "@/lib/date";

import {
  getStatusBadgeClass,
  getStatusDisplayLabel,
  normalizeStatus,
  SAMPLE_TESTING_STATUS_OPTIONS,
} from "@/lib/request";

import { useAdminRecordExport } from "@/hooks/admin";

const PAGE_SIZE = 20;
const STATUS_OPTIONS = SAMPLE_TESTING_STATUS_OPTIONS;
const ORDERING_OPTIONS = [
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
];

function canShowDocumentAction(status: string) {
  const normalized = normalizeStatus(status);
  return ["approved", "diproses", "completed"].includes(normalized);
}

export default function AdminSampleTestingHistoryPage() {
  const searchParams = useSearchParams();
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const queryParam = searchParams.get("q") ?? "";
  const statusParam = searchParams.get("status") ?? "";
  const requestedByParam = searchParams.get("requested_by") ?? "";
  const departmentParam = searchParams.get("department") ?? "";
  const orderingParam = searchParams.get("ordering") ?? "newest";
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(queryParam);
  const [debouncedSearch, setDebouncedSearch] = useState(queryParam);
  const [status, setStatus] = useState(statusParam);
  const [requestedBy, setRequestedBy] = useState(requestedByParam);
  const [department, setDepartment] = useState(departmentParam);
  const [ordering, setOrdering] = useState(orderingParam);
  const [createdRange, setCreatedRange] = useState<DateRange | undefined>();
  const [filterOpen, setFilterOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<SampleTestingRow | null>(null);
  const [detailTarget, setDetailTarget] = useState<SampleTestingRow | null>(null);
  const [documentsTarget, setDocumentsTarget] = useState<SampleTestingRow | null>(null);
  const [relatedUserId, setRelatedUserId] = useState<string | number | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Array<number | string>>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isExportingSelectedPdf, setIsExportingSelectedPdf] = useState(false);
  const [isExportingSelectedExcel, setIsExportingSelectedExcel] =
    useState(false);
  const [isLegacyImportOpen, setIsLegacyImportOpen] = useState(false);
  const createdAfter = createdRange?.from ? formatDateKey(createdRange.from) : "";
  const createdBefore = createdRange?.to
    ? formatDateKey(createdRange.to)
    : createdRange?.from
      ? formatDateKey(createdRange.from)
      : "";
  const { deleteRecord, deleteRecords, isDeleting } = useDeleteRecord();
  const { requesters } = useHistoryRequesterOptions(API_PENGUJIANS_ALL_REQUESTERS);
  const { exportPdf, exportExcel, isExportingPdf, isExportingExcel } =
    useAdminRecordExport({
      endpoint: API_PENGUJIANS_EXPORT,
      filters: {
        q: debouncedSearch,
        status,
        requested_by: requestedBy,
        department,
        created_after: createdAfter ? toStartOfDay(createdAfter) : "",
        created_before: createdBefore ? toEndOfDay(createdBefore) : "",
      },
      mapItem: mapSampleTesting,
      title: "Riwayat Pengujian Sampel",
      pdfFilename: "record-pengujian-sampel.pdf",
      excelFilename: "record-pengujian-sampel.xlsx",
      columns: SAMPLE_TESTING_EXPORT_COLUMNS,
      emptyMessage: "Tidak ada data pengujian sampel untuk diunduh.",
      pdfSuccessMessage: "PDF pengujian sampel berhasil diunduh.",
      excelSuccessMessage: "Excel pengujian sampel berhasil diunduh.",
    });

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(search.trim()), 500);
    return () => clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    setSearch(queryParam);
    setDebouncedSearch(queryParam);
    setStatus(statusParam);
    setRequestedBy(requestedByParam);
    setDepartment(departmentParam);
    setOrdering(orderingParam);
    setPage(1);
  }, [departmentParam, orderingParam, queryParam, requestedByParam, statusParam]);

  const {
    sampleTestings,
    totalCount,
    aggregates,
    isLoading,
    hasLoadedOnce,
    error,
  } = useSampleTestingList(
    page,
    PAGE_SIZE,
    {
      q: debouncedSearch,
      status,
      requestedBy,
      department,
      createdAfter: createdAfter ? toStartOfDay(createdAfter) : "",
      createdBefore: createdBefore ? toEndOfDay(createdBefore) : "",
    },
    reloadKey,
  );
  const {
    sampleTesting: detailSampleTesting,
    isLoading: isDetailLoading,
    error: detailError,
  } = useSampleTestingDetail(detailTarget?.id ?? null, reloadKey, {
    enabled: Boolean(detailTarget),
  });

  const visibleItems = useMemo(() => {
    const items = [...sampleTestings];

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
  }, [sampleTestings, ordering]);
  const selectedRows = useMemo(() => {
    const selectedIdSet = new Set(selectedIds.map((id) => String(id)));
    return sampleTestings.filter((item) => selectedIdSet.has(String(item.id)));
  }, [sampleTestings, selectedIds]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    [totalCount],
  );
  const selectedCount = selectedIds.length;
  const allVisibleSelected =
    visibleItems.length > 0 &&
    visibleItems.every((item) => selectedIds.includes(item.id));
  const someVisibleSelected =
    visibleItems.some((item) => selectedIds.includes(item.id)) &&
    !allVisibleSelected;

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) =>
        sampleTestings.some((item) => String(item.id) === String(id)),
      ),
    );
  }, [sampleTestings]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("");
    setRequestedBy("");
    setDepartment("");
    setOrdering("newest");
    setCreatedRange(undefined);
    setPage(1);
    setReloadKey((prev) => prev + 1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const result = await deleteRecord(API_PENGUJIAN_DETAIL(deleteTarget.id));
    if (result.ok) {
      toast.success("Riwayat pengujian sampel berhasil dihapus.");
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
        prev.filter((id) => !visibleItems.some((item) => item.id === id)),
      );
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleItems.forEach((item) => next.add(item.id));
      return Array.from(next);
    });
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const result = await deleteRecords(API_PENGUJIANS_BULK_DELETE, selectedIds);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    if (result.failedCount && result.deletedCount) {
      toast.success(
        `${result.deletedCount} record pengujian sampel berhasil dihapus.`,
      );
      toast.error(
        result.message ??
          `${result.failedCount} record pengujian sampel gagal dihapus.`,
      );
    } else {
      toast.success(
        result.message ??
          `${result.deletedCount} record pengujian sampel berhasil dihapus.`,
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
        title: "Riwayat Pengujian Sampel Terpilih",
        subtitle: `Total data: ${selectedRows.length}`,
        filename: "record-pengujian-sampel-terpilih.pdf",
        columns: SAMPLE_TESTING_EXPORT_COLUMNS,
        rows: selectedRows,
      });
      toast.success("PDF pengujian sampel terpilih berhasil diunduh.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mengunduh PDF data terpilih.",
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
        title: "Riwayat Pengujian Sampel Terpilih",
        filename: "record-pengujian-sampel-terpilih.xlsx",
        columns: SAMPLE_TESTING_EXPORT_COLUMNS,
        rows: selectedRows,
      });
      toast.success("Excel pengujian sampel terpilih berhasil diunduh.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mengunduh Excel data terpilih.",
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
            title="Riwayat Pengujian Sampel"
            description="Pantau histori pengujian sampel yang diajukan pengguna."
            icon={<Eye className="h-5 w-5 text-sky-200" />}
          />

          <AdminHistorySummaryCards
            items={[
              { label: "Total", value: aggregates.total, tone: "blue" },
              { label: "Menunggu", value: aggregates.pending },
              { label: "Disetujui", value: aggregates.approved },
              { label: "Diproses", value: aggregates.diproses },
              { label: "Selesai", value: aggregates.completed },
              { label: "Ditolak", value: aggregates.rejected },
            ]}
          />

          <AdminFilterCard
            open={filterOpen}
            onToggle={() => setFilterOpen((prev) => !prev)}
            onReset={resetFilters}
          >
            <form
              className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6"
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
                  placeholder="Kode, nama pemohon, institusi, atau jenis sampel"
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
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => setIsLegacyImportOpen(true)}
              >
                <History className="h-4 w-4" />
                Import Legacy
              </Button>
              <AdminHistoryExportActions
                onExportExcel={exportExcel}
                onExportPdf={exportPdf}
                isExportingExcel={isExportingExcel}
                isExportingPdf={isExportingPdf}
              />
            </div>
          </div>

          {error ? <InlineErrorAlert>{error}</InlineErrorAlert> : null}

          <AdminHistoryTable
            columns={[
              { label: "Kode" },
              { label: "Pemohon" },
              { label: "Institusi" },
              { label: "Jenis Sampel" },
              { label: "Status" },
              {
                label: "Aksi",
                className:
                  "sticky right-0 z-10 relative whitespace-nowrap bg-slate-900 px-3 py-3 text-center font-medium text-slate-50 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-700",
              },
            ]}
            colSpan={7}
            hasRows={visibleItems.length > 0}
            isLoading={isLoading}
            hasLoadedOnce={hasLoadedOnce}
            emptyMessage="Tidak ada data pengujian sampel."
            allVisibleSelected={allVisibleSelected}
            onToggleSelectAll={toggleSelectAllVisible}
            selectAllRef={selectAllRef}
          >
            {visibleItems.map((item) => (
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
                <td className="whitespace-nowrap px-3 py-2">{item.name}</td>
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                  {item.institution || "-"}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {item.sampleType}
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
                    <ActionTooltip label="Lihat detail">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => setDetailTarget(item)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </ActionTooltip>
                    {canShowDocumentAction(item.status) ? (
                      <ActionTooltip label="Dokumen pengujian">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                          onClick={() => setDocumentsTarget(item)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </ActionTooltip>
                    ) : null}
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
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            itemLabel="pengujian sampel"
            isLoading={isLoading}
            onPageChange={setPage}
          />

          <ConfirmDeleteDialog
            open={Boolean(deleteTarget)}
            title="Hapus record pengujian sampel?"
            description={`Riwayat ${deleteTarget?.code ?? ""} akan dihapus permanen.`}
            isDeleting={isDeleting}
            onOpenChange={(open) => {
              if (!open) setDeleteTarget(null);
            }}
            onConfirm={handleDelete}
          />

          <ConfirmDeleteDialog
            open={isBulkDeleteOpen}
            title="Hapus record pengujian sampel terpilih?"
            description={`${selectedCount} record yang dipilih akan dihapus permanen.`}
            isDeleting={isDeleting}
            onOpenChange={setIsBulkDeleteOpen}
            onConfirm={handleBulkDelete}
          />

          <Dialog
            open={Boolean(detailTarget)}
            onOpenChange={(open) => {
              if (!open) setDetailTarget(null);
            }}
          >
            <DialogContent
              showCloseButton={false}
              className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:w-[50vw] sm:max-w-[960px] sm:min-w-[720px] sm:max-w-none"
            >
              <DialogHeader className="sr-only">
                <DialogTitle>Detail Pengujian Sampel</DialogTitle>
                <DialogDescription>
                  Detail record pengujian sampel ditampilkan dalam modal.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[85vh] overflow-y-auto px-1 pt-1 pb-4">
                <div className="space-y-4">
                  <AdminSampleTestingHistoryDetailContent
                    item={detailSampleTesting}
                    isLoading={isDetailLoading}
                    error={detailError}
                    showAside={false}
                    backLabel="Tutup"
                    onBack={() => setDetailTarget(null)}
                    onOpenUserDetail={setRelatedUserId}
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <SampleTestingHistoryLegacyImportDialog
            open={isLegacyImportOpen}
            onOpenChange={setIsLegacyImportOpen}
            onCompleted={() => setReloadKey((prev) => prev + 1)}
          />

          <SampleTestingDocumentsDialog
            open={Boolean(documentsTarget)}
            onOpenChange={(open) => {
              if (!open) setDocumentsTarget(null);
            }}
            sampleTestingId={documentsTarget ? String(documentsTarget.id) : null}
            viewerRole="approver"
            allowActions={false}
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
