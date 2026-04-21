"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { AdminHistoryTable, AdminRecordDetailItem } from "@/components/admin/history";
import { AdminFilterCard, AdminPageHeader } from "@/components/admin/shared";
import {
  AdminDetailDialogShell,
  DataPagination,
  DocumentPreviewDialog,
  InlineErrorAlert,
} from "@/components/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DateRangePicker,
  DialogFooter,
  Input,
} from "@/components/ui";

import { useLabClearanceList, useLabClearanceReview } from "@/hooks/lab-clearance";
import { labClearanceService as adminLabClearanceService, type LabClearanceResult } from "@/services/admin";
import { formatDateKey, formatDateTimeWib, toEndOfDay, toStartOfDay } from "@/lib/date";
import { getRequestStatusDisplayLabel, getStatusBadgeClass } from "@/lib/request";
import {
  labClearanceService,
  type LabClearanceDetail,
  type LabClearanceDocument,
} from "@/services/lab-clearance";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "Pending", label: "Menunggu" },
  { value: "Approved", label: "Disetujui" },
  { value: "Rejected", label: "Ditolak" },
];

const ORDERING_OPTIONS = [
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
];

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  form_alat_kecil: "F-027A Alat Kecil",
  form_alat_besar: "F-027B Alat Besar",
  form_permintaan_bahan: "F-028 Bahan",
};

const SERVICE_TYPE_LABEL: Record<string, string> = {
  borrow: "Peminjaman Alat",
  booking: "Pemesanan Ruangan",
  pengujian: "Pengujian Sampel",
};

function mapPreviewDocument(document: LabClearanceDocument) {
  return {
    id: document.id,
    documentType: document.document_type,
    documentLabel: DOCUMENT_TYPE_LABEL[document.document_type] ?? document.document_type,
    originalName: document.original_name,
    mimeType: document.mime_type,
    size: document.size,
    url: document.document_url ?? "",
    uploadedById: "",
    uploadedByName: "-",
    createdAt: document.created_at,
    updatedAt: document.created_at,
  };
}

