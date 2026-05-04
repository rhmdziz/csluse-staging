"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import {
  Check,
  Download,
  Eye,
  Loader2,
  Mail,
  ScrollText,
  Stamp,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AdminPageHeader, AdminFilterCard } from "@/components/admin/shared";
import {
  AdminHistoryBulkActions,
  AdminHistorySummaryCards,
  AdminHistoryTable,
  RelatedUserDetailDialog,
} from "@/components/admin/history";
import { AdminLabClearanceHistoryDetailContent } from "@/components/admin/history/content";
import {
  ActionTooltip,
  ConfirmDeleteDialog,
  DataPagination,
  InlineErrorAlert,
} from "@/components/shared";
import {
  Button,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  DateRangePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@/components/ui";
import {
  API_SURAT_BEBAS_LAB_BULK_DELETE,
  API_SURAT_BEBAS_LAB_DELETE,
} from "@/constants/api";
import { useLabClearanceList, useLabClearanceReview } from "@/hooks/lab-clearance";
import { buildSuratBebasPdf } from "@/lib/admin/surat-bebas-penggunaan-lab-pdf";
import { useDeleteRecord } from "@/hooks/use-delete-record";
import { formatDateKey, formatDateTimeWib, toEndOfDay, toStartOfDay } from "@/lib/date";
import { getStatusBadgeClass, getStatusDisplayLabel, normalizeStatus } from "@/lib/request";
import {
  labClearanceService,
  type LabClearanceDetail,
  type LabClearanceListItem,
} from "@/services/lab-clearance";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];

const ORDERING_OPTIONS = [
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
];

function isPendingStatus(status: string) {
  return normalizeStatus(status) === "pending";
}

function isApprovedStatus(status: string) {
  return normalizeStatus(status) === "approved";
}

