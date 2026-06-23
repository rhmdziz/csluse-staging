"use client";

import { useMemo, useState } from "react";

import * as XLSX from "xlsx";

import { toast } from "sonner";

import { Button } from "@/components/ui";

import { BulkImportDialogShell, InlineErrorAlert } from "@/components/shared";

import { useEquipmentOptions } from "@/hooks/shared/resources/equipments";

import {
  useBulkCreateSoftwares,
  type BulkSoftwareRow,
} from "@/hooks/shared/resources/softwares";

const HEADER_MAP: Record<
  string,
  keyof Pick<
    BulkSoftwareRow,
    "name" | "version" | "licenseInfo" | "licenseExpiration" | "description"
  >
> = {
  nama: "name",
  "nama software": "name",
  name: "name",
  versi: "version",
  version: "version",
  lisensi: "licenseInfo",
  "license info": "licenseInfo",
  expired: "licenseExpiration",
  "license expiration": "licenseExpiration",
  "expired date": "licenseExpiration",
  deskripsi: "description",
  description: "description",
};

type SkippedPreviewRow = {
  index: number;
  reason: string;
};

type SoftwareBulkImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
};

function normalizeDateToISO(value: unknown): string {
  if (!value && value !== 0) return "";

  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const str = String(value).trim();
  if (!str) return "";

  // "perpetual" / "permanen" → no expiration date
  if (/^(perpetual|permanen)$/i.test(str)) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // MM/DD/YYYY (Excel US auto-format)
  const mdyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return str;
}

