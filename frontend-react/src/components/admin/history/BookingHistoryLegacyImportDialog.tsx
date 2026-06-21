"use client";

import { useState, type ChangeEvent } from "react";

import * as XLSX from "xlsx";

import { toast } from "sonner";

import { bookingRoomsService, type LegacyBookingImportRow } from "@/services/booking-rooms";

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

type BookingHistoryLegacyImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
};

const HEADER_MAP: Record<string, keyof LegacyBookingImportRow> = {
  kode: "code",
  code: "code",
  requester_name: "requesterName",
  "nama peminjam": "requesterName",
  peminjam: "requesterName",
  room: "roomName",
  room_id: "roomId",
  room_number: "roomNumber",
  "nomor ruangan": "roomNumber",
  room_name: "roomName",
  "nama ruangan": "roomName",
  start_time: "startTime",
  "waktu mulai": "startTime",
  end_time: "endTime",
  "waktu selesai": "endTime",
  status: "status",
  purpose: "purpose",
  kategori: "purpose",
  attendee_count: "attendeeCount",
  "jumlah peserta": "attendeeCount",
  attendee_names: "attendeeNames",
  "nama peserta": "attendeeNames",
  requested_by: "requestedById",
  requested_by_email: "requestedByEmail",
  "email pemohon": "requestedByEmail",
  requester_phone: "requesterPhone",
  "telepon pemohon": "requesterPhone",
  requester_mentor: "requesterMentor",
  institution: "institution",
  institution_address: "institutionAddress",
  note: "note",
  catatan: "note",
  approved_by: "approvedById",
  approved_by_email: "approvedByEmail",
  created_at: "createdAt",
  approved_at: "approvedAt",
  rejected_at: "rejectedAt",
  rejection_note: "rejectionNote",
  expired_at: "expiredAt",
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
    "requester_name",
    "room_name",
    "start_time",
    "end_time",
    "status",
    "purpose",
    "requested_by_email",
    "note",
  ];
  const sample = [
    [
      "Budi Santoso",
      "Lab A",
      "2024-01-15T09:00:00+07:00",
      "2024-01-15T12:00:00+07:00",
      "Completed",
      "Penelitian",
      "user@example.com",
      "Import riwayat legacy",
    ],
  ];
  const guide = [
    ["Field", "Wajib", "Catatan"],
    ["requester_name", "Tidak", "Nama peminjam legacy jika tidak terhubung ke akun sistem."],
    ["room_name / room_number / room_id", "Ya", "Minimal isi salah satu referensi ruangan. Disarankan gunakan room_name."],
    ["start_time", "Ya", "Gunakan format ISO datetime, contoh 2024-01-15T09:00:00+07:00."],
    ["end_time", "Ya", "Gunakan format ISO datetime."],
    ["status", "Tidak", "Kosong akan dianggap Completed."],
    ["purpose", "Tidak", "Kosong akan dianggap Other."],
    ["requested_by_email", "Tidak", "Jika email profile ada di sistem, akan dihubungkan otomatis."],
    ["code", "Tidak", "Kosong akan dibuat otomatis dengan format EX-PL0000001."],
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, ...sample]), "Bookings");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(guide), "Guide");
  return workbook;
}

function parseResultMessage(value: unknown) {
  return extractApiErrorMessage(value, "Terjadi kesalahan.", [
    "detail",
    "room_name",
    "start_time",
    "end_time",
    "code",
  ]);
}

