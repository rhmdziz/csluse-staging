"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  Eye,
  FileText,
  Info,
  Loader2,
  Pencil,
  Plus,
  PlusCircle,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { DeleteRequestConfirmDialog } from "@/components/dialogs";
import {
  DataPagination,
  DocumentPreviewDialog,
  InlineErrorAlert,
  TableActionIconButton,
} from "@/components/shared";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";

import { formatDateTimeWib } from "@/lib/date";
import {
  getRequestStatusDisplayLabel,
  getStatusBadgeClass,
} from "@/lib/request";
import {
  useDeleteLabClearanceDocument,
  useLabClearanceList,
  useSubmitLabClearance,
  useUpdateLabClearanceDocuments,
} from "@/hooks/lab-clearance";
import {
  labClearanceService,
  type LabClearanceBookingHistory,
  type LabClearanceDetail,
  type LabClearanceDocument,
  type LabClearanceDocumentType,
  type LabClearanceListItem,
} from "@/services/lab-clearance";
import { roomsService, type RoomOption } from "@/services/shared/resources";

const PAGE_SIZE = 10;

const TEMPLATES: {
  type: LabClearanceDocumentType;
  label: string;
  filename: string;
}[] = [
  {
    type: "form_alat_kecil",
    label: "F-027A Peminjaman dan Pengembalian Alat Kecil",
    filename: "F-027A Peminjaman dan Pengembalian Alat Kecil.docx",
  },
  {
    type: "form_alat_besar",
    label: "F-027B Pemakaian Alat Besar",
    filename: "F-027B Pemakaian Alat Besar-rev1.docx",
  },
  {
    type: "form_permintaan_bahan",
    label: "F-028 Permintaan Bahan",
    filename: "F-028 Permintaan Bahan.docx",
  },
];

const DOCUMENT_TYPE_LABEL: Record<LabClearanceDocumentType, string> = {
  form_alat_kecil: "F-027A Alat Kecil",
  form_alat_besar: "F-027B Alat Besar",
  form_permintaan_bahan: "F-028 Bahan",
};

function getLabClearanceStatusLabel(status?: string | null) {
  return getRequestStatusDisplayLabel(status);
}

function extractLabClearanceDetailPayload(
  data: unknown,
): LabClearanceDetail | null {
  if (!data || typeof data !== "object") return null;

  const payload = (data as { surat_bebas_lab?: LabClearanceDetail })
    .surat_bebas_lab;
  return payload ?? null;
}

