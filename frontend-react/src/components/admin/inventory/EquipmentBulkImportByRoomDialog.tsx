"use client";

import { useMemo, useState } from "react";

import * as XLSX from "xlsx";

import { toast } from "sonner";

import { Button } from "@/components/ui";

import { BulkImportDialogShell, InlineErrorAlert } from "@/components/shared";

import { EQUIPMENT_CATEGORY_OPTIONS } from "@/constants/equipments";

import {
  useBulkCreateEquipments,
  type BulkEquipmentRow,
} from "@/hooks/shared/resources/equipments";

import { useRoomOptions } from "@/hooks/shared/resources/rooms";

const HEADER_MAP: Record<
  string,
  keyof Pick<
    BulkEquipmentRow,
    "name" | "quantity" | "category" | "isMoveable" | "isShareable" | "isBorrowable" | "description"
  >
> = {
  nama: "name",
  "nama alat": "name",
  "nama peralatan": "name",
  name: "name",
  jumlah: "quantity",
  quantity: "quantity",
  kategori: "category",
  category: "category",
  moveable: "isMoveable",
  "is moveable": "isMoveable",
  "bisa dipindah": "isMoveable",
  shareable: "isShareable",
  "is shareable": "isShareable",
  "bisa dibagi": "isShareable",
  borrowable: "isBorrowable",
  "is borrowable": "isBorrowable",
  "bisa dipinjam": "isBorrowable",
  deskripsi: "description",
  description: "description",
};

type SkippedPreviewRow = {
  index: number;
  reason: string;
};

type EquipmentBulkImportByRoomDialogProps = {
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

function parseMoveableValue(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["true", "ya", "yes", "1"].includes(normalized)) return true;
  if (["false", "tidak", "no", "0"].includes(normalized)) return false;
  return null;
}

function buildTemplateWorkbook() {
  const headers = [
    "nama peralatan",
    "jumlah",
    "kategori",
    "moveable",
    "shareable",
    "borrowable",
    "deskripsi",
  ];
  const sample = [
    [
      "Raspberry Pi 5",
      "4",
      "Computer",
      "ya",
      "tidak",
      "ya",
      "Single board computer untuk praktikum",
    ],
    ["Oscilloscope", "2", "Electronics", "tidak", "tidak", "ya", "Alat ukur elektronika"],
  ];
  const guideRows = [
    ["Field", "Wajib", "Aturan", "Contoh"],
    ["nama peralatan", "Ya", "Isi nama peralatan.", "Raspberry Pi 5"],
    ["jumlah", "Ya", "Harus angka bulat lebih dari 0.", "4"],
    [
      "kategori",
      "Ya",
      `Harus sama persis dengan salah satu opsi berikut: ${EQUIPMENT_CATEGORY_OPTIONS.map((item) => item.value).join(", ")}.`,
      "Computer",
    ],
    ["moveable", "Ya", "Boleh: ya/tidak atau true/false.", "ya"],
    ["shareable", "Tidak", "Boleh: ya/tidak atau true/false. Default: tidak.", "tidak"],
    ["borrowable", "Tidak", "Boleh: ya/tidak atau true/false. Default: tidak.", "ya"],
    [
      "deskripsi",
      "Tidak",
      "Deskripsi peralatan.",
      "Single board computer untuk praktikum",
    ],
    [],
    [
      "Catatan",
      "",
      "Ruangan dipilih satu kali untuk semua peralatan saat import by ruangan.",
      "",
    ],
    ["Catatan", "", "Gambar peralatan belum perlu diisi saat bulk import.", ""],
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([headers, ...sample]),
    "Equipments",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(guideRows),
    "Guide",
  );
  return workbook;
}

