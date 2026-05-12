"use client";


import { useMemo, useState } from "react";

import * as XLSX from "xlsx";

import { toast } from "sonner";

import { Button } from "@/components/ui";

import { BulkImportDialogShell, InlineErrorAlert } from "@/components/shared";

import {
  useBulkCreateRooms,
  type BulkRoomRow,
} from "@/hooks/shared/resources/rooms";

import { usePicUsers } from "@/hooks/shared/resources/users";

const HEADER_MAP: Record<
  string,
  keyof Pick<
    BulkRoomRow,
    "name" | "number" | "floor" | "capacity" | "description"
  >
> = {
  nama: "name",
  "nama ruangan": "name",
  name: "name",
  "room name": "name",
  nomor: "number",
  "nomor ruangan": "number",
  number: "number",
  "room number": "number",
  lantai: "floor",
  floor: "floor",
  kapasitas: "capacity",
  capacity: "capacity",
  deskripsi: "description",
  description: "description",
};

type SkippedPreviewRow = {
  index: number;
  reason: string;
};

type RoomBulkImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
};

function normalizeHeader(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buildTemplateWorkbook() {
  const headers = [
    "nama ruangan",
    "nomor ruangan",
    "lantai",
    "kapasitas",
    "deskripsi",
  ];
  const sample = [
    [
      "Web & Mobile Application Lab",
      "F.LAB.STEM-12602",
      "G",
      "34",
      "Laboratorium pengembangan aplikasi web dan mobile. Tersedia perangkat PC, Mac, dan beberapa perangkat mobile untuk keperluan praktikum dan penelitian.",
    ],
  ];
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  const guideRows = [
    ["Field", "Wajib", "Aturan", "Contoh"],
    ["nama ruangan", "Ya", "Isi nama ruangan.", "Lab Kimia Dasar"],
    ["nomor ruangan", "Ya", "Isi nomor atau kode ruangan.", "A101"],
    ["lantai", "Ya", "Boleh teks bebas sesuai format sistem.", "1"],
    ["kapasitas", "Ya", "Harus angka bulat lebih dari 0.", "32"],
    [
      "deskripsi",
      "Tidak",
      "Deskripsi ruangan.",
      "Laboratorium praktikum kimia dasar",
    ],
    [],
    [
      "Catatan",
      "",
      "PIC dipilih per baris pada tabel preview sebelum import.",
      "",
    ],
    ["Catatan", "", "Gambar ruangan belum perlu diisi saat bulk import.", ""],
  ];
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Rooms");
  XLSX.utils.book_append_sheet(workbook, guideSheet, "Guide");
  return workbook;
}

export default function RoomBulkImportDialog({
  open,
  onOpenChange,
  onCompleted,
}: RoomBulkImportDialogProps) {
  const [previewRows, setPreviewRows] = useState<BulkRoomRow[]>([]);
  const [skippedRows, setSkippedRows] = useState<SkippedPreviewRow[]>([]);
  const [results, setResults] = useState<
    { index: number; status: "success" | "error"; message: string }[]
  >([]);
  const [selectedRowIndexes, setSelectedRowIndexes] = useState<number[]>([]);
  const [rowPicSelections, setRowPicSelections] = useState<
    Record<number, string>
  >({});
  const [fileName, setFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { createRooms, isSubmitting } = useBulkCreateRooms();
  const {
    picUsers,
    isLoading: isLoadingPics,
    error: picError,
  } = usePicUsers(open);

  const picOptions = useMemo(
    () => picUsers.map((user) => ({ value: user.id, label: user.name })),
    [picUsers],
  );

  const resetState = () => {
    setPreviewRows([]);
    setSkippedRows([]);
    setResults([]);
    setSelectedRowIndexes([]);
    setRowPicSelections({});
    setFileName("");
    setErrorMessage("");
  };

  const handleDownloadTemplate = () => {
    XLSX.writeFile(buildTemplateWorkbook(), "template-bulk-rooms.xlsx");
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
      }) as unknown[][];
      const [headerRow, ...bodyRows] = raw;
      if (!headerRow?.length) {
        setErrorMessage("Header tidak ditemukan pada file.");
        setPreviewRows([]);
        setSkippedRows([]);
        return;
      }

      const headerIndexes: Partial<Record<keyof BulkRoomRow, number>> = {};
      headerRow.forEach((header, index) => {
        const mapped = HEADER_MAP[normalizeHeader(header)];
        if (mapped) headerIndexes[mapped] = index;
      });

      const nextPreviewRows: BulkRoomRow[] = [];
      const nextSkippedRows: SkippedPreviewRow[] = [];

      bodyRows.forEach((row, index) => {
        const lineNumber = index + 2;
        const name = String(row[headerIndexes.name ?? -1] || "").trim();
        const number = String(row[headerIndexes.number ?? -1] || "").trim();
        const floor = String(row[headerIndexes.floor ?? -1] || "").trim();
        const capacity = String(row[headerIndexes.capacity ?? -1] || "").trim();
        const description = String(
          row[headerIndexes.description ?? -1] || "",
        ).trim();

        const isCompletelyEmpty =
          !name && !number && !floor && !capacity && !description;
        if (isCompletelyEmpty) return;

        const reasons: string[] = [];
        if (!name) reasons.push("nama ruangan wajib diisi");
        if (!number) reasons.push("nomor ruangan wajib diisi");
        if (!floor) reasons.push("lantai wajib diisi");
        if (!capacity) reasons.push("kapasitas wajib diisi");
        if (capacity) {
          const parsedCapacity = Number(capacity);
          if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
            reasons.push("kapasitas harus angka bulat lebih dari 0");
          }
        }

        if (reasons.length) {
          nextSkippedRows.push({
            index: lineNumber,
            reason: reasons.join("; "),
          });
          return;
        }

        nextPreviewRows.push({
          index: lineNumber,
          name,
          number,
          floor,
          capacity,
          description,
        });
      });

      setPreviewRows(nextPreviewRows);
      setSelectedRowIndexes(nextPreviewRows.map((row) => row.index));
      setRowPicSelections({});
      setSkippedRows(nextSkippedRows);
      if (!nextPreviewRows.length) {
        setErrorMessage("Tidak ada data valid untuk diproses.");
      } else if (nextSkippedRows.length) {
        setErrorMessage(
          "Sebagian baris dilewati. Periksa alasan pada ringkasan preview.",
        );
      }
    } catch (error) {
      console.error("Failed to parse room import file:", error);
      setErrorMessage("Gagal membaca file. Pastikan format Excel benar.");
      setPreviewRows([]);
      setSkippedRows([]);
    }
  };

  const handleSubmitBulk = async () => {
    if (!previewRows.length || !selectedRowIndexes.length) {
      setErrorMessage("Pilih minimal satu baris valid untuk diproses.");
      return;
    }

    const selectedRows = previewRows
      .filter((row) => selectedRowIndexes.includes(row.index))
      .map((row) => ({
        ...row,
        picId: rowPicSelections[row.index] || undefined,
      }));

    const bulkResults = await createRooms(selectedRows, setResults);
    const successCount = bulkResults.filter(
      (row) => row.status === "success",
    ).length;

    if (successCount > 0) {
      onCompleted();
      onOpenChange(false);
      resetState();
      toast.success(`${successCount} ruangan berhasil dibuat.`);
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

    if (!checked) {
      setRowPicSelections((prev) => {
        const next = { ...prev };
        delete next[rowIndex];
        return next;
      });
    }
  };

  return (
    <BulkImportDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onReset={resetState}
      title="Bulk Import Ruangan"
      description={
        <>
          Upload file Excel untuk membuat banyak ruangan sekaligus. Pilih
          baris yang akan diimport, lalu assign PIC per baris bila diperlukan.
        </>
      }
      onDownloadTemplate={handleDownloadTemplate}
      onFileChange={handleFile}
      fileName={fileName}
      error={
        errorMessage ? (
          <InlineErrorAlert>{errorMessage}</InlineErrorAlert>
        ) : undefined
      }
      footer={
        <Button
          type="button"
          onClick={() => void handleSubmitBulk()}
          disabled={!previewRows.length || !selectedRowIndexes.length || isSubmitting}
        >
          {isSubmitting ? "Memproses..." : "Import Ruangan"}
        </Button>
      }
    >
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
                  <th className="px-2 py-2 font-medium">Nama</th>
                  <th className="w-[120px] px-2 py-2 font-medium">Nomor</th>
                  <th className="w-[120px] px-2 py-2 font-medium">Lantai</th>
                  <th className="w-[100px] px-2 py-2 font-medium">Kapasitas</th>
                  <th className="px-2 py-2 font-medium">Deskripsi</th>
                  <th className="w-[280px] px-2 py-2 font-medium">PIC</th>
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
                    <td className="px-2 py-2 text-muted-foreground">
                      {row.index}
                    </td>
                    <td className="px-2 py-2">{row.name}</td>
                    <td className="px-2 py-2">{row.number}</td>
                    <td className="px-2 py-2">{row.floor}</td>
                    <td className="px-2 py-2">{row.capacity}</td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {row.description || "-"}
                    </td>
                    <td className="px-2 py-2">
                      {selectedRowIndexes.includes(row.index) ? (
                        <select
                          value={rowPicSelections[row.index] || ""}
                          onChange={(event) =>
                            setRowPicSelections((prev) => ({
                              ...prev,
                              [row.index]: event.target.value,
                            }))
                          }
                          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs outline-none focus-visible:border-slate-500 focus-visible:ring-[3px] focus-visible:ring-slate-200"
                          disabled={isLoadingPics}
                        >
                          <option value="">
                            {isLoadingPics ? "Memuat PIC..." : "Tanpa PIC"}
                          </option>
                          {picOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          Pilih baris untuk assign PIC
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {picError ? (
            <p className="text-xs text-destructive">{picError}</p>
          ) : null}
        </div>
      ) : null}

      {skippedRows.length ? (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-xs font-medium text-amber-800">
            Baris dilewati: {skippedRows.length}
          </p>
          <div className="max-h-40 space-y-1 overflow-y-auto text-xs text-amber-900">
            {skippedRows.map((row) => (
              <p key={`skipped-room-${row.index}`}>
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
                  row.status === "success"
                    ? "text-emerald-700"
                    : "text-destructive"
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
