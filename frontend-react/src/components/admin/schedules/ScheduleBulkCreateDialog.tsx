"use client";


import { useState, type ChangeEvent } from "react";

import * as XLSX from "xlsx";

import { toast } from "sonner";

import {
  ADMIN_FILTER_LABEL_CLASS,
  ADMIN_FILTER_SELECT_CLASS,
} from "@/components/admin/shared";

import { BulkImportDialogShell, InlineErrorAlert } from "@/components/shared";

import { Button } from "@/components/ui";

import {
  formatDateTimeLocalInput,
  validateScheduleForm,
  type ScheduleFormState,
} from "@/components/admin/schedules";

import {
  useBulkCreateSchedules,
  type BulkScheduleRow,
} from "@/hooks/shared/schedules";

const HEADER_MAP: Record<string, "title" | "className" | "description" | "date" | "startTime" | "endTime"> = {
  "judul jadwal": "title",
  judul: "title",
  title: "title",
  kelas: "className",
  class: "className",
  "class name": "className",
  deskripsi: "description",
  description: "description",
  tanggal: "date",
  date: "date",
  "waktu mulai": "startTime",
  mulai: "startTime",
  "start time": "startTime",
  "jam mulai": "startTime",
  "waktu selesai": "endTime",
  selesai: "endTime",
  "end time": "endTime",
  "jam selesai": "endTime",
};

type SkippedPreviewRow = {
  index: number;
  reason: string;
};

type ScheduleBulkCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: Array<{ id: string | number; label: string }>;
  onCompleted: () => void;
};

function normalizeHeader(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeDateCell(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return XLSX.SSF.format("yyyy-mm-dd", value);
  }

  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return "";
    const month = String(date.m).padStart(2, "0");
    const day = String(date.d).padStart(2, "0");
    return `${date.y}-${month}-${day}`;
  }

  const raw = String(value || "").trim();
  if (!raw) return "";

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return XLSX.SSF.format("yyyy-mm-dd", parsed);
  }

  return raw;
}