export default function EquipmentBulkImportByRoomDialog({
  open,
  onOpenChange,
  onCompleted,
}: EquipmentBulkImportByRoomDialogProps) {
  const [previewRows, setPreviewRows] = useState<BulkEquipmentRow[]>([]);
  const [skippedRows, setSkippedRows] = useState<SkippedPreviewRow[]>([]);
  const [results, setResults] = useState<
    { index: number; status: "success" | "error"; message: string }[]
  >([]);
  const [selectedRowIndexes, setSelectedRowIndexes] = useState<number[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [fileName, setFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { createEquipments, cancelCreateEquipments, isSubmitting } = useBulkCreateEquipments();
  const {
    rooms,
    isLoading: isLoadingRooms,
    error: roomError,
  } = useRoomOptions(open);

  const roomOptions = useMemo(
    () => rooms.map((room) => ({ value: room.id, label: room.label })),
    [rooms],
  );

  const resetState = () => {
    setPreviewRows([]);
    setSkippedRows([]);
    setResults([]);
    setSelectedRowIndexes([]);
    setSelectedRoomId("");
    setFileName("");
    setErrorMessage("");
  };

  const handleDownloadTemplate = () => {
    XLSX.writeFile(
      buildTemplateWorkbook(),
      "template-bulk-equipments-by-ruangan.xlsx",
    );
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setErrorMessage("");
    setResults([]);
    if (!file) {
      resetState();
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

      const headerIndexes: Partial<Record<keyof BulkEquipmentRow, number>> = {};
      headerRow.forEach((header, index) => {
        const mapped = HEADER_MAP[normalizeHeader(header)];
        if (mapped) headerIndexes[mapped] = index;
      });

      const categoryValues = new Set(
        EQUIPMENT_CATEGORY_OPTIONS.map((item) => item.value),
      );
      const nextPreviewRows: BulkEquipmentRow[] = [];
      const nextSkippedRows: SkippedPreviewRow[] = [];

      bodyRows.forEach((row, index) => {
        const lineNumber = index + 2;
        const name = String(row[headerIndexes.name ?? -1] || "").trim();
        const quantity = String(row[headerIndexes.quantity ?? -1] || "").trim();
        const category = String(row[headerIndexes.category ?? -1] || "").trim();
        const moveableRaw = String(row[headerIndexes.isMoveable ?? -1] || "").trim();
        const shareableRaw = String(row[headerIndexes.isShareable ?? -1] || "").trim();
        const borrowableRaw = String(row[headerIndexes.isBorrowable ?? -1] || "").trim();
        const description = String(row[headerIndexes.description ?? -1] || "").trim();

        const isCompletelyEmpty =
          !name && !quantity && !category && !moveableRaw && !description;
        if (isCompletelyEmpty) return;

        const reasons: string[] = [];
        if (!name) reasons.push("nama peralatan wajib diisi");
        if (!quantity) reasons.push("jumlah wajib diisi");
        if (!category) reasons.push("kategori wajib diisi");
        if (!moveableRaw) reasons.push("moveable wajib diisi");
        if (quantity) {
          const parsed = Number(quantity);
          if (!Number.isInteger(parsed) || parsed <= 0) {
            reasons.push("jumlah harus angka bulat lebih dari 0");
          }
        }
        if (category && !categoryValues.has(category)) {
          reasons.push("kategori tidak sesuai opsi");
        }

        const parsedMoveable = parseMoveableValue(moveableRaw);
        if (moveableRaw && parsedMoveable === null) {
          reasons.push("moveable harus ya/tidak atau true/false");
        }

        const parsedShareable = shareableRaw ? parseMoveableValue(shareableRaw) : false;
        if (shareableRaw && parsedShareable === null) {
          reasons.push("shareable harus ya/tidak atau true/false");
        }

        const parsedBorrowable = borrowableRaw ? parseMoveableValue(borrowableRaw) : false;
        if (borrowableRaw && parsedBorrowable === null) {
          reasons.push("borrowable harus ya/tidak atau true/false");
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
          quantity,
          category,
          isMoveable: Boolean(parsedMoveable),
          isShareable: Boolean(parsedShareable),
          isBorrowable: Boolean(parsedBorrowable),
          description,
        });
      });

      setPreviewRows(nextPreviewRows);
      setSelectedRowIndexes(nextPreviewRows.map((row) => row.index));
      setSkippedRows(nextSkippedRows);
      if (!nextPreviewRows.length) {
        setErrorMessage("Tidak ada data valid untuk diproses.");
      } else if (nextSkippedRows.length) {
        setErrorMessage(
          "Sebagian baris dilewati. Periksa alasan pada ringkasan preview.",
        );
      }
    } catch (error) {
      console.error("Failed to parse equipment import file:", error);
      setErrorMessage("Gagal membaca file. Pastikan format Excel benar.");
      setPreviewRows([]);
      setSkippedRows([]);
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

  const handleSubmitBulk = async () => {
    if (!selectedRoomId) {
      setErrorMessage("Pilih ruangan terlebih dahulu sebelum import.");
      return;
    }

    if (!previewRows.length || !selectedRowIndexes.length) {
      setErrorMessage("Pilih minimal satu baris valid untuk diproses.");
      return;
    }

    const selectedRows = previewRows
      .filter((row) => selectedRowIndexes.includes(row.index))
      .map((row) => ({
        ...row,
        roomId: selectedRoomId,
      }));

    const bulkResults = await createEquipments(selectedRows, setResults);
    const successCount = bulkResults.filter(
      (row) => row.status === "success",
    ).length;

    if (successCount > 0) {
      onCompleted();
      onOpenChange(false);
      resetState();
      toast.success(`${successCount} peralatan berhasil dibuat.`);
    }
  };

  return (
    <BulkImportDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onReset={resetState}
      title="Bulk Import Peralatan by Ruangan"
      description={
        <>
          Upload file Excel untuk membuat banyak peralatan sekaligus ke satu
          ruangan tertentu. Pilih ruangan, lalu pilih baris yang akan diimport.
        </>
      }
      onDownloadTemplate={handleDownloadTemplate}
      onFileChange={handleFile}
      fileName={fileName}
      isProcessing={isSubmitting}
      onStopProcessing={() => {
        cancelCreateEquipments();
        setErrorMessage("Proses bulk import peralatan dihentikan oleh pengguna.");
      }}
      error={
        errorMessage ? (
          <InlineErrorAlert>{errorMessage}</InlineErrorAlert>
        ) : undefined
      }
      footer={
        <Button
          type="button"
          onClick={() => void handleSubmitBulk()}
          disabled={
            !selectedRoomId ||
            !previewRows.length ||
            !selectedRowIndexes.length ||
            isSubmitting
          }
        >
          {isSubmitting ? "Memproses..." : "Import Peralatan"}
        </Button>
      }
    >
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-700">Ruangan</label>
        <select
          value={selectedRoomId}
          onChange={(e) => setSelectedRoomId(e.target.value)}
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs outline-none focus-visible:border-slate-500 focus-visible:ring-[3px] focus-visible:ring-slate-200"
          disabled={isLoadingRooms}
        >
          <option value="">
            {isLoadingRooms ? "Memuat ruangan..." : "Pilih ruangan"}
          </option>
          {roomOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {roomError ? (
          <p className="text-xs text-destructive">{roomError}</p>
        ) : null}
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
            <table className="w-full min-w-[1100px] text-left text-xs">
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
                  <th className="w-[96px] px-2 py-2 font-medium">Jumlah</th>
                  <th className="w-[180px] px-2 py-2 font-medium">Kategori</th>
                  <th className="w-[110px] px-2 py-2 font-medium">Moveable</th>
                  <th className="w-[110px] px-2 py-2 font-medium">Shareable</th>
                  <th className="w-[110px] px-2 py-2 font-medium">Borrowable</th>
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
                    <td className="px-2 py-2 text-muted-foreground">
                      {row.index}
                    </td>
                    <td className="px-2 py-2">{row.name}</td>
                    <td className="px-2 py-2">{row.quantity}</td>
                    <td className="px-2 py-2">{row.category}</td>
                    <td className="px-2 py-2">
                      {row.isMoveable ? "Ya" : "Tidak"}
                    </td>
                    <td className="px-2 py-2">
                      {row.isShareable ? "Ya" : "Tidak"}
                    </td>
                    <td className="px-2 py-2">
                      {row.isBorrowable ? "Ya" : "Tidak"}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {row.description || "-"}
                    </td>
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
              <p key={`skipped-equipment-byroom-${row.index}`}>
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