export default function AdminLabClearanceContent() {
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [batch, setBatch] = useState("");
  const [debouncedBatch, setDebouncedBatch] = useState("");
  const [ordering, setOrdering] = useState("newest");
  const [createdRange, setCreatedRange] = useState<DateRange | undefined>();
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [detailsById, setDetailsById] = useState<Record<string, LabClearanceDetail | null>>({});
  const [loadingDetailIds, setLoadingDetailIds] = useState<Record<string, boolean>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [reviewTargetId, setReviewTargetId] = useState<string | null>(null);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [previewDocument, setPreviewDocument] = useState<LabClearanceDocument | null>(null);
  const [clearanceChecks, setClearanceChecks] = useState<Record<string, LabClearanceResult | null>>({});
  const [loadingClearanceIds, setLoadingClearanceIds] = useState<Record<string, boolean>>({});
  const [clearanceCheckErrors, setClearanceCheckErrors] = useState<Record<string, string>>({});

  const createdAfter = createdRange?.from ? formatDateKey(createdRange.from) : "";
  const createdBefore = createdRange?.to
    ? formatDateKey(createdRange.to)
    : createdRange?.from
      ? formatDateKey(createdRange.from)
      : "";

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(search.trim()), 1000);
    return () => clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedBatch(batch.trim()), 1000);
    return () => clearTimeout(timeoutId);
  }, [batch]);

  const { items, totalCount, isLoading, hasLoadedOnce, error } = useLabClearanceList(
    page,
    PAGE_SIZE,
    "all",
    reloadKey,
    {
      search: debouncedSearch,
      status,
      batch: debouncedBatch,
      createdAfter: createdAfter ? toStartOfDay(createdAfter) : "",
      createdBefore: createdBefore ? toEndOfDay(createdBefore) : "",
      ordering,
    },
  );
  const { approve, reject, pendingId } = useLabClearanceReview();

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const allVisibleSelected =
    items.length > 0 && items.every((item) => selectedIds.includes(String(item.id)));
  const someVisibleSelected =
    items.some((item) => selectedIds.includes(String(item.id))) && !allVisibleSelected;

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => items.some((item) => String(item.id) === id)));
    setExpandedRows((prev) => {
      const next: Record<string, boolean> = {};
      items.forEach((item) => {
        const key = String(item.id);
        next[key] = prev[key] ?? false;
      });
      return next;
    });
  }, [items]);

  const reviewTarget = reviewTargetId ? detailsById[reviewTargetId] ?? null : null;
  const isReviewLoading = reviewTargetId ? Boolean(loadingDetailIds[reviewTargetId]) : false;
  const reviewLoadError = reviewTargetId ? detailErrors[reviewTargetId] ?? "" : "";

  const totalDocumentsOnPage = useMemo(
    () => items.reduce((total, item) => total + item.documents.length, 0),
    [items],
  );

  const fetchClearanceCheck = async (itemId: string, profileId: string) => {
    if (clearanceChecks[itemId] !== undefined || loadingClearanceIds[itemId]) return;
    setLoadingClearanceIds((prev) => ({ ...prev, [itemId]: true }));
    setClearanceCheckErrors((prev) => ({ ...prev, [itemId]: "" }));
    try {
      const result = await adminLabClearanceService.getLabClearance(profileId);
      setClearanceChecks((prev) => ({ ...prev, [itemId]: result }));
    } catch (err) {
      setClearanceCheckErrors((prev) => ({
        ...prev,
        [itemId]: err instanceof Error ? err.message : "Gagal memuat status tanggungan.",
      }));
    } finally {
      setLoadingClearanceIds((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const ensureDetailLoaded = async (id: string) => {
    if (detailsById[id] || loadingDetailIds[id]) return;

    setLoadingDetailIds((prev) => ({ ...prev, [id]: true }));
    setDetailErrors((prev) => ({ ...prev, [id]: "" }));

    try {
      const detail = await labClearanceService.getDetail(id);
      if (!detail) {
        setDetailErrors((prev) => ({ ...prev, [id]: "Gagal memuat detail permohonan." }));
        return;
      }

      setDetailsById((prev) => ({ ...prev, [id]: detail }));
    } catch (loadError) {
      setDetailErrors((prev) => ({
        ...prev,
        [id]: loadError instanceof Error ? loadError.message : "Terjadi kesalahan saat memuat dokumen.",
      }));
    } finally {
      setLoadingDetailIds((prev) => ({ ...prev, [id]: false }));
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenReview = (id: string) => {
    setReviewError("");
    setRejectNote("");
    setApproveConfirmOpen(false);
    setRejectConfirmOpen(false);
    setReviewTargetId(id);
    void ensureDetailLoaded(id);
    const item = items.find((i) => String(i.id) === id);
    const profileId = item?.requested_by_detail?.id;
    if (profileId) void fetchClearanceCheck(id, profileId);
  };

  const handleApprove = async () => {
    if (!reviewTargetId) return;

    const result = await approve(reviewTargetId);
    if (result.ok) {
      toast.success(`Permohonan ${reviewTarget?.code ?? ""} disetujui.`);
      setReviewTargetId(null);
      setReloadKey((current) => current + 1);
      setDetailsById((prev) => {
        const next = { ...prev };
        delete next[reviewTargetId];
        return next;
      });
      return;
    }

    setReviewError("Gagal menyetujui permohonan. Coba lagi.");
  };

  const handleReject = async () => {
    if (!reviewTargetId) return;

    setReviewError("");
    const result = await reject(reviewTargetId, rejectNote);
    if (result.ok) {
      toast.success(`Permohonan ${reviewTarget?.code ?? ""} ditolak.`);
      setReviewTargetId(null);
      setRejectNote("");
      setReloadKey((current) => current + 1);
      setDetailsById((prev) => {
        const next = { ...prev };
        delete next[reviewTargetId];
        return next;
      });
      return;
    }

    setReviewError("Gagal menolak permohonan. Coba lagi.");
  };

  const toggleItemSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    if (!checked) {
      setSelectedIds((prev) => prev.filter((id) => !items.some((item) => String(item.id) === id)));
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      items.forEach((item) => next.add(String(item.id)));
      return Array.from(next);
    });
  };

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("");
    setBatch("");
    setDebouncedBatch("");
    setOrdering("newest");
    setCreatedRange(undefined);
    setPage(1);
  };

  return (
    <section className="w-full min-w-0 space-y-4 px-4 pb-6">
      <AdminPageHeader
        eyebrow="Dokumen"
        title="Surat Bebas Laboratorium"
        description="Kelola permohonan surat bebas laboratorium dari mahasiswa tugas akhir."
        icon={<FileText className="h-5 w-5 text-white" />}
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
              Cari Pemohon
            </label>
            <Input
              type="search"
              value={search}
              placeholder="Ketik nama pemohon"
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
              Angkatan
            </label>
            <Input
              value={batch}
              placeholder="Contoh: 2022"
              className="h-8 border-slate-400 bg-white px-2 py-0 text-xs placeholder:text-xs md:text-xs shadow-xs focus-visible:border-sky-600 focus-visible:ring-sky-100"
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
              Tanggal Pengajuan
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

      {error ? <InlineErrorAlert>{error}</InlineErrorAlert> : null}

      <AdminHistoryTable
        columns={[
          { label: "Kode" },
          { label: "Pemohon" },
          { label: "Status" },
          { label: "Jumlah Dokumen" },
          { label: "Tanggal Pengajuan" },
          {
            label: "Aksi",
            className:
              "sticky right-0 z-10 relative whitespace-nowrap bg-slate-900 px-3 py-3 text-center font-medium text-slate-50 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-700",
          },
        ]}
        colSpan={7}
        hasRows={items.length > 0}
        isLoading={isLoading}
        hasLoadedOnce={hasLoadedOnce}
        emptyMessage="Belum ada permohonan masuk."
        allVisibleSelected={allVisibleSelected}
        onToggleSelectAll={toggleSelectAllVisible}
        selectAllRef={selectAllRef}
        selectAllAriaLabel="Pilih semua permohonan pada halaman ini"
      >
        {items.map((item) => {
          const rowId = String(item.id);
          const isExpanded = expandedRows[rowId] ?? false;

          return (
            <Fragment key={rowId}>
              <tr className="border-b bg-slate-50/70">
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    aria-label={`Pilih permohonan ${item.code}`}
                    className="h-4 w-4 rounded border-slate-300 align-middle"
                    checked={selectedIds.includes(rowId)}
                    onChange={() => toggleItemSelection(rowId)}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">{item.code}</td>
                <td className="px-3 py-2">
                  <p className="font-medium text-slate-800">
                    {item.requested_by_detail?.full_name || "-"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.requested_by_detail?.id_number || item.requested_by_detail?.email || "-"}
                  </p>
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusBadgeClass(item.status)}`}
                  >
                    {getRequestStatusDisplayLabel(item.status)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2">{item.document_count} dokumen</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                  {formatDateTimeWib(item.created_at)}
                </td>
                <td className="sticky right-0 z-10 relative bg-slate-50/70 px-3 py-2 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200">
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="border-slate-200 text-slate-700 hover:bg-slate-100"
                      onClick={() => toggleRow(rowId)}
                      aria-label={`${isExpanded ? "Sembunyikan" : "Lihat"} dokumen ${item.code}`}
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="border-sky-200 text-sky-700 hover:bg-sky-50"
                      onClick={() => handleOpenReview(rowId)}
                      aria-label={`Review permohonan ${item.code}`}
                    >
                      <ClipboardCheck className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>

              {isExpanded ? (
                <tr className="border-b bg-white">
                  <td colSpan={7} className="px-3 py-3">
                    {item.documents.length ? (
                      <div className="overflow-x-auto rounded-md border border-slate-200">
                        <table className="min-w-full table-auto">
                          <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                            <tr>
                              <th className="whitespace-nowrap px-3 py-2 font-semibold">Jenis Dokumen</th>
                              <th className="whitespace-nowrap px-3 py-2 font-semibold">Nama File</th>
                              <th className="whitespace-nowrap px-3 py-2 font-semibold">Diunggah</th>
                              <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm">
                            {item.documents.map((document) => (
                              <tr key={document.id} className="border-t last:border-b-0">
                                <td className="whitespace-nowrap px-3 py-2">
                                  {DOCUMENT_TYPE_LABEL[document.document_type] ?? document.document_type}
                                </td>
                                <td className="max-w-96 px-3 py-2">
                                  <p className="truncate" title={document.original_name}>
                                    {document.original_name}
                                  </p>
                                </td>
                                <td className="whitespace-nowrap px-3 py-2">
                                  {formatDateTimeWib(document.created_at)}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex justify-center gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon-sm"
                                      className="border-sky-200 text-sky-600 hover:bg-sky-50 hover:text-sky-700"
                                      onClick={() => setPreviewDocument(document)}
                                      aria-label={`Preview dokumen ${document.original_name}`}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      asChild
                                      variant="outline"
                                      size="icon-sm"
                                      className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                    >
                                      <a
                                        href={document.document_url ?? "#"}
                                        target="_blank"
                                        rel="noreferrer"
                                        aria-label={`Buka dokumen ${document.original_name}`}
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                      </a>
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="rounded-md border border-slate-200 px-4 py-4 text-sm text-slate-500">
                        Dokumen belum tersedia.
                      </div>
                    )}
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </AdminHistoryTable>

      <DataPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        itemLabel="permohonan"
        isLoading={isLoading}
        onPageChange={setPage}
      />

      <DocumentPreviewDialog
        open={Boolean(previewDocument)}
        onOpenChange={(open) => {
          if (!open) setPreviewDocument(null);
        }}
        document={previewDocument ? mapPreviewDocument(previewDocument) : null}
      />

      <DialogReview
        open={Boolean(reviewTargetId)}
        onOpenChange={(open) => {
          if (!open) {
            setReviewTargetId(null);
            setRejectNote("");
            setReviewError("");
            setApproveConfirmOpen(false);
            setRejectConfirmOpen(false);
          }
        }}
        detail={reviewTarget}
        isLoading={isReviewLoading}
        errorMessage={reviewLoadError || reviewError}
        rejectNote={rejectNote}
        approveConfirmOpen={approveConfirmOpen}
        rejectConfirmOpen={rejectConfirmOpen}
        pendingId={pendingId}
        clearanceCheck={reviewTargetId ? (clearanceChecks[reviewTargetId] ?? null) : null}
        isLoadingClearance={reviewTargetId ? Boolean(loadingClearanceIds[reviewTargetId]) : false}
        clearanceCheckError={reviewTargetId ? (clearanceCheckErrors[reviewTargetId] ?? "") : ""}
        onRejectNoteChange={setRejectNote}
        onApproveConfirmOpenChange={setApproveConfirmOpen}
        onRejectConfirmOpenChange={setRejectConfirmOpen}
        onApprove={handleApprove}
        onReject={handleReject}
        onPreview={setPreviewDocument}
      />
    </section>
  );
}

function DialogReview({
  open,
  onOpenChange,
  detail,
  isLoading,
  errorMessage,
  rejectNote,
  approveConfirmOpen,
  rejectConfirmOpen,
  pendingId,
  clearanceCheck,
  isLoadingClearance,
  clearanceCheckError,
  onRejectNoteChange,
  onApproveConfirmOpenChange,
  onRejectConfirmOpenChange,
  onApprove,
  onReject,
  onPreview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: LabClearanceDetail | null;
  isLoading: boolean;
  errorMessage: string;
  rejectNote: string;
  approveConfirmOpen: boolean;
  rejectConfirmOpen: boolean;
  pendingId: string | null;
  clearanceCheck: LabClearanceResult | null;
  isLoadingClearance: boolean;
  clearanceCheckError: string;
  onRejectNoteChange: (value: string) => void;
  onApproveConfirmOpenChange: (open: boolean) => void;
  onRejectConfirmOpenChange: (open: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
  onPreview: (document: LabClearanceDocument) => void;
}) {
  const isSubmitting = Boolean(detail?.id && pendingId === detail.id);

  return (
    <>
      <AdminDetailDialogShell
        open={open}
        onOpenChange={onOpenChange}
        title={`Review Surat Bebas Laboratorium${detail?.code ? ` • ${detail.code}` : ""}`}
        description="Periksa dokumen yang diunggah sebelum menyetujui atau menolak permohonan."
        icon={<ClipboardCheck className="h-5 w-5" />}
        contentClassName="w-[min(960px,calc(100%-2rem))] max-w-none gap-0 p-0 sm:max-w-none [--primary:#0048B4] [--primary-foreground:#FFFFFF] [--ring:#3B82F6]"
      >
        <div className="space-y-4 px-6 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat dokumen permohonan...
            </div>
          ) : errorMessage ? (
            <InlineErrorAlert>{errorMessage}</InlineErrorAlert>
          ) : detail ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Informasi Pemohon
                  </p>
                  <div className="grid gap-3">
                    <AdminRecordDetailItem
                      label="Nama Pemohon"
                      value={detail.requested_by_detail?.full_name || "-"}
                    />
                    <AdminRecordDetailItem
                      label="NIM"
                      value={detail.requested_by_detail?.id_number || "-"}
                    />
                    <AdminRecordDetailItem
                      label="Prodi Pemohon"
                      value={detail.requested_by_detail?.department || "-"}
                    />
                    <AdminRecordDetailItem
                      label="Angkatan"
                      value={detail.requested_by_detail?.batch || "-"}
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Informasi Review
                  </p>
                  <div className="grid gap-3">
                    <AdminRecordDetailItem label="Status" value={detail.status} status />
                    <AdminRecordDetailItem
                      label="Diajukan Pada"
                      value={formatDateTimeWib(detail.created_at)}
                    />
                    <AdminRecordDetailItem
                      label="Direview Pada"
                      value={detail.reviewed_at ? formatDateTimeWib(detail.reviewed_at) : "-"}
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="min-w-full table-auto">
                  <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="whitespace-nowrap px-3 py-2 font-semibold">Jenis Dokumen</th>
                      <th className="whitespace-nowrap px-3 py-2 font-semibold">Nama File</th>
                      <th className="whitespace-nowrap px-3 py-2 font-semibold">Diunggah</th>
                      <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {detail.documents.map((document) => (
                      <tr key={document.id} className="border-t last:border-b-0">
                        <td className="whitespace-nowrap px-3 py-2">
                          {DOCUMENT_TYPE_LABEL[document.document_type] ?? document.document_type}
                        </td>
                        <td className="max-w-96 px-3 py-2">
                          <p className="truncate" title={document.original_name}>
                            {document.original_name}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {formatDateTimeWib(document.created_at)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              className="border-sky-200 text-sky-600 hover:bg-sky-50 hover:text-sky-700"
                              onClick={() => onPreview(document)}
                              aria-label={`Preview dokumen ${document.original_name}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              asChild
                              variant="outline"
                              size="icon-sm"
                              className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <a
                                href={document.document_url ?? "#"}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Buka dokumen ${document.original_name}`}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {detail.note ? (
                <div className="rounded-lg border border-rose-100 bg-rose-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">
                    Catatan Review
                  </p>
                  <p className="mt-1 text-sm text-rose-700">{detail.note}</p>
                </div>
              ) : null}

              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Status Bebas Tanggungan
                </p>
                {isLoadingClearance ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memeriksa status tanggungan...
                  </div>
                ) : clearanceCheckError ? (
                  <p className="text-sm text-rose-600">{clearanceCheckError}</p>
                ) : clearanceCheck ? (
                  clearanceCheck.isClear ? (
                    <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      <p className="text-sm font-medium text-emerald-700">
                        Tidak ada tanggungan aktif — bebas laboratorium
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                        <p className="text-sm font-medium text-rose-700">
                          Ada {clearanceCheck.summary.totalActive} tanggungan aktif
                        </p>
                      </div>
                      <div className="overflow-x-auto rounded-md border border-rose-100">
                        <table className="min-w-full table-auto">
                          <thead className="bg-rose-50 text-left text-xs uppercase tracking-wide text-rose-400">
                            <tr>
                              <th className="whitespace-nowrap px-3 py-2 font-semibold">Kode</th>
                              <th className="whitespace-nowrap px-3 py-2 font-semibold">Jenis</th>
                              <th className="whitespace-nowrap px-3 py-2 font-semibold">Status</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm">
                            {clearanceCheck.activeServices.map((service) => (
                              <tr key={service.id} className="border-t last:border-b-0">
                                <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-800">
                                  {service.code}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                                  {SERVICE_TYPE_LABEL[service.type] ?? service.type}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                                  {service.status}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                ) : null}
              </div>
            </>
            ) : null}
        </div>

        <div className="border-t border-slate-200 px-6 py-4">
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              className="rounded-md border-slate-300 text-sm"
              onClick={() => onOpenChange(false)}
            >
              Tutup
            </Button>
            {detail?.status === "Pending" ? (
              <>
                <Button
                  type="button"
                  disabled={isSubmitting}
                  variant="outline"
                  className="rounded-md border-rose-200 text-sm text-rose-700 hover:bg-rose-50"
                  onClick={() => onRejectConfirmOpenChange(true)}
                >
                  Tolak
                </Button>
                <Button
                  type="button"
                  disabled={isSubmitting}
                  className="rounded-md bg-[#0052C7] text-sm text-white hover:bg-[#0048B4]"
                  onClick={() => onApproveConfirmOpenChange(true)}
                >
                  Setujui
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </div>
      </AdminDetailDialogShell>

      <AlertDialog
        open={approveConfirmOpen}
        onOpenChange={(nextOpen) => {
          if (isSubmitting) return;
          onApproveConfirmOpenChange(nextOpen);
        }}
      >
        <AlertDialogContent className="rounded-lg border-slate-200 shadow-[0_18px_48px_rgba(15,23,42,0.16)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Setujui Permohonan</AlertDialogTitle>
            <AlertDialogDescription>
              {`Permohonan ${detail?.code ?? ""} akan disetujui. Pastikan semua dokumen sudah sesuai.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              className="rounded-md bg-[#0052C7] text-white hover:bg-[#0048B4]"
              onClick={() => void onApprove()}
            >
              {isSubmitting ? (
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
        open={rejectConfirmOpen}
        onOpenChange={(nextOpen) => {
          if (isSubmitting) return;
          onRejectConfirmOpenChange(nextOpen);
        }}
      >
        <AlertDialogContent className="max-w-md rounded-lg border-slate-200 p-0 shadow-[0_18px_48px_rgba(15,23,42,0.16)]">
          <AlertDialogHeader className="border-b border-slate-200 px-6 py-5 text-left">
            <AlertDialogTitle>Tolak Permohonan</AlertDialogTitle>
            <AlertDialogDescription>
              {`Permohonan ${detail?.code ?? ""} akan ditolak. Tambahkan catatan bila diperlukan.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 px-6 py-5">
            <label className="text-xs font-medium text-slate-700">
              Catatan Penolakan <span className="text-slate-400">(opsional)</span>
            </label>
            <textarea
              rows={3}
              value={rejectNote}
              onChange={(event) => onRejectNoteChange(event.target.value)}
              placeholder="Contoh: Formulir belum lengkap atau dokumen tidak sesuai."
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#0048B4]"
            />
          </div>
          <div className="border-t border-slate-200 px-6 py-4">
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>Batal</AlertDialogCancel>
              <AlertDialogAction
                disabled={isSubmitting}
                className="rounded-md bg-rose-600 text-white hover:bg-rose-700"
                onClick={() => void onReject()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  "Ya, Tolak"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
