"use client";

import { useState, useRef } from "react";
import { FileText, Loader2, Upload, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import {
  SubmissionConfirmDialog,
  SubmissionSummaryItem,
} from "@/components/dialogs";
import { DocumentPreviewDialog } from "@/components/shared";
import { Button } from "@/components/ui";
import {
  type SampleTestingDocument,
  type SampleTestingDocumentType,
  type SampleTestingRow,
} from "@/hooks/sample-testing";
import { useUploadSampleTestingDocument } from "@/hooks/sample-testing";
import { formatDateTimeWib } from "@/lib/date";

import { SampleTestingSectionCard } from "./content/SampleTestingDetailContent";

type DocumentDefinition = {
  type: SampleTestingDocumentType;
  label: string;
  owner: "approver" | "requester";
  containerClassName?: string;
};

const DOCUMENT_DEFINITIONS: DocumentDefinition[] = [
  {
    type: "testing_agreement",
    label: "Surat perjanjian pengujian",
    owner: "approver",
  },
  {
    type: "signed_testing_agreement",
    label: "Surat perjanjian pengujian yang sudah ditandatangani",
    owner: "requester",
  },
  {
    type: "invoice",
    label: "Invoice",
    owner: "approver",
  },
  {
    type: "payment_proof",
    label: "Bukti bayar",
    owner: "requester",
  },
  {
    type: "receipt",
    label: "Kuitansi",
    owner: "approver",
  },
  {
    type: "test_result_letter",
    label: "Surat hasil uji",
    owner: "approver",
    containerClassName: "border-sky-300 bg-sky-50/90",
  },
];
const DOCUMENT_DEFINITIONS_DISPLAY = [...DOCUMENT_DEFINITIONS].reverse();
const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024;

function isPreviewableDocument(document: SampleTestingDocument) {
  const mimeType = String(document.mimeType || "").toLowerCase();
  const fileName = String(document.originalName || "").toLowerCase();

  return (
    mimeType.startsWith("image/") ||
    mimeType === "application/pdf" ||
    fileName.endsWith(".pdf") ||
    fileName.endsWith(".png") ||
    fileName.endsWith(".jpg") ||
    fileName.endsWith(".jpeg") ||
    fileName.endsWith(".webp")
  );
}

function getDocumentByType(
  documents: SampleTestingDocument[],
  type: SampleTestingDocumentType,
) {
  return documents.find((item) => item.documentType === type) ?? null;
}

function canShowSection(status: string) {
  const normalized = status.trim().toLowerCase();
  return [
    "approved",
    "diproses",
    "menunggu pembayaran",
    "completed",
  ].includes(normalized);
}

export default function SampleTestingDocumentsSection({
  item,
  viewerRole,
  onUploaded,
  embedded = false,
  allowActions = true,
}: {
  item: SampleTestingRow;
  viewerRole: "approver" | "requester";
  onUploaded?: () => void;
  embedded?: boolean;
  allowActions?: boolean;
}) {
  const { uploadDocument, pendingDocumentType } = useUploadSampleTestingDocument();
  const inputRefs = useRef<
    Partial<Record<SampleTestingDocumentType, HTMLInputElement | null>>
  >({});
  const [uploadDraft, setUploadDraft] = useState<{
    documentType: SampleTestingDocumentType;
    label: string;
    file: File;
  } | null>(null);
  const [previewDocument, setPreviewDocument] =
    useState<SampleTestingDocument | null>(null);

  if (!canShowSection(item.status)) {
    return null;
  }

  const handleUpload = async () => {
    if (!uploadDraft) return;

    const result = await uploadDocument(
      item.id,
      uploadDraft.documentType,
      uploadDraft.file,
    );
    if (!result.ok) {
      toast.error(result.message);
      if (inputRefs.current[uploadDraft.documentType]) {
        inputRefs.current[uploadDraft.documentType]!.value = "";
      }
      return;
    }

    toast.success("Dokumen berhasil diunggah.");
    if (inputRefs.current[uploadDraft.documentType]) {
      inputRefs.current[uploadDraft.documentType]!.value = "";
    }
    setUploadDraft(null);
    onUploaded?.();
  };

  const content = (
    <>
      <div className="space-y-3">
        {DOCUMENT_DEFINITIONS_DISPLAY.map((definition) => {
          const document = getDocumentByType(item.documents, definition.type);
          const isOwner = viewerRole === definition.owner;
          const canUpload = allowActions && isOwner;
          const canReplace = true;
          const canPreview = document ? isPreviewableDocument(document) : false;

          return (
            <div
              key={definition.type}
              className={`rounded-md border px-4 py-4 ${definition.containerClassName ?? "border-slate-200 bg-slate-50/80"}`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <p className="text-sm font-medium text-slate-900">
                    {definition.label}
                  </p>
                  {document ? (
                    <p className="text-xs text-emerald-700">
                      <span>
                        Diunggah oleh {document.uploadedByName} pada{" "}
                        {formatDateTimeWib(document.createdAt)}
                      </span>
                      {allowActions && isOwner && canReplace ? (
                        <>
                          <span className="mx-2 text-slate-300" aria-hidden="true">
                            |
                          </span>
                          <button
                            type="button"
                            className="inline text-sky-700 underline-offset-2 hover:underline"
                            disabled={
                              pendingDocumentType === definition.type || !canUpload
                            }
                            onClick={() =>
                              inputRefs.current[definition.type]?.click()
                            }
                          >
                            Ganti Dokumen
                          </button>
                        </>
                      ) : null}
                    </p>
                  ) : (
                    <p className="text-xs italic text-slate-400">
                      Dokumen belum diunggah.
                    </p>
                  )}
                </div>

                <div className="w-full max-w-sm space-y-2">
                  {document ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto w-full whitespace-normal py-3"
                      onClick={() => setPreviewDocument(document)}
                    >
                      <span className="flex min-w-0 items-start gap-3 text-left">
                        <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                            {canPreview ? "Lihat Dokumen" : "Lihat Detail Dokumen"}
                          </span>
                          {/* <span
                            className="line-clamp-2 block text-sm font-medium text-slate-900"
                            title={document.originalName}
                          >
                            {document.originalName}
                          </span> */}
                        </span>
                      </span>
                    </Button>
                  ) : null}

                  {allowActions && isOwner ? (
                    <>
                      <input
                        ref={(node) => {
                          inputRefs.current[definition.type] = node;
                        }}
                        type="file"
                        accept=".pdf,.doc,.docx,image/*"
                        className="hidden"
                        disabled={
                          pendingDocumentType === definition.type || !canUpload
                        }
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          if (!file) return;
                          if (file.size > MAX_DOCUMENT_SIZE) {
                            toast.error("Ukuran dokumen maksimal 5 MB.");
                            event.target.value = "";
                            return;
                          }
                          setUploadDraft({
                            documentType: definition.type,
                            label: definition.label,
                            file,
                          });
                        }}
                      />
                      {!document ? (
                        <Button
                          type="button"
                          className="w-full border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                          disabled={
                            pendingDocumentType === definition.type || !canUpload
                          }
                          onClick={() => inputRefs.current[definition.type]?.click()}
                        >
                          {pendingDocumentType === definition.type ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          Upload Dokumen
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <SubmissionConfirmDialog
        open={Boolean(uploadDraft)}
        onOpenChange={(open) => {
          if (!open && uploadDraft) {
            if (inputRefs.current[uploadDraft.documentType]) {
              inputRefs.current[uploadDraft.documentType]!.value = "";
            }
            setUploadDraft(null);
          }
        }}
        title="Konfirmasi Upload Dokumen"
        description="Periksa kembali dokumen yang dipilih sebelum diunggah."
        isSubmitting={Boolean(
          uploadDraft && pendingDocumentType === uploadDraft.documentType,
        )}
        onConfirm={() => {
          void handleUpload();
        }}
      >
        <SubmissionSummaryItem
          label="Jenis Dokumen"
          value={uploadDraft?.label ?? "-"}
        />
        <SubmissionSummaryItem
          label="Nama File"
          value={uploadDraft?.file.name ?? "-"}
        />
        <SubmissionSummaryItem
          label="Ukuran File"
          value={
            uploadDraft
              ? `${(uploadDraft.file.size / 1024 / 1024).toFixed(2)} MB`
              : "-"
          }
        />
      </SubmissionConfirmDialog>

      <DocumentPreviewDialog
        open={Boolean(previewDocument)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewDocument(null);
          }
        }}
        document={previewDocument}
      />
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <SampleTestingSectionCard
      title="Dokumen Pengujian"
      subtitle="Tahap dokumen lanjutan setelah pengajuan disetujui sampai proses pengujian selesai."
      icon={<FileText className="h-5 w-5" />}
    >
      {content}
    </SampleTestingSectionCard>
  );
}