function DetailInfoItem({
  label,
  value,
  statusClassName,
}: {
  label: string;
  value: string;
  statusClassName?: string;
}) {
  const displayValue = value?.trim() ? value : "-";

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-700">{label}</p>
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
        {statusClassName ? (
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClassName}`}
          >
            {displayValue}
          </span>
        ) : (
          displayValue
        )}
      </div>
    </div>
  );
}

function FileUploadField({
  label,
  file,
  onSelect,
  onClear,
}: {
  label: string;
  file: File | null;
  onSelect: (file: File) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-700">{label}</label>
      <div
        role="button"
        tabIndex={0}
        className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 transition hover:border-blue-400 hover:bg-blue-50"
        onClick={() => ref.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") ref.current?.click();
        }}
      >
        <FileText className="h-5 w-5 shrink-0 text-slate-400" />
        {file ? (
          <span className="flex-1 truncate text-sm font-medium text-slate-700">
            {file.name}
          </span>
        ) : (
          <span className="flex-1 text-sm text-slate-400">
            Klik untuk pilih file (.docx / .pdf)
          </span>
        )}
        {file ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="ml-auto shrink-0 rounded p-0.5 text-slate-400 hover:text-rose-500"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <input
        ref={ref}
        type="file"
        accept=".docx,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSelect(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function LabClearancePageContent() {
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [files, setFiles] = useState<
    Partial<Record<LabClearanceDocumentType, File>>
  >({});
  const [bookingHistories, setBookingHistories] = useState<
    Omit<LabClearanceBookingHistory, "id">[]
  >([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [roomOptions, setRoomOptions] = useState<RoomOption[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingEntry, setEditingEntry] = useState<Omit<LabClearanceBookingHistory, "id"> | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newEntry, setNewEntry] = useState<Omit<LabClearanceBookingHistory, "id">>({
    lab_room_name: "",
    start_date: "",
    end_date: "",
  });
  const [detailTarget, setDetailTarget] = useState<LabClearanceListItem | null>(
    null,
  );
  const [detailData, setDetailData] = useState<LabClearanceDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailReloadKey, setDetailReloadKey] = useState(0);
  const [previewDocument, setPreviewDocument] =
    useState<LabClearanceDocument | null>(null);
  const [deleteDraft, setDeleteDraft] = useState<LabClearanceDocument | null>(
    null,
  );
  const inputRefs = useRef<
    Partial<Record<LabClearanceDocumentType, HTMLInputElement | null>>
  >({});

  const { items, totalCount, isLoading, hasLoadedOnce, error } =
    useLabClearanceList(page, PAGE_SIZE, "my", reloadKey);
  const { submit, isSubmitting, errorMessage, setErrorMessage } =
    useSubmitLabClearance();
  const { updateDocuments, pendingDocumentType } =
    useUpdateLabClearanceDocuments();
  const { deleteDocument, pendingDocumentType: pendingDeleteDocumentType } =
    useDeleteLabClearanceDocument();

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const fileCount = Object.values(files).filter(Boolean).length;

  useEffect(() => {
    if (!detailTarget) {
      setDetailData(null);
      setDetailError(null);
      setIsDetailLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsDetailLoading(true);
    setDetailError(null);

    labClearanceService
      .getDetail(detailTarget.id, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!result) {
          setDetailData(null);
          setDetailError("Gagal memuat detail permohonan.");
          return;
        }
        setDetailData(result);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof Error && error.name === "AbortError") return;
        setDetailData(null);
        setDetailError("Terjadi kesalahan saat memuat detail permohonan.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsDetailLoading(false);
        }
      });

    return () => controller.abort();
  }, [detailTarget, detailReloadKey]);

  const handleOpenDialog = () => {
    setFiles({});
    setErrorMessage("");
    setBookingHistories([]);
    setEditingIndex(null);
    setEditingEntry(null);
    setIsAddingNew(false);
    setNewEntry({ lab_room_name: "", start_date: "", end_date: "" });
    setIsDialogOpen(true);
    setIsSuggestionsLoading(true);
    void roomsService.getOptions().then(setRoomOptions).catch(() => {});
    labClearanceService
      .getBookingSuggestions()
      .then((suggestions) => {
        setBookingHistories(
          suggestions.map(({ lab_room_name, start_date, end_date }) => ({
            lab_room_name,
            start_date,
            end_date,
          })),
        );
      })
      .catch(() => {/* pre-fill silently fails, user can add manually */})
      .finally(() => setIsSuggestionsLoading(false));
  };

  const handleSubmit = async () => {
    if (fileCount === 0) {
      setErrorMessage("Minimal satu formulir harus dilampirkan.");
      return;
    }
    const result = await submit(files, bookingHistories);
    if (result.ok) {
      toast.success("Permohonan berhasil dikirim.");
      setIsDialogOpen(false);
      setReloadKey((k) => k + 1);
    }
  };

  const canManagePendingDocuments = detailData?.status === "Pending";

  const handleReplaceDocument = async (
    documentType: LabClearanceDocumentType,
    file: File,
  ) => {
    if (!detailTarget) return;

    const result = await updateDocuments(detailTarget.id, documentType, file);
    if (!result.ok) {
      toast.error(result.message);
      if (inputRefs.current[documentType]) {
        inputRefs.current[documentType]!.value = "";
      }
      return;
    }

    toast.success("Dokumen berhasil diperbarui.");
    if (inputRefs.current[documentType]) {
      inputRefs.current[documentType]!.value = "";
    }
    const updatedDetail = extractLabClearanceDetailPayload(result.data);
    if (updatedDetail) {
      setDetailData(updatedDetail);
    }
    setDetailReloadKey((current) => current + 1);
    setReloadKey((current) => current + 1);
  };

  const handleDeleteDocument = async () => {
    if (!detailTarget || !deleteDraft) return;

    const result = await deleteDocument(
      detailTarget.id,
      deleteDraft.document_type,
    );
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Dokumen berhasil dihapus.");
    const updatedDetail = extractLabClearanceDetailPayload(result.data);
    setDeleteDraft(null);
    setPreviewDocument((current) =>
      current?.document_type === deleteDraft.document_type ? null : current,
    );
    if (updatedDetail) {
      setDetailData(updatedDetail);
    }
    setDetailReloadKey((current) => current + 1);
    setReloadKey((current) => current + 1);
  };

  return (
    <section className="space-y-4">
      {/* Info & template card */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex gap-3 flex-1">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-blue-800">
                Cara Pengajuan Surat Bebas Laboratorium
              </p>
              <ol className="list-inside list-decimal space-y-0.5 text-sm text-blue-700">
                <li>Unduh template formulir yang sesuai di bawah ini.</li>
                <li>Isi dan tanda tangani formulir secara lengkap.</li>
              </ol>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:shrink-0">
            {TEMPLATES.map((t) => (
              <a
                key={t.type}
                href={`/documents/docs/${encodeURIComponent(t.filename)}`}
                download
                className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 shadow-sm transition hover:bg-blue-50 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                {t.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Daftar permohonan surat bebas laboratorium Anda.
        </p>
        <Button
          type="button"
          onClick={handleOpenDialog}
          className="gap-1.5 bg-[#0052C7] text-sm text-white hover:bg-[#0048B4]"
        >
          <Plus className="h-4 w-4" />
          Ajukan Permohonan
        </Button>
      </div>

      {error ? <InlineErrorAlert>{error}</InlineErrorAlert> : null}

      {/* Table */}
      <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-160">
          <thead className="border-b border-slate-800 bg-slate-900">
            <tr className="text-left text-sm">
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                No
              </th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                Kode
              </th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                Dokumen
              </th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                Status
              </th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                Tanggal Pengajuan
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
                  colSpan={6}
                  className="px-3 py-5 text-center text-slate-500"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat data...
                  </div>
                </td>
              </tr>
            ) : items.length ? (
              items.map((item, index) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2.5 text-slate-500">
                    {(page - 1) * PAGE_SIZE + index + 1}
                  </td>
                  <td className="px-3 py-2.5 font-medium whitespace-nowrap text-slate-800">
                    {item.code}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-slate-700">
                    {item.document_count} formulir
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(item.status)}`}
                    >
                      {getLabClearanceStatusLabel(item.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                    {formatDateTimeWib(item.created_at)}
                  </td>
                  <td className="sticky right-0 z-10 bg-white px-3 py-2.5 text-center shadow-[-1px_0_0_0_rgba(226,232,240,1)]">
                    <TableActionIconButton
                      type="button"
                      label="Dokumen"
                      icon={<FileText className="h-3.5 w-3.5" />}
                      className="w-8 rounded-md border border-blue-200 bg-blue-50 p-0 text-blue-700 shadow-none hover:bg-blue-100"
                      onClick={() => setDetailTarget(item)}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-5 text-center text-slate-500"
                >
                  Belum ada permohonan surat bebas laboratorium.
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

      <Dialog
        open={Boolean(detailTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailTarget(null);
            setPreviewDocument(null);
            setDeleteDraft(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto border-slate-200 p-0 shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:max-w-3xl">
          <DialogHeader className="border-b border-slate-200 px-6 py-5 text-left">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-sm font-semibold text-slate-900">
                  Dokumen Surat Bebas Laboratorium
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-slate-500">
                  {detailTarget?.code ??
                    "Memuat dokumen surat bebas laboratorium."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            {isDetailLoading ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-10 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat detail pengajuan...
              </div>
            ) : detailError ? (
              <InlineErrorAlert>{detailError}</InlineErrorAlert>
            ) : detailData ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Informasi Pengajuan
                    </p>
                    <div className="grid gap-3">
                      <DetailInfoItem
                        label="Kode Pengajuan"
                        value={detailData.code}
                      />
                      <DetailInfoItem
                        label="Status"
                        value={getLabClearanceStatusLabel(detailData.status)}
                        statusClassName={getStatusBadgeClass(detailData.status)}
                      />
                      <DetailInfoItem
                        label="Diajukan Pada"
                        value={formatDateTimeWib(detailData.created_at)}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Hasil Review
                    </p>
                    <div className="grid gap-3">
                      <DetailInfoItem
                        label="Ringkasan Review"
                        value={
                          detailData.status === "Approved"
                            ? "Permohonan sudah disetujui."
                            : detailData.status === "Rejected"
                              ? "Permohonan ditolak."
                              : "Permohonan masih menunggu review admin."
                        }
                      />
                      <DetailInfoItem
                        label="Direview Oleh"
                        value={detailData.reviewed_by_detail?.full_name || "-"}
                      />
                      <DetailInfoItem
                        label="Direview Pada"
                        value={
                          detailData.reviewed_at
                            ? formatDateTimeWib(detailData.reviewed_at)
                            : "-"
                        }
                      />
                      {detailData.note?.trim() ? (
                        <DetailInfoItem
                          label="Catatan"
                          value={detailData.note}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Dokumen Pengajuan
                  </p>
                  {detailData.documents.length ? (
                    <div className="space-y-2">
                      {detailData.documents.map((document) => (
                        <div
                          key={document.id}
                          className="flex flex-col gap-3 rounded-lg border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800">
                              {DOCUMENT_TYPE_LABEL[document.document_type] ??
                                document.document_type}
                            </p>
                            <p className="truncate text-sm text-slate-500">
                              {document.original_name}
                            </p>
                            {canManagePendingDocuments ? (
                              <p className="mt-1 text-xs text-slate-500">
                                <span>
                                  Diunggah pada{" "}
                                  {formatDateTimeWib(document.created_at)}
                                </span>
                                <span
                                  className="mx-2 text-slate-300"
                                  aria-hidden="true"
                                >
                                  |
                                </span>
                                <button
                                  type="button"
                                  className="inline text-sky-700 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
                                  disabled={
                                    pendingDocumentType ===
                                    document.document_type
                                  }
                                  onClick={() =>
                                    inputRefs.current[
                                      document.document_type
                                    ]?.click()
                                  }
                                >
                                  {pendingDocumentType ===
                                  document.document_type
                                    ? "Mengganti..."
                                    : "Ganti Dokumen"}
                                </button>
                                <span
                                  className="mx-2 text-slate-300"
                                  aria-hidden="true"
                                >
                                  |
                                </span>
                                <button
                                  type="button"
                                  className="inline text-rose-700 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
                                  disabled={
                                    pendingDeleteDocumentType ===
                                    document.document_type
                                  }
                                  onClick={() => setDeleteDraft(document)}
                                >
                                  {pendingDeleteDocumentType ===
                                  document.document_type
                                    ? "Menghapus..."
                                    : "Hapus Dokumen"}
                                </button>
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {document.document_url ? (
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-md border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100"
                                onClick={() => setPreviewDocument(document)}
                              >
                                <Eye className="h-4 w-4" />
                                Lihat file
                              </Button>
                            ) : (
                              <span className="text-sm text-slate-400">
                                File tidak tersedia
                              </span>
                            )}

                            {canManagePendingDocuments ? (
                              <>
                                <input
                                  ref={(element) => {
                                    inputRefs.current[document.document_type] =
                                      element;
                                  }}
                                  type="file"
                                  accept=".doc,.docx,.pdf,.jpg,.jpeg,.png,.webp"
                                  className="hidden"
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (!file) return;
                                    void handleReplaceDocument(
                                      document.document_type,
                                      file,
                                    );
                                  }}
                                />
                              </>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Belum ada dokumen yang tersimpan.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                Data permohonan tidak ditemukan.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-slate-200 p-0 shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:max-w-3xl">
          <DialogHeader className="border-b border-slate-200 px-6 py-5 text-left">
            <div className="flex w-full items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700">
                <Upload className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-semibold text-slate-900">
                  Ajukan Permohonan Surat Bebas Laboratorium
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-slate-500">
                  Unggah formulir surat bebas laboratorium yang sudah diisi dan
                  ditandatangani untuk diajukan ke admin.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 px-6 py-5">
            {/* Riwayat Penggunaan Ruang Lab */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Riwayat Penggunaan Ruang Lab
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 border-slate-300 text-xs"
                  onClick={() => setIsAddingNew(true)}
                  disabled={isAddingNew}
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Tambah
                </Button>
              </div>
              {isSuggestionsLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Memuat riwayat booking...
                </div>
              ) : null}
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="min-w-full table-auto text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Ruang Lab</th>
                      <th className="px-3 py-2 font-semibold">Mulai</th>
                      <th className="px-3 py-2 font-semibold">Selesai</th>
                      <th className="px-3 py-2 text-center font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookingHistories.map((entry, index) =>
                      editingIndex === index ? (
                        <tr key={index} className="border-t bg-blue-50/30">
                          <td className="p-0">
                            <select
                              className="w-full bg-transparent px-3 py-2 text-sm text-slate-700 outline-none"
                              value={editingEntry?.lab_room_name ?? ""}
                              onChange={(e) =>
                                setEditingEntry((prev) =>
                                  prev ? { ...prev, lab_room_name: e.target.value } : prev,
                                )
                              }
                            >
                              <option value="">— Pilih ruang —</option>
                              {roomOptions.map((r) => (
                                <option key={r.id} value={r.name}>{r.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-0">
                            <input
                              type="date"
                              className="bg-transparent px-3 py-2 text-sm text-slate-700 outline-none"
                              value={editingEntry?.start_date ?? ""}
                              onChange={(e) =>
                                setEditingEntry((prev) =>
                                  prev ? { ...prev, start_date: e.target.value } : prev,
                                )
                              }
                            />
                          </td>
                          <td className="p-0">
                            <input
                              type="date"
                              className="bg-transparent px-3 py-2 text-sm text-slate-700 outline-none"
                              value={editingEntry?.end_date ?? ""}
                              onChange={(e) =>
                                setEditingEntry((prev) =>
                                  prev ? { ...prev, end_date: e.target.value } : prev,
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex justify-center gap-1">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-6 w-6 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => {
                                  if (!editingEntry) return;
                                  setBookingHistories((prev) =>
                                    prev.map((e, i) => (i === index ? editingEntry : e)),
                                  );
                                  setEditingIndex(null);
                                  setEditingEntry(null);
                                }}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-6 w-6 border-slate-200 text-slate-500"
                                onClick={() => {
                                  setEditingIndex(null);
                                  setEditingEntry(null);
                                }}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={index} className="border-t last:border-b-0">
                          <td className="px-3 py-2 text-sm text-slate-700">{entry.lab_room_name || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-sm text-slate-700">
                            {entry.start_date || "-"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-sm text-slate-700">
                            {entry.end_date || "-"}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex justify-center gap-1">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-6 w-6 border-slate-200 text-slate-600 hover:bg-slate-50"
                                onClick={() => {
                                  setEditingIndex(index);
                                  setEditingEntry({ ...entry });
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-6 w-6 border-rose-200 text-rose-600 hover:bg-rose-50"
                                onClick={() =>
                                  setBookingHistories((prev) => prev.filter((_, i) => i !== index))
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                    {isAddingNew && (
                      <tr className="border-t bg-emerald-50/30">
                        <td className="p-0">
                          <select
                            className="w-full bg-transparent px-3 py-2 text-sm text-slate-700 outline-none"
                            value={newEntry.lab_room_name}
                            onChange={(e) =>
                              setNewEntry((p) => ({ ...p, lab_room_name: e.target.value }))
                            }
                          >
                            <option value="">— Pilih ruang —</option>
                            {roomOptions.map((r) => (
                              <option key={r.id} value={r.name}>{r.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-0">
                          <input
                            type="date"
                            className="bg-transparent px-3 py-2 text-sm text-slate-700 outline-none"
                            value={newEntry.start_date}
                            onChange={(e) =>
                              setNewEntry((p) => ({ ...p, start_date: e.target.value }))
                            }
                          />
                        </td>
                        <td className="p-0">
                          <input
                            type="date"
                            className="bg-transparent px-3 py-2 text-sm text-slate-700 outline-none"
                            value={newEntry.end_date}
                            onChange={(e) =>
                              setNewEntry((p) => ({ ...p, end_date: e.target.value }))
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-6 w-6 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => {
                                if (!newEntry.lab_room_name) return;
                                setBookingHistories((prev) => [...prev, { ...newEntry }]);
                                setIsAddingNew(false);
                                setNewEntry({
                                  lab_room_name: "",
                                  start_date: "",
                                  end_date: "",
                                });
                              }}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-6 w-6 border-slate-200 text-slate-500"
                              onClick={() => {
                                setIsAddingNew(false);
                                setNewEntry({
                                  lab_room_name: "",
                                  start_date: "",
                                  end_date: "",
                                });
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {bookingHistories.length === 0 && !isAddingNew && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-4 text-center text-xs text-slate-400"
                        >
                          Belum ada riwayat. Klik &ldquo;Tambah&rdquo; untuk menambahkan secara manual.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {TEMPLATES.map((t) => (
              <FileUploadField
                key={t.type}
                label={t.label}
                file={files[t.type] ?? null}
                onSelect={(f) => setFiles((prev) => ({ ...prev, [t.type]: f }))}
                onClear={() =>
                  setFiles((prev) => {
                    const next = { ...prev };
                    delete next[t.type];
                    return next;
                  })
                }
              />
            ))}

            {errorMessage ? (
              <div className="pt-1">
                <InlineErrorAlert>{errorMessage}</InlineErrorAlert>
              </div>
            ) : null}
          </div>

          <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              className="rounded-md border-slate-300 text-sm"
              onClick={() => setIsDialogOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={isSubmitting || fileCount === 0}
              onClick={() => void handleSubmit()}
              className="rounded-md bg-[#0052C7] text-sm text-white hover:bg-[#0048B4]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mengirim...
                </>
              ) : (
                `Kirim Permohonan${fileCount > 0 ? ` (${fileCount})` : ""}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentPreviewDialog
        open={Boolean(previewDocument)}
        onOpenChange={(open) => {
          if (!open) setPreviewDocument(null);
        }}
        document={
          previewDocument
            ? {
                id: previewDocument.id,
                documentType: previewDocument.document_type,
                documentLabel:
                  DOCUMENT_TYPE_LABEL[previewDocument.document_type] ??
                  previewDocument.document_type,
                originalName: previewDocument.original_name,
                mimeType: previewDocument.mime_type,
                size: previewDocument.size,
                url: previewDocument.document_url ?? "",
                uploadedById: "",
                uploadedByName: "-",
                createdAt: previewDocument.created_at,
                updatedAt: previewDocument.created_at,
              }
            : null
        }
      />

      <DeleteRequestConfirmDialog
        open={Boolean(deleteDraft)}
        onOpenChange={(open) => {
          if (!open) setDeleteDraft(null);
        }}
        isSubmitting={Boolean(
          deleteDraft &&
          pendingDeleteDocumentType === deleteDraft.document_type,
        )}
        onConfirm={() => void handleDeleteDocument()}
        title="Hapus Dokumen"
        description={`Dokumen ${
          deleteDraft
            ? (DOCUMENT_TYPE_LABEL[deleteDraft.document_type] ??
              deleteDraft.document_type)
            : ""
        } akan dihapus dari permohonan surat bebas laboratorium.`}
        confirmLabel="Ya, Hapus Dokumen"
      />
    </section>
  );
}
