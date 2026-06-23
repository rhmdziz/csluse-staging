"use client";

import { useRef, useState, type ChangeEvent } from "react";

import * as XLSX from "xlsx";

import { toast } from "sonner";

import { sampleTestingService, type LegacySampleTestingImportRow } from "@/services/sample-testing";

import { BulkImportDialogShell, InlineErrorAlert } from "@/components/shared";

import { Button } from "@/components/ui";

import { extractApiErrorMessage } from "@/lib/core";

type ResultRow = {
  index: number;
  status: "success" | "error";
  message: string;
};

type SkippedRow = {
  index: number;
  reason: string;
};

type SampleTestingHistoryLegacyImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
};

const HEADER_MAP: Record<string, keyof LegacySampleTestingImportRow> = {
  kode: "code",
  code: "code",
  name: "name",
  nama: "name",
  institution: "institution",
  institution_address: "institutionAddress",
  email: "email",
  phone_number: "phoneNumber",
  sample_name: "sampleName",
  sample_type: "sampleType",
  sample_brand: "sampleBrand",
  sample_packaging: "samplePackaging",
  sample_weight: "sampleWeight",
  sample_quantity: "sampleQuantity",
  sample_testing_serving: "sampleTestingServing",
  sample_testing_method: "sampleTestingMethod",
  sample_testing_type: "sampleTestingType",
  status: "status",
  requested_by: "requestedById",
  requested_by_email: "requestedByEmail",
  approved_by: "approvedById",
  approved_by_email: "approvedByEmail",
  created_at: "createdAt",
  approved_at: "approvedAt",
  rejected_at: "rejectedAt",
  completed_at: "completedAt",
};

function normalizeHeader(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/-/g, "_");
}

function toCellString(value: unknown) {
  return String(value ?? "").trim();
}

function buildTemplateWorkbook() {
  const headers = [
    "name",
    "email",
    "phone_number",
    "sample_name",
    "sample_type",
    "sample_brand",
    "sample_packaging",
    "sample_weight",
    "sample_quantity",
    "sample_testing_serving",
    "sample_testing_method",
    "sample_testing_type",
    "institution",
    "approved_by_email",
    "status",
    "created_at",
  ];
  const sample = [
    [
      "Legacy Requester",
      "legacy@example.com",
      "081234567890",
      "Sampel Air Sungai",
      "Air",
      "Brand A",
      "Botol 600 ml",
      "500 gram",
      "2 botol",
      "Uji Kimia Dasar",
      "SNI 01-3554",
      "Internal",
      "Sistem Lama CSL",
      "admin@example.com",
      "Completed",
      "2024-01-20T10:00:00+07:00",
    ],
  ];
  const guide = [
    ["Field", "Wajib", "Catatan"],
    ["name", "Ya", "Nama pemohon."],
    ["email", "Ya", "Email pemohon."],
    ["phone_number", "Tidak", "Nomor telepon pemohon."],
    ["sample_name", "Tidak", "Nama sampel."],
    ["sample_type", "Ya", "Jenis sampel."],
    ["sample_brand", "Tidak", "Merek sampel."],
    ["sample_packaging", "Tidak", "Kemasan sampel."],
    ["sample_weight", "Tidak", "Berat netto / dimensi sampel."],
    ["sample_quantity", "Tidak", "Jumlah sampel."],
    ["sample_testing_serving", "Tidak", "Cara penyajian / penanganan."],
    ["sample_testing_method", "Tidak", "Metode pengujian."],
    ["sample_testing_type", "Tidak", "Jenis pengujian."],
    ["approved_by_email", "Tidak", "Email approver jika ingin dihubungkan ke admin existing."],
    ["status", "Tidak", "Kosong akan dianggap Completed."],
    ["created_at", "Tidak", "Kosong akan menggunakan waktu import."],
    ["code", "Tidak", "Kosong akan dibuat otomatis dengan format EX-PS0000001."],
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, ...sample]), "SampleTesting");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(guide), "Guide");
  return workbook;
}

function parseResultMessage(value: unknown) {
  return extractApiErrorMessage(value, "Terjadi kesalahan.", [
    "detail",
    "name",
    "email",
    "sample_type",
    "code",
  ]);
}

