"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Mail,
  PackageSearch,
  RotateCcw,
  ScrollText,
  UserRound,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  DataPagination,
  DocumentPreviewDialog,
  InlineErrorAlert,
  TableActionIconButton,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";

import {
  useLabClearanceList,
  useLabClearanceReview,
} from "@/hooks/lab-clearance";
import {
  labClearanceService as adminLabClearanceService,
  type LabClearanceResult,
} from "@/services/admin";
import { formatDateTimeWib, toEndOfDay, toStartOfDay } from "@/lib/date";
import { downloadDocumentFile, isPreviewableDocumentFile } from "@/lib/core";
import {
  getRequestStatusDisplayLabel,
  getStatusBadgeClass,
  normalizeStatus,
} from "@/lib/request";
import { buildSuratBebasPdf } from "@/lib/admin/surat-bebas-penggunaan-lab-pdf";
import {
  labClearanceService,
  type LabClearanceDetail,
  type LabClearanceDocument,
} from "@/services/lab-clearance";
import {
  LabClearanceApprovalDetailDialogShell,
  LabClearanceMetaItem,
  LabClearanceSectionCard,
} from "./LabClearanceApprovalComponents";
import { SampleTestingSummaryCard } from "@/components/dashboard/sample-testing";

const PAGE_SIZE = 20;

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

const ACTIVE_BORROW_STATUSES = new Set([
  "Borrowed",
  "Returned Pending Inspection",
  "Overdue",
  "Lost/Damaged",
]);