function normalizeTimeCell(value: unknown) {
  if (typeof value === "number") {
    const formatted = XLSX.SSF.format("hh:mm", value);
    return String(formatted).slice(0, 5);
  }

  const raw = String(value || "").trim();
  if (!raw) return "";

  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(raw)) {
    return raw.slice(0, 5);
  }

  const parsed = new Date(`1970-01-01T${raw}`);
  if (!Number.isNaN(parsed.getTime())) {
    const hours = String(parsed.getHours()).padStart(2, "0");
    const minutes = String(parsed.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  return raw;
}

function buildTemplateWorkbook() {
  const headers = [
    "judul jadwal",
    "kelas",
    "tanggal",
    "waktu mulai",
    "waktu selesai",
    "deskripsi",
  ];
  const sample = [
    [
      "Praktikum Kimia Dasar",
      "TI-2A",
      "2026-04-10",
      "08:00",
      "10:00",
      "Sesi praktikum laboratorium.",
    ],
    [
      "Praktikum Mikrobiologi",
      "BIO-3B",
      "2026-04-10",
      "13:00",
      "15:00",
      "Bawa APD lengkap.",
    ],
  ];
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  const guideRows = [
    ["Field", "Wajib", "Aturan", "Contoh"],
    ["judul jadwal", "Ya", "Isi nama agenda jadwal.", "Praktikum Kimia Dasar"],
    ["kelas", "Tidak", "Isi kelas atau kelompok bila ada.", "TI-2A"],
    ["tanggal", "Ya", "Gunakan format YYYY-MM-DD.", "2026-04-10"],
    ["waktu mulai", "Ya", "Gunakan format 24 jam HH:MM.", "08:00"],
    ["waktu selesai", "Ya", "Gunakan format 24 jam HH:MM.", "10:00"],
    ["deskripsi", "Tidak", "Catatan tambahan jadwal.", "Sesi praktikum laboratorium."],
    [],
    ["Catatan", "", "Ruangan dipilih dari dropdown di dialog, bukan dari file Excel.", ""],
    ["Catatan", "", "Upload harus memakai sheet pertama 'Schedules'.", ""],
  ];
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Schedules");
  XLSX.utils.book_append_sheet(workbook, guideSheet, "Guide");
  return workbook;
}

function toLocalDateTime(datePart: string, timePart: string) {
  if (!datePart || !timePart) return "";
  return `${datePart}T${timePart}`;
}

export default function ScheduleBulkCreateDialog({
  open,
  onOpenChange,
  rooms,
  onCompleted,
}: ScheduleBulkCreateDialogProps) {
  const [previewRows, setPreviewRows] = useState<BulkScheduleRow[]>([]);
  const [skippedRows, setSkippedRows] = useState<SkippedPreviewRow[]>([]);
  const [selectedRowIndexes, setSelectedRowIndexes] = useState<number[]>([]);
  const [fileName, setFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [results, setResults] = useState<
    { index: number; status: "success" | "error"; message: string }[]
  >([]);
  const { createSchedules, isSubmitting } = useBulkCreateSchedules();

  const resetState = () => {
    setPreviewRows([]);
    setSkippedRows([]);
    setSelectedRowIndexes([]);
    setFileName("");
    setErrorMessage("");
    setResults([]);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setErrorMessage("");
    setResults([]);

    if (!file) {
      setPreviewRows([]);
      setSkippedRows([]);
      setFileName("");
      return;
    }

    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        setErrorMessage("File tidak memiliki sheet.");
        setPreviewRows([]);
        setSkippedRows([]);
        return;
      }

      const sheet = workbook.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: true,
      }) as unknown[][];
      const [headerRow, ...bodyRows] = raw;

      if (!headerRow || headerRow.length === 0) {
        setErrorMessage("Header tidak ditemukan pada file.");
        setPreviewRows([]);
        setSkippedRows([]);
        return;
      }

      const headerIndexes: Partial<
        Record<"title" | "className" | "description" | "date" | "startTime" | "endTime", number>
      > = {};
      headerRow.forEach((header, index) => {
        const mapped = HEADER_MAP[normalizeHeader(header)];
        if (mapped) headerIndexes[mapped] = index;
      });

      const nextPreviewRows: BulkScheduleRow[] = [];
      const nextSkippedRows: SkippedPreviewRow[] = [];

      bodyRows.forEach((row, index) => {
        const lineNumber = index + 2;
        const title = String(row[headerIndexes.title ?? -1] || "").trim();
        const className = String(row[headerIndexes.className ?? -1] || "").trim();
        const description = String(row[headerIndexes.description ?? -1] || "").trim();
        const date = normalizeDateCell(row[headerIndexes.date ?? -1]);
        const startTimeText = normalizeTimeCell(row[headerIndexes.startTime ?? -1]);
        const endTimeText = normalizeTimeCell(row[headerIndexes.endTime ?? -1]);

        const isCompletelyEmpty =
          !title &&
          !className &&
          !description &&
          !date &&
          !startTimeText &&
          !endTimeText;

        if (isCompletelyEmpty) {
          return;
        }

        const draftForm: ScheduleFormState = {
          title,
          className,
          description,
          category: "Practicum",
          room: "",
          startTime: toLocalDateTime(date, startTimeText),
          endTime: toLocalDateTime(date, endTimeText),
        };

        let rowError = "";
        const payload = validateScheduleForm(draftForm, (message) => {
          rowError = message;
        });

        if (!payload) {
          nextSkippedRows.push({
            index: lineNumber,
            reason: rowError || "Data tidak valid.",
          });
          return;
        }

        nextPreviewRows.push({
          index: lineNumber,
          title: payload.title,
          className: payload.class_name ?? "",
          description: payload.description ?? "",
          category: "Practicum",
          room: "",
          startTime: payload.start_time,
          endTime: payload.end_time,
        });
      });

      setPreviewRows(nextPreviewRows);
      setSelectedRowIndexes(nextPreviewRows.map((row) => row.index));
      setSkippedRows(nextSkippedRows);

      if (!nextPreviewRows.length) {
        setErrorMessage("Tidak ada data valid untuk diproses.");
      } else if (nextSkippedRows.length) {
        setErrorMessage("Sebagian baris dilewati. Periksa alasan pada ringkasan preview.");
      }
    } catch (error) {
      console.error("Failed to parse schedule file:", error);
      setErrorMessage("Gagal membaca file. Pastikan format Excel benar.");
      setPreviewRows([]);
      setSkippedRows([]);
    }
  };

  const handleDownloadTemplate = () => {
    XLSX.writeFile(buildTemplateWorkbook(), "template-bulk-jadwal.xlsx");
  };

  const handleSubmitBulk = async () => {
    if (!previewRows.length || !selectedRowIndexes.length) {
      setErrorMessage("Pilih minimal satu baris valid untuk diproses.");
      return;
    }

    const selectedRows = previewRows.filter((row) =>
      selectedRowIndexes.includes(row.index),
    );
    const bulkResults = await createSchedules(selectedRows, setResults);
    const successCount = bulkResults.filter((row) => row.status === "success").length;

    if (successCount > 0) {
      onCompleted();
      onOpenChange(false);
      resetState();
      toast.success(`${successCount} jadwal berhasil dibuat.`);
    }
  };

  const allRowsSelected =
    previewRows.length > 0 && selectedRowIndexes.length === previewRows.length;

  const toggleAllRows = (checked: boolean) => {
    setSelectedRowIndexes(checked ? previewRows.map((row) => row.index) : []);
  };

  const toggleRowSelection = (rowIndex: number, checked: boolean) => {
    setSelectedRowIndexes((prev) =>
      checked ? [...prev, rowIndex] : prev.filter((item) => item !== rowIndex),
    );
  };

  const updateRowRoom = (rowIndex: number, room: string) => {
    const changedRow = previewRows.find((r) => r.index === rowIndex);
    if (!changedRow) return;

    const matchTitle = changedRow.title.trim().toLowerCase();
    const matchClass = changedRow.className.trim().toLowerCase();

    setPreviewRows((current) =>
      current.map((row) => {
        const sameTitle = row.title.trim().toLowerCase() === matchTitle;
        const sameClass = row.className.trim().toLowerCase() === matchClass;
        return sameTitle && sameClass ? { ...row, room } : row;
      }),
    );
  };

  return (
    <BulkImportDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onReset={resetState}
      title="Bulk Tambah Jadwal"
      description="Upload file Excel untuk membuat banyak jadwal sekaligus. Ruangan dipilih dari dropdown di dialog ini."
      onDownloadTemplate={handleDownloadTemplate}
      onFileChange={handleFile}
      fileName={fileName}
      error={errorMessage ? <InlineErrorAlert>{errorMessage}</InlineErrorAlert> : undefined}
      footer={
        <Button
          type="button"
          onClick={() => void handleSubmitBulk()}
          disabled={!previewRows.length || !selectedRowIndexes.length || isSubmitting}
        >
          {isSubmitting ? "Memproses..." : "Buat Jadwal"}
        </Button>
      }
    >
      <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/70 p-3">
        <p className={ADMIN_FILTER_LABEL_CLASS}>Ruangan</p>
        <p className="text-xs text-slate-500">
          Pilih ruangan langsung pada tiap baris preview sebelum membuat jadwal.
        </p>
      </div>

      {previewRows.length ? (
        <div className="min-w-0 space-y-2 rounded-md border p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
              Valid: {previewRows.length}
            </span>
            <span className="rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-700">
              Dipilih: {selectedRowIndexes.length}
            </span>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-700">
              Dilewati: {skippedRows.length}
            </span>
          </div>

          <div className="max-h-80 w-full min-w-0 max-w-full overflow-x-auto overflow-y-auto rounded-md border">
            <table className="w-full min-w-[1040px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-muted/40">
                <tr>
                  <th className="w-[56px] px-2 py-2 text-center font-medium">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={allRowsSelected}
                      onChange={(event) => toggleAllRows(event.target.checked)}
                      aria-label="Pilih semua baris valid"
                    />
                  </th>
                  <th className="w-[64px] px-2 py-2 font-medium">Baris</th>
                  <th className="px-2 py-2 font-medium">Judul</th>
                  <th className="px-2 py-2 font-medium">Kelas</th>
                  <th className="px-2 py-2 font-medium">Ruangan</th>
                  <th className="px-2 py-2 font-medium">Mulai</th>
                  <th className="px-2 py-2 font-medium">Selesai</th>
                  <th className="px-2 py-2 font-medium">Deskripsi</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.index} className="border-t">
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={selectedRowIndexes.includes(row.index)}
                        onChange={(event) =>
                          toggleRowSelection(row.index, event.target.checked)
                        }
                        aria-label={`Pilih baris ${row.index}`}
                      />
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{row.index}</td>
                    <td className="px-2 py-2">{row.title}</td>
                    <td className="px-2 py-2">{row.className || "-"}</td>
                    <td className="px-2 py-2">
                      <select
                        value={row.room}
                        onChange={(event) =>
                          updateRowRoom(row.index, event.target.value)
                        }
                        className={ADMIN_FILTER_SELECT_CLASS}
                      >
                        <option value="">Semua / Tidak spesifik</option>
                        {rooms.map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {formatDateTimeLocalInput(row.startTime).replace("T", " ")}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {formatDateTimeLocalInput(row.endTime).replace("T", " ")}
                    </td>
                    <td className="px-2 py-2">{row.description || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {skippedRows.length ? (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-xs font-medium text-amber-800">
            Baris dilewati: {skippedRows.length}
          </p>
          <div className="max-h-40 space-y-1 overflow-y-auto text-xs text-amber-900">
            {skippedRows.map((row) => (
              <p key={`skipped-${row.index}`}>
                Baris {row.index}: {row.reason}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {results.length ? (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-xs font-medium">Hasil proses</p>
          <div className="max-h-40 space-y-1 overflow-y-auto text-xs">
            {results.map((row) => (
              <p
                key={`${row.index}-${row.status}`}
                className={
                  row.status === "success" ? "text-emerald-700" : "text-destructive"
                }
              >
                Baris {row.index}: {row.message}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </BulkImportDialogShell>
  );
}