export default function SampleTestingHistoryLegacyImportDialog({
  open,
  onOpenChange,
  onCompleted,
}: SampleTestingHistoryLegacyImportDialogProps) {
  const [previewRows, setPreviewRows] = useState<LegacySampleTestingImportRow[]>([]);
  const [skippedRows, setSkippedRows] = useState<SkippedRow[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const resetState = () => {
    setPreviewRows([]);
    setSkippedRows([]);
    setResults([]);
    setFileName("");
    setErrorMessage("");
    setIsSubmitting(false);
  };

  const handleDownloadTemplate = () => {
    XLSX.writeFile(buildTemplateWorkbook(), "template-legacy-sample-testing-history.xlsx");
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setErrorMessage("");
    setResults([]);

    if (!file) {
      setFileName("");
      setPreviewRows([]);
      setSkippedRows([]);
      return;
    }

    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        setErrorMessage("File tidak memiliki sheet.");
        return;
      }

      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false,
      }) as unknown[][];
      const [headerRow, ...bodyRows] = rawRows;
      if (!headerRow?.length) {
        setErrorMessage("Header tidak ditemukan pada file.");
        return;
      }

      const headerIndexes: Partial<Record<keyof LegacySampleTestingImportRow, number>> = {};
      headerRow.forEach((header, index) => {
        const mapped = HEADER_MAP[normalizeHeader(header)];
        if (mapped) headerIndexes[mapped] = index;
      });

      const nextPreviewRows: LegacySampleTestingImportRow[] = [];
      const nextSkippedRows: SkippedRow[] = [];

      bodyRows.forEach((row, index) => {
        const lineNumber = index + 2;
        const name = toCellString(row[headerIndexes.name ?? -1]);
        const email = toCellString(row[headerIndexes.email ?? -1]);
        const sampleType = toCellString(row[headerIndexes.sampleType ?? -1]);
        const isEmpty = !name && !email && !sampleType;
        if (isEmpty) return;

        const reasons: string[] = [];
        if (!name) reasons.push("name wajib diisi");
        if (!email) reasons.push("email wajib diisi");
        if (!sampleType) reasons.push("sample_type wajib diisi");

        if (reasons.length) {
          nextSkippedRows.push({ index: lineNumber, reason: reasons.join("; ") });
          return;
        }

        nextPreviewRows.push({
          index: lineNumber,
          code: toCellString(row[headerIndexes.code ?? -1]),
          name,
          institution: toCellString(row[headerIndexes.institution ?? -1]),
          institutionAddress: toCellString(row[headerIndexes.institutionAddress ?? -1]),
          email,
          phoneNumber: toCellString(row[headerIndexes.phoneNumber ?? -1]),
          sampleName: toCellString(row[headerIndexes.sampleName ?? -1]),
          sampleType,
          sampleBrand: toCellString(row[headerIndexes.sampleBrand ?? -1]),
          samplePackaging: toCellString(row[headerIndexes.samplePackaging ?? -1]),
          sampleWeight: toCellString(row[headerIndexes.sampleWeight ?? -1]),
          sampleQuantity: toCellString(row[headerIndexes.sampleQuantity ?? -1]),
          sampleTestingServing: toCellString(row[headerIndexes.sampleTestingServing ?? -1]),
          sampleTestingMethod: toCellString(row[headerIndexes.sampleTestingMethod ?? -1]),
          sampleTestingType: toCellString(row[headerIndexes.sampleTestingType ?? -1]),
          status: toCellString(row[headerIndexes.status ?? -1]),
          requestedById: toCellString(row[headerIndexes.requestedById ?? -1]),
          requestedByEmail: toCellString(row[headerIndexes.requestedByEmail ?? -1]),
          approvedById: toCellString(row[headerIndexes.approvedById ?? -1]),
          approvedByEmail: toCellString(row[headerIndexes.approvedByEmail ?? -1]),
          createdAt: toCellString(row[headerIndexes.createdAt ?? -1]),
          approvedAt: toCellString(row[headerIndexes.approvedAt ?? -1]),
          rejectedAt: toCellString(row[headerIndexes.rejectedAt ?? -1]),
          completedAt: toCellString(row[headerIndexes.completedAt ?? -1]),
        });
      });

      setPreviewRows(nextPreviewRows);
      setSkippedRows(nextSkippedRows);
      if (!nextPreviewRows.length) {
        setErrorMessage("Tidak ada data valid untuk diproses.");
      } else if (nextSkippedRows.length) {
        setErrorMessage("Sebagian baris dilewati. Periksa ringkasan baris terlewati.");
      }
    } catch (error) {
      console.error("Failed to parse sample testing legacy import file:", error);
      setErrorMessage("Gagal membaca file. Pastikan format Excel benar.");
      setPreviewRows([]);
      setSkippedRows([]);
    }
  };

  const handleSubmit = async () => {
    if (!previewRows.length) {
      setErrorMessage("Tidak ada data untuk diimport.");
      return;
    }

    setIsSubmitting(true);
    setResults([]);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await sampleTestingService.legacyBulkImport(
        previewRows,
        abortController.signal,
      );
      const payload = (response.data ?? {}) as {
        detail?: string;
        success_count?: number;
        failed_count?: number;
        results?: Array<{ index?: number; status?: "success" | "error"; message?: unknown }>;
      };

      if (!response.ok && !Array.isArray(payload.results)) {
        throw new Error(parseResultMessage(payload));
      }

      const nextResults: ResultRow[] = (payload.results || []).map((item) => ({
        index: Number(item.index) || 0,
        status: item.status === "success" ? "success" : "error",
        message: item.status === "success" ? "Sukses" : parseResultMessage(item.message),
      }));
      setResults(nextResults);

      const successCount = Number(payload.success_count ?? 0);
      const failedCount = Number(payload.failed_count ?? 0);
      if (successCount > 0) {
        toast.success(`${successCount} riwayat pengujian sampel berhasil diimport.`);
        onCompleted();
      }
      if (failedCount > 0) {
        toast.error(`${failedCount} baris gagal diimport.`);
      }
      if (successCount > 0 && failedCount === 0) {
        onOpenChange(false);
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }
      const message =
        error instanceof Error ? error.message : "Gagal import riwayat pengujian sampel.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setIsSubmitting(false);
    }
  };

  return (
    <BulkImportDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onReset={resetState}
      title="Import Legacy Riwayat Pengujian Sampel"
      description="Import data pengujian sampel lama tanpa validasi bisnis ketat. Sistem hanya memastikan field minimum tersedia."
      onDownloadTemplate={handleDownloadTemplate}
      onFileChange={handleFileChange}
      fileName={fileName}
      isProcessing={isSubmitting}
      onStopProcessing={() => {
        abortControllerRef.current?.abort();
        setErrorMessage("Proses import legacy dihentikan oleh pengguna.");
      }}
      error={errorMessage ? <InlineErrorAlert>{errorMessage}</InlineErrorAlert> : null}
      footer={
        <Button type="button" onClick={() => void handleSubmit()} disabled={!previewRows.length || isSubmitting}>
          {isSubmitting ? "Mengimport..." : "Import Data"}
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Gunakan fitur ini hanya saat migrasi data dari sistem lama. Untuk input operasional harian, tetap gunakan flow pengajuan pengujian biasa.
        </div>

        <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            {previewRows.length} baris siap diimport
          </span>
          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
            {skippedRows.length} baris dilewati saat parsing
          </span>
        </div>

        {previewRows.length ? (
          <div className="max-h-56 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left">Baris</th>
                  <th className="px-3 py-2 text-left">Nama</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Nomor Telepon</th>
                  <th className="px-3 py-2 text-left">Nama Sampel</th>
                  <th className="px-3 py-2 text-left">Jenis Sampel</th>
                  <th className="px-3 py-2 text-left">Merek Sampel</th>
                  <th className="px-3 py-2 text-left">Kemasan Sampel</th>
                  <th className="px-3 py-2 text-left">Berat Netto / Dimensi Sampel</th>
                  <th className="px-3 py-2 text-left">Jumlah Sampel</th>
                  <th className="px-3 py-2 text-left">Cara Penyajian / Penanganan</th>
                  <th className="px-3 py-2 text-left">Metode Pengujian</th>
                  <th className="px-3 py-2 text-left">Jenis Pengujian</th>
                  <th className="px-3 py-2 text-left">Disetujui Oleh</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.index} className="border-t border-slate-200">
                    <td className="px-3 py-2">{row.index}</td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">{row.email}</td>
                    <td className="px-3 py-2">{row.phoneNumber || "-"}</td>
                    <td className="px-3 py-2">{row.sampleName || "-"}</td>
                    <td className="px-3 py-2">{row.sampleType}</td>
                    <td className="px-3 py-2">{row.sampleBrand || "-"}</td>
                    <td className="px-3 py-2">{row.samplePackaging || "-"}</td>
                    <td className="px-3 py-2">{row.sampleWeight || "-"}</td>
                    <td className="px-3 py-2">{row.sampleQuantity || "-"}</td>
                    <td className="px-3 py-2">{row.sampleTestingServing || "-"}</td>
                    <td className="px-3 py-2">{row.sampleTestingMethod || "-"}</td>
                    <td className="px-3 py-2">{row.sampleTestingType || "-"}</td>
                    <td className="px-3 py-2">{row.approvedByEmail || row.approvedById || "-"}</td>
                    <td className="px-3 py-2">{row.status || "Completed"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {skippedRows.length ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {skippedRows.slice(0, 10).map((row) => (
              <p key={row.index}>Baris {row.index}: {row.reason}</p>
            ))}
            {skippedRows.length > 10 ? <p>Dan {skippedRows.length - 10} baris lain.</p> : null}
          </div>
        ) : null}

        {results.length ? (
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            {results.slice(0, 12).map((row) => (
              <p key={`${row.index}-${row.status}`}>
                Baris {row.index}: {row.status === "success" ? "Sukses" : row.message}
              </p>
            ))}
            {results.length > 12 ? <p>Dan {results.length - 12} hasil lain.</p> : null}
          </div>
        ) : null}
      </div>
    </BulkImportDialogShell>
  );
}