function normalizeHeader(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buildTemplateWorkbook() {
  const headers = ["nama software", "versi", "lisensi", "expired", "deskripsi"];
  const sample = [
    [
      "MATLAB",
      "R2025a",
      "Campus License",
      "2027-12-31",
      "Software komputasi numerik",
    ],
    ["Visual Studio Code", "1.99", "Free", "", "Editor kode untuk praktikum"],
  ];
  const guideRows = [
    ["Field", "Wajib", "Aturan", "Contoh"],
    ["nama software", "Ya", "Isi nama software.", "MATLAB"],
    ["versi", "Tidak", "Versi software.", "R2025a"],
    ["lisensi", "Tidak", "Informasi lisensi.", "Campus License"],
    ["expired", "Tidak", "Format YYYY-MM-DD.", "2027-12-31"],
    ["deskripsi", "Tidak", "Deskripsi software.", "Software komputasi numerik"],
    [],
    [
      "Catatan",
      "",
      "Peralatan dipilih per baris pada tabel preview sebelum import.",
      "",
    ],
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([headers, ...sample]),
    "Softwares",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(guideRows),
    "Guide",
  );
  return workbook;
}

export default function SoftwareBulkImportDialog({
  open,
  onOpenChange,
  onCompleted,
}: SoftwareBulkImportDialogProps) {
  const [previewRows, setPreviewRows] = useState<BulkSoftwareRow[]>([]);
  const [skippedRows, setSkippedRows] = useState<SkippedPreviewRow[]>([]);
  const [results, setResults] = useState<
    { index: number; status: "success" | "error"; message: string }[]
  >([]);
  const [selectedRowIndexes, setSelectedRowIndexes] = useState<number[]>([]);
  const [rowEquipmentSelections, setRowEquipmentSelections] = useState<
    Record<number, string>
  >({});
  const [fileName, setFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { createSoftwares, cancelCreateSoftwares, isSubmitting } = useBulkCreateSoftwares();
  const {
    equipments,
    isLoading: isLoadingEquipments,
    error: equipmentError,
  } = useEquipmentOptions("", "", open, undefined, "Computer");

  const equipmentOptions = useMemo(
    () => equipments.map((item) => ({ value: item.id, label: item.label })),
    [equipments],
  );

  const resetState = () => {
    setPreviewRows([]);
    setSkippedRows([]);
    setResults([]);
    setSelectedRowIndexes([]);
    setRowEquipmentSelections({});
    setFileName("");
    setErrorMessage("");
  };

  const handleDownloadTemplate = () => {
    XLSX.writeFile(buildTemplateWorkbook(), "template-bulk-softwares.xlsx");
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
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
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

      const headerIndexes: Partial<Record<keyof BulkSoftwareRow, number>> = {};
      headerRow.forEach((header, index) => {
        const mapped = HEADER_MAP[normalizeHeader(header)];
        if (mapped) headerIndexes[mapped] = index;
      });

      const nextPreviewRows: BulkSoftwareRow[] = [];
      const nextSkippedRows: SkippedPreviewRow[] = [];

      bodyRows.forEach((row, index) => {
        const lineNumber = index + 2;
        const name = String(row[headerIndexes.name ?? -1] || "").trim();
        const version = String(row[headerIndexes.version ?? -1] || "").trim();
        const licenseInfo = String(
          row[headerIndexes.licenseInfo ?? -1] || "",
        ).trim();
        const licenseExpiration = normalizeDateToISO(
          row[headerIndexes.licenseExpiration ?? -1] ?? "",
        );
        const description = String(
          row[headerIndexes.description ?? -1] || "",
        ).trim();

        const isCompletelyEmpty =
          !name &&
          !version &&
          !licenseInfo &&
          !licenseExpiration &&
          !description;
        if (isCompletelyEmpty) return;

        const reasons: string[] = [];
        if (!name) reasons.push("nama software wajib diisi");
        if (
          licenseExpiration &&
          !/^\d{4}-\d{2}-\d{2}$/.test(licenseExpiration)
        ) {
          reasons.push("expired harus format YYYY-MM-DD");
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
          version,
          licenseInfo,
          licenseExpiration,
          description,
        });
      });

      setPreviewRows(nextPreviewRows);
      setSelectedRowIndexes(nextPreviewRows.map((row) => row.index));
      setRowEquipmentSelections({});
      setSkippedRows(nextSkippedRows);
      if (!nextPreviewRows.length) {
        setErrorMessage("Tidak ada data valid untuk diproses.");
      } else if (nextSkippedRows.length) {
        setErrorMessage(
          "Sebagian baris dilewati. Periksa alasan pada ringkasan preview.",
        );
      }
    } catch (error) {
      console.error("Failed to parse software import file:", error);
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
    if (!checked) {
      setRowEquipmentSelections((prev) => {
        const next = { ...prev };
        delete next[rowIndex];
        return next;
      });
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
        equipmentId: rowEquipmentSelections[row.index] || "",
      }));

    const rowsWithoutEquipment = selectedRows.filter((row) => !row.equipmentId);
    if (rowsWithoutEquipment.length) {
      setErrorMessage("Semua baris yang dipilih harus memiliki peralatan.");
      return;
    }

    const bulkResults = await createSoftwares(selectedRows, setResults);
    const successCount = bulkResults.filter(
      (row) => row.status === "success",
    ).length;

    if (successCount > 0) {
      onCompleted();
      onOpenChange(false);
      resetState();
      toast.success(`${successCount} software berhasil dibuat.`);
    }
  };

  return (
    <BulkImportDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onReset={resetState}
      title="Bulk Import Software"
      description={
        <>
          Upload file Excel untuk membuat banyak software sekaligus. Pilih baris
          yang akan diimport, lalu assign peralatan per baris.
        </>
      }
      onDownloadTemplate={handleDownloadTemplate}
      onFileChange={handleFile}
      fileName={fileName}
      isProcessing={isSubmitting}
      onStopProcessing={() => {
        cancelCreateSoftwares();
        setErrorMessage("Proses bulk import software dihentikan oleh pengguna.");
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
            !previewRows.length || !selectedRowIndexes.length || isSubmitting
          }
        >
          {isSubmitting ? "Memproses..." : "Import Software"}
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
            <table className="w-full min-w-[1120px] text-left text-xs">
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
                  <th className="w-[280px] px-2 py-2 font-medium">Peralatan</th>
                  <th className="w-[120px] px-2 py-2 font-medium">Versi</th>
                  <th className="w-[160px] px-2 py-2 font-medium">Lisensi</th>
                  <th className="w-[130px] px-2 py-2 font-medium">Expired</th>
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
                    <td className="px-2 py-2">
                      {selectedRowIndexes.includes(row.index) ? (
                        <select
                          value={rowEquipmentSelections[row.index] || ""}
                          onChange={(event) =>
                            setRowEquipmentSelections((prev) => ({
                              ...prev,
                              [row.index]: event.target.value,
                            }))
                          }
                          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs outline-none focus-visible:border-slate-500 focus-visible:ring-[3px] focus-visible:ring-slate-200"
                          disabled={isLoadingEquipments}
                        >
                          <option value="">
                            {isLoadingEquipments
                              ? "Memuat peralatan..."
                              : "Pilih peralatan"}
                          </option>
                          {equipmentOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          Pilih baris untuk assign peralatan
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">{row.version || "-"}</td>
                    <td className="px-2 py-2">{row.licenseInfo || "-"}</td>
                    <td className="px-2 py-2">
                      {row.licenseExpiration || "-"}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {row.description || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {equipmentError ? (
            <p className="text-xs text-destructive">{equipmentError}</p>
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
              <p key={`skipped-software-${row.index}`}>
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