export default function AdminLabClearanceHistoryPageContent() {
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [batch, setBatch] = useState("");
  const [ordering, setOrdering] = useState("newest");
  const [createdRange, setCreatedRange] = useState<DateRange | undefined>();
  const [filterOpen, setFilterOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<LabClearanceListItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<LabClearanceListItem | null>(null);
  const [detailData, setDetailData] = useState<LabClearanceDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [relatedUserId, setRelatedUserId] = useState<string | number | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<
    LabClearanceListItem | LabClearanceDetail | null
  >(null);
  const [rejectTarget, setRejectTarget] = useState<
    LabClearanceListItem | LabClearanceDetail | null
  >(null);
  const [rejectNote, setRejectNote] = useState("");
  const [generateDetail, setGenerateDetail] = useState<LabClearanceDetail | null>(null);
  const { deleteRecord, deleteRecords, isDeleting } = useDeleteRecord();
  const { approve, reject, pendingId } = useLabClearanceReview();

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(search.trim()), 500);
    return () => clearTimeout(timeoutId);
  }, [search]);

  const createdAfter = createdRange?.from ? formatDateKey(createdRange.from) : "";
  const createdBefore = createdRange?.to
    ? formatDateKey(createdRange.to)
    : createdRange?.from
      ? formatDateKey(createdRange.from)
      : "";

  const { items, totalCount, isLoading, hasLoadedOnce, error } = useLabClearanceList(
    page,
    PAGE_SIZE,
    "all",
    reloadKey,
    {
      search: debouncedSearch,
      status,
      batch,
      createdAfter: createdAfter ? toStartOfDay(createdAfter) : "",
      createdBefore: createdBefore ? toEndOfDay(createdBefore) : "",
      ordering,
    },
  );

  const visibleItems = useMemo(() => {
    const next = [...items];
    if (ordering === "oldest") {
      next.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      return next;
    }
    next.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return next;
  }, [items, ordering]);

  const selectedRows = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return visibleItems.filter((item) => selectedSet.has(String(item.id)));
  }, [selectedIds, visibleItems]);

  const selectedCount = selectedIds.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const allVisibleSelected =
    visibleItems.length > 0 && visibleItems.every((item) => selectedIds.includes(String(item.id)));
  const someVisibleSelected =
    visibleItems.some((item) => selectedIds.includes(String(item.id))) && !allVisibleSelected;

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) => visibleItems.some((item) => String(item.id) === id)),
    );
  }, [visibleItems]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  useEffect(() => {
    if (!detailTarget) {
      setDetailData(null);
      setDetailError("");
      return;
    }

    const controller = new AbortController();
    setIsDetailLoading(true);
    setDetailError("");
    labClearanceService
      .getDetail(String(detailTarget.id), controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!result) {
          setDetailError("Gagal memuat detail surat bebas lab.");
          return;
        }
        setDetailData(result);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setDetailError(
          loadError instanceof Error
            ? loadError.message
            : "Terjadi kesalahan saat memuat detail.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsDetailLoading(false);
      });

    return () => controller.abort();
  }, [detailTarget, reloadKey]);

  const loadDetail = async (id: string) => {
    const result = await labClearanceService.getDetail(id);
    if (!result) {
      toast.error("Gagal memuat detail surat bebas lab.");
      return null;
    }
    return result;
  };

  const summary = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const item of items) {
      const normalized = normalizeStatus(item.status);
      if (normalized === "pending") pending += 1;
      if (normalized === "approved") approved += 1;
      if (normalized === "rejected") rejected += 1;
    }
    return { total: totalCount, pending, approved, rejected };
  }, [items, totalCount]);

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("");
    setBatch("");
    setOrdering("newest");
    setCreatedRange(undefined);
    setPage(1);
    setReloadKey((prev) => prev + 1);
  };

  const toggleItemSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id],
    );
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    if (!checked) {
      setSelectedIds((prev) =>
        prev.filter((id) => !visibleItems.some((item) => String(item.id) === id)),
      );
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleItems.forEach((item) => next.add(String(item.id)));
      return Array.from(next);
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const result = await deleteRecord(API_SURAT_BEBAS_LAB_DELETE(String(deleteTarget.id)));
    if (result.ok) {
      toast.success("Riwayat surat bebas lab berhasil dihapus.");
      setDeleteTarget(null);
      setReloadKey((prev) => prev + 1);
      return;
    }
    toast.error(result.message);
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const result = await deleteRecords(API_SURAT_BEBAS_LAB_BULK_DELETE, selectedIds);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(
      result.message ?? `${result.deletedCount} record surat bebas lab berhasil dihapus.`,
    );
    setIsBulkDeleteOpen(false);
    setSelectedIds([]);
    setReloadKey((prev) => prev + 1);
  };

  const refreshAfterReview = async () => {
    setReloadKey((prev) => prev + 1);
    if (!detailTarget) return;
    const refreshed = await loadDetail(String(detailTarget.id));
    if (!refreshed) return;
    setDetailData(refreshed);
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    const result = await approve(String(approveTarget.id));
    if (!result.ok) {
      toast.error("Gagal menyetujui permohonan surat bebas lab.");
      return;
    }
    toast.success("Permohonan surat bebas lab berhasil disetujui.");
    setApproveTarget(null);
    await refreshAfterReview();
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    const result = await reject(String(rejectTarget.id), rejectNote);
    if (!result.ok) {
      toast.error("Gagal menolak permohonan surat bebas lab.");
      return;
    }
    toast.success("Permohonan surat bebas lab berhasil ditolak.");
    setRejectTarget(null);
    setRejectNote("");
    await refreshAfterReview();
  };

  const handleOpenGenerateDialog = async (item: LabClearanceListItem) => {
    const detail = await loadDetail(String(item.id));
    if (!detail) return;
    setGenerateDetail(detail);
  };

  const renderRowActions = (item: LabClearanceListItem) => (
    <>
      <ActionTooltip label="Lihat detail">
        <Button variant="outline" size="icon-sm" onClick={() => setDetailTarget(item)}>
          <Eye className="h-4 w-4" />
        </Button>
      </ActionTooltip>
      {isPendingStatus(item.status) ? (
        <>
          <ActionTooltip label="Setujui">
            <Button
              variant="outline"
              size="icon-sm"
              className="border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={() => setApproveTarget(item)}
            >
              <Check className="h-4 w-4" />
            </Button>
          </ActionTooltip>
          <ActionTooltip label="Tolak">
            <Button
              variant="outline"
              size="icon-sm"
              className="border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
              onClick={() => {
                setRejectTarget(item);
                setRejectNote("");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </ActionTooltip>
        </>
      ) : null}
      {isApprovedStatus(item.status) ? (
        <ActionTooltip label="Generate surat bebas">
          <Button
            variant="outline"
            size="icon-sm"
            className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
            onClick={() => void handleOpenGenerateDialog(item)}
          >
            <ScrollText className="h-4 w-4" />
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
    </>
  );

  const detailActions = detailData ? (
    <>
      {isPendingStatus(detailData.status) ? (
        <>
          <Button
            type="button"
            variant="outline"
            className="border-amber-200 text-amber-700 hover:bg-amber-50"
            onClick={() => {
              setRejectTarget(detailData);
              setRejectNote(detailData.note || "");
            }}
          >
            <X className="h-4 w-4" />
            Tolak
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => setApproveTarget(detailData)}
          >
            <Check className="h-4 w-4" />
            Setujui
          </Button>
        </>
      ) : null}
      {isApprovedStatus(detailData.status) ? (
        <Button
          type="button"
          className="bg-blue-700 text-white hover:bg-blue-800"
          onClick={() => void handleOpenGenerateDialog(detailData)}
        >
          <ScrollText className="h-4 w-4" />
          Generate Surat Bebas
        </Button>
      ) : null}
    </>
  ) : undefined;

  return (
    <section className="w-full min-w-0 space-y-4 px-4 pb-6">
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 space-y-4">
          <AdminPageHeader
            title="Riwayat Surat Bebas Lab"
            description="Pantau histori permohonan surat bebas laboratorium dari pengguna."
            icon={<Eye className="h-5 w-5 text-sky-200" />}
          />

          <AdminHistorySummaryCards
            items={[
              { label: "Total", value: summary.total, tone: "blue" },
              { label: "Menunggu", value: summary.pending },
              { label: "Disetujui", value: summary.approved },
              { label: "Ditolak", value: summary.rejected },
            ]}
          />

          <AdminFilterCard
            open={filterOpen}
            onToggle={() => setFilterOpen((prev) => !prev)}
            onReset={resetFilters}
          >
            <form
              className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5"
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
                  placeholder="Kode, nama pemohon, atau NIM"
                  className="h-8 border-slate-400 bg-white px-2 py-0 text-xs placeholder:text-xs shadow-xs focus-visible:border-sky-600 focus-visible:ring-sky-100"
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
                  Angkatan
                </label>
                <Input
                  value={batch}
                  placeholder="Contoh: 2021"
                  className="h-8 border-slate-400 bg-white px-2 py-0 text-xs shadow-xs focus-visible:border-sky-600 focus-visible:ring-sky-100"
                  onChange={(event) => {
                    setBatch(event.target.value);
                    setPage(1);
                  }}
                />
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
                onDeleteSelected={() => setIsBulkDeleteOpen(true)}
                onClearSelection={() => setSelectedIds([])}
                showExportActions={false}
              />
            </div>
          </div>

          {error ? <InlineErrorAlert>{error}</InlineErrorAlert> : null}

          <AdminHistoryTable
            columns={[
              { label: "Kode" },
              { label: "Pemohon" },
              { label: "Angkatan" },
              { label: "Status" },
              { label: "Diajukan" },
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
            emptyMessage="Tidak ada data surat bebas lab."
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
                    checked={selectedIds.includes(String(item.id))}
                    onChange={() => toggleItemSelection(String(item.id))}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-medium">{item.code}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {item.requested_by_detail?.full_name || "-"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                  {item.requested_by_detail?.batch || "-"}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusBadgeClass(item.status)}`}
                  >
                    {getStatusDisplayLabel(item.status)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {formatDateTimeWib(item.created_at)}
                </td>
                <td className="sticky right-0 z-10 relative bg-card px-3 py-2 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200">
                  <div className="flex justify-center gap-2">{renderRowActions(item)}</div>
                </td>
              </tr>
            ))}
          </AdminHistoryTable>

          <DataPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            itemLabel="surat bebas lab"
            isLoading={isLoading}
            onPageChange={setPage}
          />

          <ConfirmDeleteDialog
            open={Boolean(deleteTarget)}
            title="Hapus record surat bebas lab?"
            description={`Riwayat ${deleteTarget?.code ?? ""} akan dihapus permanen.`}
            isDeleting={isDeleting}
            onOpenChange={(open) => {
              if (!open) setDeleteTarget(null);
            }}
            onConfirm={handleDelete}
          />

          <ConfirmDeleteDialog
            open={isBulkDeleteOpen}
            title="Hapus record surat bebas lab terpilih?"
            description={`${selectedCount} record yang dipilih akan dihapus permanen.`}
            isDeleting={isDeleting}
            onOpenChange={setIsBulkDeleteOpen}
            onConfirm={handleBulkDelete}
          />

          <Dialog
            open={Boolean(detailTarget)}
            onOpenChange={(open) => {
              if (!open) {
                setDetailTarget(null);
                setDetailData(null);
                setDetailError("");
              }
            }}
          >
            <DialogContent
              showCloseButton={false}
              className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:w-[50vw] sm:max-w-[960px] sm:min-w-[720px] sm:max-w-none"
            >
              <DialogHeader className="sr-only">
                <DialogTitle>Detail Surat Bebas Lab</DialogTitle>
                <DialogDescription>
                  Detail record surat bebas lab ditampilkan dalam modal.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[85vh] overflow-y-auto px-1 pt-1 pb-4">
                <div className="space-y-4">
                  <AdminLabClearanceHistoryDetailContent
                    item={detailData}
                    isLoading={isDetailLoading}
                    error={detailError}
                    actions={detailActions}
                    showAside={false}
                    backLabel="Tutup"
                    onBack={() => setDetailTarget(null)}
                    onOpenUserDetail={setRelatedUserId}
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <RelatedUserDetailDialog
            open={Boolean(relatedUserId)}
            userId={relatedUserId}
            onOpenChange={(open) => {
              if (!open) setRelatedUserId(null);
            }}
          />

          <AlertDialog
            open={Boolean(approveTarget)}
            onOpenChange={(open) => {
              if (!open) setApproveTarget(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Setujui permohonan surat bebas lab?</AlertDialogTitle>
                <AlertDialogDescription>
                  Permohonan {approveTarget?.code ?? "-"} akan ditandai sebagai disetujui.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pendingId === String(approveTarget?.id ?? "")}>
                  Batal
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={pendingId === String(approveTarget?.id ?? "")}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => void handleApprove()}
                >
                  {pendingId === String(approveTarget?.id ?? "") ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    "Ya, Setujui"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog
            open={Boolean(rejectTarget)}
            onOpenChange={(open) => {
              if (!open) {
                setRejectTarget(null);
                setRejectNote("");
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tolak permohonan surat bebas lab?</AlertDialogTitle>
                <AlertDialogDescription>
                  Permohonan {rejectTarget?.code ?? "-"} akan ditandai sebagai ditolak.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 px-6 py-1">
                <label className="text-xs font-medium text-slate-700">
                  Catatan Penolakan <span className="text-slate-400">(opsional)</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectNote}
                  onChange={(event) => setRejectNote(event.target.value)}
                  placeholder="Contoh: Dokumen belum lengkap atau data masih perlu diperbaiki."
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#0048B4]"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pendingId === String(rejectTarget?.id ?? "")}>
                  Batal
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={pendingId === String(rejectTarget?.id ?? "")}
                  className="bg-amber-600 text-white hover:bg-amber-700"
                  onClick={() => void handleReject()}
                >
                  {pendingId === String(rejectTarget?.id ?? "") ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    "Ya, Tolak"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <DialogGenerateSurat
            detail={generateDetail}
            onOpenChange={(open) => {
              if (!open) setGenerateDetail(null);
            }}
          />
        </div>
      </div>
    </section>
  );
}

function DialogGenerateSurat({
  detail,
  onOpenChange,
}: {
  detail: LabClearanceDetail | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const recipientEmail = detail?.requested_by_detail?.email?.trim() || "-";

  useEffect(() => {
    let isActive = true;

    if (!detail) {
      setIsPdfLoading(false);
      setPdfBlob(null);
      setPdfFilename("");
      setSendConfirmOpen(false);
      setPdfBlobUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
      return;
    }

    setIsPdfLoading(true);
    setPdfBlob(null);
    setPdfFilename("");

    void buildSuratBebasPdf(detail)
      .then(({ blob, blobUrl, filename }) => {
        if (!isActive) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        setPdfBlobUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return blobUrl;
        });
        setPdfBlob(blob);
        setPdfFilename(filename);
      })
      .catch(() => {
        if (!isActive) return;
        toast.error("Gagal membuat surat bebas laboratorium.");
        setPdfBlob(null);
        setPdfFilename("");
        setPdfBlobUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return null;
        });
      })
      .finally(() => {
        if (isActive) setIsPdfLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [detail]);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  function handleDownload() {
    if (!pdfBlobUrl || !pdfFilename) return;
    const anchor = document.createElement("a");
    anchor.href = pdfBlobUrl;
    anchor.download = pdfFilename;
    anchor.click();
  }

  async function handleSendEmail() {
    if (!detail || !pdfBlob) return;
    setIsSending(true);
    const result = await labClearanceService.sendLetter(String(detail.id), pdfBlob);
    setIsSending(false);
    setSendConfirmOpen(false);

    if (!result.ok) {
      toast.error("Gagal mengirim surat ke email pemohon.");
      return;
    }

    toast.success("Surat berhasil dikirim ke email pemohon.");
  }

  return (
    <>
      <Dialog
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open) onOpenChange(false);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[96vh] w-[calc(100vw-1rem)] !max-w-[1200px] flex-col overflow-hidden border-slate-200 p-0 shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:w-[96vw]"
        >
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <ScrollText className="h-5 w-5 text-emerald-600" />
              Surat Bebas Penggunaan Laboratorium
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Preview surat yang akan dikirim ke pemohon.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto bg-slate-100 px-6 py-5">
            {isPdfLoading ? (
              <div className="flex h-[65vh] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-500 sm:h-[70vh]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Membuat surat PDF...
              </div>
            ) : pdfBlobUrl ? (
              <iframe
                src={pdfBlobUrl}
                title="Preview Surat Bebas Lab"
                className="h-[65vh] w-full rounded-lg border border-slate-200 bg-white sm:h-[70vh]"
              />
            ) : (
              <div className="flex h-[65vh] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-400 sm:h-[70vh]">
                Gagal memuat preview.
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 px-6 py-4">
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Tutup
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!pdfBlobUrl || isPdfLoading}
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button
                type="button"
                disabled={!pdfBlob || isPdfLoading || isSending}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => setSendConfirmOpen(true)}
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Kirim ke Email
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kirim surat ke email pemohon?</AlertDialogTitle>
            <AlertDialogDescription>
              Surat bebas lab akan dikirim ke <span className="font-medium">{recipientEmail}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSending || !pdfBlob}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => void handleSendEmail()}
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mengirim...
                </>
              ) : (
                "Ya, Kirim"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