function mapPreviewDocument(document: LabClearanceDocument) {
  return {
    id: document.id,
    documentType: document.document_type,
    documentLabel:
      DOCUMENT_TYPE_LABEL[document.document_type] ?? document.document_type,
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

export function LabClearanceApprovalPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [detailsById, setDetailsById] = useState<
    Record<string, LabClearanceDetail | null>
  >({});
  const [loadingDetailIds, setLoadingDetailIds] = useState<
    Record<string, boolean>
  >({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [reviewTargetId, setReviewTargetId] = useState<string | null>(null);
  const [generateSuratDetail, setGenerateSuratDetail] =
    useState<LabClearanceDetail | null>(null);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [previewDocument, setPreviewDocument] =
    useState<LabClearanceDocument | null>(null);
  const [clearanceChecks, setClearanceChecks] = useState<
    Record<string, LabClearanceResult | null>
  >({});
  const [loadingClearanceIds, setLoadingClearanceIds] = useState<
    Record<string, boolean>
  >({});
  const [clearanceCheckErrors, setClearanceCheckErrors] = useState<
    Record<string, string>
  >({});

  const search = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const batch = searchParams.get("batch") ?? "";
  const ordering = searchParams.get("ordering") ?? "newest";
  const createdAfter = searchParams.get("created_after") ?? "";
  const createdBefore = searchParams.get("created_before") ?? "";
  const emptyMessage =
    normalizeStatus(status) === "active"
      ? "Tidak ada permohonan aktif surat bebas laboratorium yang perlu Anda proses."
      : "Belum ada permohonan surat bebas laboratorium yang perlu Anda proses.";

  useEffect(() => {
    setPage(1);
  }, [search, status, batch, ordering, createdAfter, createdBefore]);

  const { items, totalCount, isLoading, hasLoadedOnce, error } =
    useLabClearanceList(page, PAGE_SIZE, "all", reloadKey, {
      search,
      status,
      batch,
      createdAfter: createdAfter ? toStartOfDay(createdAfter) : "",
      createdBefore: createdBefore ? toEndOfDay(createdBefore) : "",
      ordering,
    });
  const { approve, reject, pendingId } = useLabClearanceReview();

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const kpis = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    for (const item of items) {
      const normalized = normalizeStatus(item.status);
      if (normalized === "pending") pending += 1;
      if (normalized === "approved") approved += 1;
      if (normalized === "rejected") rejected += 1;
    }

    return {
      total: totalCount,
      pending,
      approved,
      rejected,
    };
  }, [items, totalCount]);

  const reviewTarget = reviewTargetId
    ? (detailsById[reviewTargetId] ?? null)
    : null;
  const isReviewLoading = reviewTargetId
    ? Boolean(loadingDetailIds[reviewTargetId])
    : false;
  const reviewLoadError = reviewTargetId
    ? (detailErrors[reviewTargetId] ?? "")
    : "";

  const fetchClearanceCheck = async (itemId: string, profileId: string) => {
    if (clearanceChecks[itemId] !== undefined || loadingClearanceIds[itemId])
      return;
    setLoadingClearanceIds((prev) => ({ ...prev, [itemId]: true }));
    setClearanceCheckErrors((prev) => ({ ...prev, [itemId]: "" }));
    try {
      const result = await adminLabClearanceService.getLabClearance(profileId);
      setClearanceChecks((prev) => ({ ...prev, [itemId]: result }));
    } catch (err) {
      setClearanceCheckErrors((prev) => ({
        ...prev,
        [itemId]:
          err instanceof Error
            ? err.message
            : "Gagal memuat status tanggungan.",
      }));
    } finally {
      setLoadingClearanceIds((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const ensureDetailLoaded = async (
    id: string,
  ): Promise<LabClearanceDetail | null> => {
    if (detailsById[id]) return detailsById[id];
    if (loadingDetailIds[id]) return null;

    setLoadingDetailIds((prev) => ({ ...prev, [id]: true }));
    setDetailErrors((prev) => ({ ...prev, [id]: "" }));

    try {
      const detail = await labClearanceService.getDetail(id);
      if (!detail) {
        setDetailErrors((prev) => ({
          ...prev,
          [id]: "Gagal memuat detail permohonan.",
        }));
        return null;
      }

      setDetailsById((prev) => ({ ...prev, [id]: detail }));
      return detail;
    } catch (loadError) {
      setDetailErrors((prev) => ({
        ...prev,
        [id]:
          loadError instanceof Error
            ? loadError.message
            : "Terjadi kesalahan saat memuat dokumen.",
      }));
      return null;
    } finally {
      setLoadingDetailIds((prev) => ({ ...prev, [id]: false }));
    }
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
    if (item?.status === "Pending" && profileId)
      void fetchClearanceCheck(id, profileId);
  };

  const handleGenerateSurat = async (id: string) => {
    const detail = await ensureDetailLoaded(id);
    if (!detail) {
      toast.error("Gagal memuat detail permohonan untuk generate PDF.");
      return;
    }

    setGenerateSuratDetail(detail);
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

  return (
    <section className="w-full min-w-0 space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SampleTestingSummaryCard
          label="Total Permohonan"
          value={kpis.total}
          icon={<PackageSearch className="h-4 w-4" />}
          tone="slate"
        />
        <SampleTestingSummaryCard
          label="Menunggu"
          value={kpis.pending}
          icon={<CalendarClock className="h-4 w-4" />}
          tone="amber"
        />
        <SampleTestingSummaryCard
          label="Disetujui"
          value={kpis.approved}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="emerald"
        />
        <SampleTestingSummaryCard
          label="Ditolak"
          value={kpis.rejected}
          icon={<RotateCcw className="h-4 w-4" />}
          tone="rose"
        />
      </div>

      {error ? <InlineErrorAlert>{error}</InlineErrorAlert> : null}

      <div className="w-full max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1080px]">
          <thead className="border-b border-slate-800 bg-slate-900">
            <tr className="text-left text-sm">
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                Kode
              </th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                Pemohon
              </th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                Prodi
              </th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                Angkatan
              </th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                Status
              </th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                Dibuat
              </th>
              <th className="sticky right-0 z-20 bg-slate-900 px-3 py-3 text-center font-medium whitespace-nowrap text-slate-50 shadow-[-1px_0_0_0_rgba(51,65,85,1)]">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {isLoading || !hasLoadedOnce ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-5 text-center text-slate-500"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat data...
                  </div>
                </td>
              </tr>
            ) : items.length ? (
              items.map((item) => {
                const rowId = String(item.id);

                return (
                  <tr key={rowId} className="border-b last:border-b-0">
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap text-slate-800">
                      {item.code}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      <p className="font-medium text-slate-800">
                        {item.requested_by_detail?.full_name || "-"}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                      {item.requested_by_detail?.department || "-"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                      {item.requested_by_detail?.batch || "-"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(item.status)}`}
                      >
                        {getRequestStatusDisplayLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                      {formatDateTimeWib(item.created_at)}
                    </td>
                    <td className="sticky right-0 z-10 bg-white px-3 py-2.5 text-center shadow-[-1px_0_0_0_rgba(226,232,240,1)]">
                      <div className="flex items-center justify-center gap-2">
                        <TableActionIconButton
                          type="button"
                          label="Review"
                          icon={<ClipboardCheck className="h-3.5 w-3.5" />}
                          className="w-8 rounded-md border border-sky-200 bg-sky-50 p-0 text-sky-700 shadow-none hover:bg-sky-100"
                          onClick={() => handleOpenReview(rowId)}
                        />
                        {item.status === "Approved" ? (
                          <TableActionIconButton
                            type="button"
                            label="Generate surat"
                            icon={
                              loadingDetailIds[rowId] ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <ScrollText className="h-3.5 w-3.5" />
                              )
                            }
                            className="w-8 rounded-md border border-emerald-200 bg-emerald-50 p-0 text-emerald-700 shadow-none hover:bg-emerald-100"
                            onClick={() => void handleGenerateSurat(rowId)}
                            disabled={Boolean(loadingDetailIds[rowId])}
                          />
                        ) : null}
                        <TableActionIconButton
                          type="button"
                          label="Lihat detail"
                          icon={<Eye className="h-3.5 w-3.5" />}
                          className="w-8 rounded-md border border-slate-200 bg-slate-50 p-0 text-slate-700 shadow-none hover:bg-slate-100"
                          onClick={() => handleOpenReview(rowId)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-5 text-center text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
        clearanceCheck={
          reviewTargetId ? (clearanceChecks[reviewTargetId] ?? null) : null
        }
        isLoadingClearance={
          reviewTargetId ? Boolean(loadingClearanceIds[reviewTargetId]) : false
        }
        clearanceCheckError={
          reviewTargetId ? (clearanceCheckErrors[reviewTargetId] ?? "") : ""
        }
        onRejectNoteChange={setRejectNote}
        onApproveConfirmOpenChange={setApproveConfirmOpen}
        onRejectConfirmOpenChange={setRejectConfirmOpen}
        onApprove={handleApprove}
        onReject={handleReject}
        onPreview={setPreviewDocument}
        onGenerateSurat={setGenerateSuratDetail}
      />

      <DialogGenerateSurat
        detail={generateSuratDetail}
        onOpenChange={(open) => {
          if (!open) setGenerateSuratDetail(null);
        }}
      />
    </section>
  );
}

export function DialogReview({
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
  onGenerateSurat,
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
  onGenerateSurat: (detail: LabClearanceDetail) => void;
}) {
  const isSubmitting = Boolean(detail?.id && pendingId === detail.id);

  return (
    <>
      <LabClearanceApprovalDetailDialogShell
        open={open}
        onOpenChange={onOpenChange}
        title={`Review Surat Bebas Laboratorium`}
        description="Periksa dokumen yang diunggah sebelum menyetujui atau menolak permohonan."
        icon={<ClipboardCheck className="h-5 w-5" />}
        contentClassName="max-h-[85vh] w-[min(960px,calc(100%-2rem))] max-w-none gap-0 overflow-y-auto p-0 sm:max-w-none [--primary:#0048B4] [--primary-foreground:#FFFFFF] [--ring:#3B82F6]"
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
              <div className="space-y-6">
                <LabClearanceSectionCard
                  title="Dokumen Pengajuan"
                  subtitle="Periksa kelengkapan dokumen sebelum menyetujui atau menolak permohonan."
                  icon={<FileText className="h-5 w-5" />}
                >
                  {detail.documents.length ? (
                    <div className="space-y-2">
                        {detail.documents.map((document) => {
                          const canPreview = isPreviewableDocumentFile({
                            mimeType: document.mime_type,
                            originalName: document.original_name,
                            document_url: document.document_url,
                          });

                          return (
                            <div
                              key={document.id}
                              className="flex flex-col gap-3 rounded-lg border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-800">
                                  {DOCUMENT_TYPE_LABEL[
                                    document.document_type
                                  ] ?? document.document_type}
                                </p>
                                <p
                                  className="truncate text-sm text-slate-500"
                                  title={document.original_name}
                                >
                                  {document.original_name}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Diunggah pada{" "}
                                  {formatDateTimeWib(document.created_at)}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="rounded-md border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100"
                                  onClick={() => {
                                    if (canPreview) {
                                      onPreview(document);
                                      return;
                                    }

                                    downloadDocumentFile({
                                      originalName: document.original_name,
                                      document_url: document.document_url,
                                    });
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                  {canPreview ? "Lihat file" : "Unduh file"}
                                </Button>
                                <Button
                                  asChild
                                  variant="outline"
                                  className="rounded-md border-blue-200 bg-blue-50 text-sm font-medium text-blue-700 hover:bg-blue-100"
                                >
                                  <a
                                    href={document.document_url ?? "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                    Buka tab baru
                                  </a>
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Belum ada dokumen yang tersimpan pada pengajuan ini.
                    </p>
                  )}
                </LabClearanceSectionCard>

                  <LabClearanceSectionCard
                    title="Riwayat Penggunaan Ruang Lab"
                    subtitle="Riwayat penggunaan ruang yang dilampirkan sebagai referensi permohonan."
                    icon={<CalendarClock className="h-5 w-5" />}
                  >
                    {detail.booking_histories &&
                    detail.booking_histories.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="min-w-full table-auto text-sm">
                          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-3 py-2 font-semibold">
                                Ruang Lab
                              </th>
                              <th className="px-3 py-2 font-semibold">
                                Tanggal Mulai
                              </th>
                              <th className="px-3 py-2 font-semibold">
                                Tanggal Selesai
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.booking_histories.map((history) => (
                              <tr key={history.id} className="border-t">
                                <td className="px-3 py-2 text-slate-700">
                                  {history.lab_room_name || "-"}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                                  {history.start_date || "-"}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                                  {history.end_date || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                        Tidak ada riwayat penggunaan ruang lab yang dilampirkan.
                      </div>
                    )}
                  </LabClearanceSectionCard>
                  <LabClearanceSectionCard
                    title="Informasi Pemohon"
                    subtitle="Identitas mahasiswa yang mengajukan surat bebas laboratorium."
                    icon={<UserRound className="h-5 w-5" />}
                  >
                    <LabClearanceMetaItem
                      label="Nama Pemohon"
                      value={detail.requested_by_detail?.full_name || "-"}
                    />
                    <LabClearanceMetaItem
                      label="NIM"
                      value={detail.requested_by_detail?.id_number || "-"}
                    />
                    <LabClearanceMetaItem
                      label="Email"
                      valueNode={
                        detail.requested_by_detail?.email ? (
                          <a
                            href={`mailto:${detail.requested_by_detail.email}`}
                            className="inline-flex items-center gap-1.5 text-sky-700 hover:text-sky-800"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            {detail.requested_by_detail.email}
                          </a>
                        ) : (
                          <span className="italic text-slate-400">-</span>
                        )
                      }
                    />
                    <LabClearanceMetaItem
                      label="Prodi"
                      value={detail.requested_by_detail?.department || "-"}
                    />
                    <LabClearanceMetaItem
                      label="Angkatan"
                      value={detail.requested_by_detail?.batch || "-"}
                    />
                  </LabClearanceSectionCard>

                  <LabClearanceSectionCard
                    title="Informasi Review"
                    subtitle="Riwayat pemeriksaan admin terhadap permohonan ini."
                    icon={<ClipboardCheck className="h-5 w-5" />}
                  >
                    <LabClearanceMetaItem
                      label="Kode Pengajuan"
                      value={detail.code}
                    />
                    <LabClearanceMetaItem
                      label="Status"
                      valueNode={
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(detail.status)}`}
                        >
                          {getRequestStatusDisplayLabel(detail.status)}
                        </span>
                      }
                    />
                    <LabClearanceMetaItem
                      label="Diajukan Pada"
                      value={formatDateTimeWib(detail.created_at)}
                    />
                    <LabClearanceMetaItem
                      label="Direview Oleh"
                      value={detail.reviewed_by_detail?.full_name || "-"}
                    />
                    <LabClearanceMetaItem
                      label="Direview Pada"
                      value={
                        detail.reviewed_at
                          ? formatDateTimeWib(detail.reviewed_at)
                          : "-"
                      }
                    />
                    <LabClearanceMetaItem
                      label="Catatan Review"
                      value={detail.note || "-"}
                    />
                  </LabClearanceSectionCard>

                  {detail.status === "Pending" ? (
                    <LabClearanceSectionCard
                      title="Status Bebas Tanggungan"
                      subtitle="Validasi tanggungan aktif sebelum permohonan disetujui."
                      icon={<PackageSearch className="h-5 w-5" />}
                    >
                      {isLoadingClearance ? (
                        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Memeriksa status tanggungan...
                        </div>
                      ) : clearanceCheckError ? (
                        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                          {clearanceCheckError}
                        </div>
                      ) : clearanceCheck ? (
                        (() => {
                          const borrowServices =
                            clearanceCheck.activeServices.filter(
                              (service) =>
                                service.type === "borrow" &&
                                ACTIVE_BORROW_STATUSES.has(service.status),
                            );

                          return borrowServices.length === 0 ? (
                            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                              <p className="text-sm font-medium text-emerald-700">
                                Tidak ada tanggungan peminjaman aktif, pemohon
                                dinyatakan bebas laboratorium.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
                                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                                <p className="text-sm font-medium text-rose-700">
                                  Ada {borrowServices.length} tanggungan
                                  peminjaman aktif.
                                </p>
                              </div>
                              <div className="overflow-x-auto rounded-lg border border-rose-100">
                                <table className="min-w-full table-auto text-sm">
                                  <thead className="bg-rose-50 text-left text-xs uppercase tracking-wide text-rose-500">
                                    <tr>
                                      <th className="px-3 py-2 font-semibold">
                                        Kode
                                      </th>
                                      <th className="px-3 py-2 font-semibold">
                                        Layanan
                                      </th>
                                      <th className="px-3 py-2 font-semibold">
                                        Status
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {borrowServices.map((service) => (
                                      <tr
                                        key={service.id}
                                        className="border-t border-rose-100"
                                      >
                                        <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-800">
                                          {service.code}
                                        </td>
                                        <td className="px-3 py-2 text-slate-700">
                                          {SERVICE_TYPE_LABEL[service.type] ??
                                            service.type}
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
                          );
                        })()
                      ) : null}
                    </LabClearanceSectionCard>
                  ) : null}
              </div>
            </>
          ) : null}
        </div>

        {detail?.status === "Pending" || detail?.status === "Approved" ? (
          <div className="border-t border-slate-200 px-6 py-4">
            <DialogFooter className="gap-2 sm:justify-end">
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
              {detail?.status === "Approved" ? (
                <Button
                  type="button"
                  className="rounded-md bg-emerald-600 text-sm text-white hover:bg-emerald-700"
                  onClick={() => onGenerateSurat(detail)}
                >
                  <ScrollText className="mr-2 h-4 w-4" />
                  Generate Surat Bebas Lab
                </Button>
              ) : null}
            </DialogFooter>
          </div>
        ) : null}
      </LabClearanceApprovalDetailDialogShell>

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
              Catatan Penolakan{" "}
              <span className="text-slate-400">(opsional)</span>
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
              <AlertDialogCancel disabled={isSubmitting}>
                Batal
              </AlertDialogCancel>
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
  const [pdfFilename, setPdfFilename] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const recipientEmail = detail?.requested_by_detail?.email?.trim() || "-";

  useEffect(() => {
    if (!detail) {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlob(null);
      setPdfBlobUrl(null);
      setPdfFilename("");
      setSendConfirmOpen(false);
      return;
    }
    setIsPdfLoading(true);
    void buildSuratBebasPdf(detail).then(({ blob, blobUrl, filename }) => {
      setPdfBlob(blob);
      setPdfBlobUrl(blobUrl);
      setPdfFilename(filename);
      setIsPdfLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id]);

  function handleDownload() {
    if (!pdfBlobUrl || !pdfFilename) return;
    const a = document.createElement("a");
    a.href = pdfBlobUrl;
    a.download = pdfFilename;
    a.click();
  }

  async function handleSendEmail() {
    if (!detail || !pdfBlob) return;
    setIsSending(true);
    const result = await labClearanceService.sendLetter(detail.id, pdfBlob);
    setIsSending(false);
    if (result.ok) {
      toast.success("Surat berhasil dikirim ke email pemohon.");
    } else {
      toast.error("Gagal mengirim surat. Silakan coba lagi.");
    }
  }

  return (
    <Dialog
      open={Boolean(detail)}
      onOpenChange={(open: boolean) => {
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
            <Button
              type="button"
              variant="outline"
              disabled={!pdfBlobUrl || isPdfLoading}
              className="rounded-md border-blue-200 text-sm text-blue-700 hover:bg-blue-50"
              onClick={handleDownload}
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button
              type="button"
              disabled={!pdfBlob || isPdfLoading || isSending}
              className="rounded-md bg-emerald-600 text-sm text-white hover:bg-emerald-700"
              onClick={() => setSendConfirmOpen(true)}
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mengirim...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Kirim ke Email
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>

      <AlertDialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kirim surat ke email pemohon?</AlertDialogTitle>
            <AlertDialogDescription>
              Surat akan dikirim ke alamat email{" "}
              <span className="font-medium text-slate-900">
                {recipientEmail}
              </span>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={!pdfBlob || isPdfLoading || isSending}
              onClick={(event) => {
                event.preventDefault();
                void handleSendEmail().then(() => {
                  setSendConfirmOpen(false);
                });
              }}
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mengirim...
                </>
              ) : (
                "Kirim"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