export default function BookingHistoryLegacyImportDialog({
  open,
  onOpenChange,
  onCompleted,
}: BookingHistoryLegacyImportDialogProps) {
  const [previewRows, setPreviewRows] = useState<LegacyBookingImportRow[]>([]);
  const [skippedRows, setSkippedRows] = useState<SkippedRow[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetState = () => {
    setPreviewRows([]);
    setSkippedRows([]);
    setResults([]);
    setFileName("");
    setErrorMessage("");
    setIsSubmitting(false);
  };

  const handleDownloadTemplate = () => {
    XLSX.writeFile(buildTemplateWorkbook(), "template-legacy-booking-history.xlsx");
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

      const headerIndexes: Partial<Record<keyof LegacyBookingImportRow, number>> = {};
      headerRow.forEach((header, index) => {
        const mapped = HEADER_MAP[normalizeHeader(header)];
        if (mapped) headerIndexes[mapped] = index;
      });

      const nextPreviewRows: LegacyBookingImportRow[] = [];
      const nextSkippedRows: SkippedRow[] = [];

      bodyRows.forEach((row, index) => {
        const lineNumber = index + 2;
        const roomId = toCellString(row[headerIndexes.roomId ?? -1]);
        const requesterName = toCellString(row[headerIndexes.requesterName ?? -1]);
        const roomNumber = toCellString(row[headerIndexes.roomNumber ?? -1]);
        const roomName = toCellString(row[headerIndexes.roomName ?? -1]);
        const startTime = toCellString(row[headerIndexes.startTime ?? -1]);
        const endTime = toCellString(row[headerIndexes.endTime ?? -1]);

        const isEmpty = !roomId && !roomNumber && !roomName && !startTime && !endTime;
        if (isEmpty) return;

        const reasons: string[] = [];
        if (!roomId && !roomNumber && !roomName) {
          reasons.push("room_name wajib diisi");
        }
        if (!startTime) reasons.push("start_time wajib diisi");
        if (!endTime) reasons.push("end_time wajib diisi");

        if (reasons.length) {
          nextSkippedRows.push({ index: lineNumber, reason: reasons.join("; ") });
          return;
        }

        nextPreviewRows.push({
          index: lineNumber,
          code: toCellString(row[headerIndexes.code ?? -1]),
          requesterName,
          roomId,
          roomNumber,
          roomName,
          startTime,
          endTime,
          status: toCellString(row[headerIndexes.status ?? -1]),
          purpose: toCellString(row[headerIndexes.purpose ?? -1]),
          attendeeCount: Number(toCellString(row[headerIndexes.attendeeCount ?? -1]) || 1),
          attendeeNames: toCellString(row[headerIndexes.attendeeNames ?? -1]),
          requestedById: toCellString(row[headerIndexes.requestedById ?? -1]),
          requestedByEmail: toCellString(row[headerIndexes.requestedByEmail ?? -1]),
          requesterPhone: toCellString(row[headerIndexes.requesterPhone ?? -1]),
          requesterMentor: toCellString(row[headerIndexes.requesterMentor ?? -1]),
          institution: toCellString(row[headerIndexes.institution ?? -1]),
          institutionAddress: toCellString(row[headerIndexes.institutionAddress ?? -1]),
          approvedById: toCellString(row[headerIndexes.approvedById ?? -1]),
          approvedByEmail: toCellString(row[headerIndexes.approvedByEmail ?? -1]),
          createdAt: toCellString(row[headerIndexes.createdAt ?? -1]),
          approvedAt: toCellString(row[headerIndexes.approvedAt ?? -1]),
          rejectedAt: toCellString(row[headerIndexes.rejectedAt ?? -1]),
          rejectionNote: toCellString(row[headerIndexes.rejectionNote ?? -1]),
          expiredAt: toCellString(row[headerIndexes.expiredAt ?? -1]),
          completedAt: toCellString(row[headerIndexes.completedAt ?? -1]),
          note: toCellString(row[headerIndexes.note ?? -1]),
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
      console.error("Failed to parse booking legacy import file:", error);
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

    try {
      const response = await bookingRoomsService.legacyBulkImport(previewRows);
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
        toast.success(`${successCount} riwayat peminjaman lab berhasil diimport.`);
        onCompleted();
      }
      if (failedCount > 0) {
        toast.error(`${failedCount} baris gagal diimport.`);
      }
      if (successCount > 0 && failedCount === 0) {
        onOpenChange(false);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal import riwayat peminjaman lab.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BulkImportDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onReset={resetState}
      title="Import Legacy Riwayat Peminjaman Lab"
      description="Import data booking lama tanpa validasi bisnis ketat. Sistem hanya memastikan field minimum tersedia."
      onDownloadTemplate={handleDownloadTemplate}
      onFileChange={handleFileChange}
      fileName={fileName}
      error={errorMessage ? <InlineErrorAlert>{errorMessage}</InlineErrorAlert> : null}
      footer={
        <Button type="button" onClick={() => void handleSubmit()} disabled={!previewRows.length || isSubmitting}>
          {isSubmitting ? "Mengimport..." : "Import Data"}
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Gunakan fitur ini hanya saat migrasi data dari sistem lama. Untuk input operasional harian, tetap gunakan flow booking biasa.
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
                  <th className="px-3 py-2 text-left">Nama Peminjam</th>
                  <th className="px-3 py-2 text-left">Ruangan</th>
                  <th className="px-3 py-2 text-left">Mulai</th>
                  <th className="px-3 py-2 text-left">Selesai</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.index} className="border-t border-slate-200">
                    <td className="px-3 py-2">{row.index}</td>
                    <td className="px-3 py-2">{row.requesterName || "-"}</td>
                    <td className="px-3 py-2">{row.roomName || row.roomNumber || row.roomId || "-"}</td>
                    <td className="px-3 py-2">{row.startTime}</td>
                    <td className="px-3 py-2">{row.endTime}</td>
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
