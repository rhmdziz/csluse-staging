"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { BulkImportDialogShell, InlineErrorAlert } from "@/components/shared";
import { BATCH_MAX_YEAR, BATCH_MIN_YEAR, isValidBatchValue } from "@/constants/batches";
import { ROLE_LABELS, ROLE_VALUES, normalizeRoleValue } from "@/constants/roles";
import { useDepartmentOptions } from "@/hooks/shared/resources/departments";
import { useBulkCreateUsers, useDeleteUser, type BulkRow } from "@/hooks/shared/resources/users";
import {
  USER_MODAL_WIDTH_CLASS,
  getVisibleUserFields,
  requiresUserPassword,
} from "@/components/admin/user-management";

const HEADER_MAP: Record<
  string,
  keyof Pick<
    BulkRow,
    "full_name" | "email" | "password" | "role" | "initials" | "department" | "batch" | "id_number" | "institution"
  >
> = {
  "nama lengkap": "full_name",
  nama: "full_name",
  "full name": "full_name",
  fullname: "full_name",
  email: "email",
  password: "password",
  inisial: "initials",
  initials: "initials",
  role: "role",
  department: "department",
  departemen: "department",
  batch: "batch",
  "id number": "id_number",
  idnumber: "id_number",
  "nomor identitas": "id_number",
  institution: "institution",
  institusi: "institution",
};

type BulkMode = "create" | "delete";

type SkippedPreviewRow = {
  index: number;
  reason: string;
};

type DeletePreviewRow = {
  index: number;
  email: string;
};

type ProcessResult = {
  index: number;
  email: string;
  status: "success" | "error";
  message: string;
};

type BulkCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleParam: string | null;
  onCompleted: () => void;
};

function normalizeHeader(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeDepartmentSpacing(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeDepartmentLookup(value: unknown) {
  return normalizeDepartmentSpacing(value).toLowerCase();
}

function buildCreateTemplateWorkbook(
  hasRoleScope: boolean,
  scopedRole: string,
  departmentNames: string[],
) {
  const sampleDepartment = departmentNames[0] ?? "";
  const headers = [
    "nama lengkap",
    "email",
    "password",
    ...(hasRoleScope ? [] : ["role"]),
    "initials",
    "department",
    "batch",
    "id number",
    "institution",
  ];
  const sample = [
    [
      "Aziz Rahmad",
      "aziz@student.prasetiyamulya.ac.id",
      "",
      ...(hasRoleScope ? [] : [ROLE_VALUES.STUDENT]),
      "AZR",
      sampleDepartment,
      "2024",
      "12345678",
      "",
    ],
    [
      "Dina Guest",
      "dina.guest@example.com",
      "Password123",
      ...(hasRoleScope ? [] : [ROLE_VALUES.GUEST]),
      "DGT",
      "",
      "",
      "",
      "PT Contoh Institusi",
    ],
  ];
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  const guideRows = [
    ["Field", "Wajib", "Aturan", "Contoh"],
    ["nama lengkap", "Ya", "Isi nama lengkap user.", "Aziz Rahmad"],
    ["email", "Ya", "Gunakan email unik yang valid.", "aziz@student.prasetiyamulya.ac.id"],
    [
      "password",
      "Kondisional",
      "Wajib untuk email non-domain kampus. Boleh kosong untuk email domain kampus yang akan login via Microsoft.",
      "Password123",
    ],
    [
      "role",
      hasRoleScope ? "Tidak" : "Ya",
      hasRoleScope
        ? `Akan otomatis diisi sebagai ${scopedRole} karena halaman sedang difilter role.`
        : "Pilih salah satu: Student, Lecturer, Admin, Staff, Guest.",
      hasRoleScope ? "-" : ROLE_VALUES.STUDENT,
    ],
    ["initials", "Tidak", "Maksimal 3 karakter. Jika kosong akan digenerate otomatis.", "AZR"],
    [
      "department",
      "Tidak",
      departmentNames.length
        ? `Hanya dipakai untuk Student, Lecturer, atau Admin. Nilainya harus cocok dengan master department di sistem: ${departmentNames.join(", ")}. Huruf besar/kecil diabaikan dan spasi berlebih akan dirapikan. Kosongkan untuk Staff atau Guest.`
        : "Hanya dipakai untuk Student, Lecturer, atau Admin. Nilainya harus cocok dengan master department di sistem. Huruf besar/kecil diabaikan dan spasi berlebih akan dirapikan. Kosongkan untuk Staff atau Guest.",
      sampleDepartment,
    ],
    [
      "batch",
      "Tidak",
      `Umumnya dipakai untuk Student. Gunakan tahun 4 digit antara ${BATCH_MIN_YEAR} sampai ${BATCH_MAX_YEAR}.`,
      "2024",
    ],
    ["id number", "Tidak", "Dipakai untuk role yang memerlukan nomor identitas.", "12345678"],
    ["institution", "Tidak", "Dipakai untuk role Guest.", "PT Contoh Institusi"],
    [],
    ["Catatan", "", "Upload harus memakai sheet pertama 'Users'. Sheet ini hanya panduan.", ""],
  ];
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Users");
  XLSX.utils.book_append_sheet(workbook, guideSheet, "Guide");
  return workbook;
}

function buildDeleteTemplateWorkbook() {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["email"],
    ["user1@example.com"],
    ["user2@student.prasetiyamulya.ac.id"],
  ]);
  const guideSheet = XLSX.utils.aoa_to_sheet([
    ["Field", "Wajib", "Aturan", "Contoh"],
    ["email", "Ya", "Isi email user yang ingin dihapus. Satu baris untuk satu email.", "user1@example.com"],
    [],
    ["Catatan", "", "Upload harus memakai sheet pertama 'Users'. Sheet ini hanya panduan.", ""],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Users");
  XLSX.utils.book_append_sheet(workbook, guideSheet, "Guide");
  return workbook;
}

export default function BulkCreateDialog({
  open,
  onOpenChange,
  roleParam,
  onCompleted,
}: BulkCreateDialogProps) {
  const normalizedRoleParam = normalizeRoleValue(roleParam);
  const hasRoleScope = Boolean(normalizedRoleParam);
  const scopedRoleLabel =
    normalizedRoleParam && normalizedRoleParam in ROLE_LABELS
      ? ROLE_LABELS[normalizedRoleParam as keyof typeof ROLE_LABELS]
      : "";

  const { departmentNames } = useDepartmentOptions();
  const { createUsers, cancelCreateUsers, isSubmitting: isCreating } = useBulkCreateUsers();
  const {
    deleteUsersByIdentifiers,
    isDeleting,
    errorMessage: deleteErrorMessage,
    setErrorMessage: setDeleteErrorMessage,
  } = useDeleteUser();

  const [mode, setMode] = useState<BulkMode>("create");
  const [createPreviewRows, setCreatePreviewRows] = useState<BulkRow[]>([]);
  const [deletePreviewRows, setDeletePreviewRows] = useState<DeletePreviewRow[]>([]);
  const [skippedRows, setSkippedRows] = useState<SkippedPreviewRow[]>([]);
  const [selectedRowIndexes, setSelectedRowIndexes] = useState<number[]>([]);
  const [fileName, setFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [results, setResults] = useState<ProcessResult[]>([]);

  const isProcessing = mode === "create" ? isCreating : isDeleting;
  const previewRows = mode === "create" ? createPreviewRows : deletePreviewRows;
  const successCount = results.filter((row) => row.status === "success").length;
  const failedCount = results.filter((row) => row.status === "error").length;
  const allRowsSelected =
    previewRows.length > 0 && selectedRowIndexes.length === previewRows.length;

  const resolvedTitle = scopedRoleLabel
    ? `Bulk Kelola ${scopedRoleLabel}`
    : "Bulk Kelola Akun/Profile";
  const resolvedSubmitLabel =
    mode === "create"
      ? scopedRoleLabel
        ? `Buat ${scopedRoleLabel}`
        : "Buat Akun/Profile"
      : scopedRoleLabel
        ? `Hapus ${scopedRoleLabel}`
        : "Hapus Akun/Profile";
  const resolvedProcessingLabel =
    mode === "create" ? "Sedang memproses bulk tambah user." : "Sedang memproses bulk hapus user.";

  const resolvedDescription =
    mode === "create" ? (
      <>
        Upload file Excel dengan kolom wajib: nama lengkap, email
        {hasRoleScope ? "." : ", role."} Password wajib untuk email non-domain kampus. Kolom opsional: initials,
        department, batch, id number, institution.
      </>
    ) : (
      <>
        Upload file Excel yang berisi kolom <strong>email</strong> untuk menghapus user secara bulk. Satu baris
        mewakili satu email user yang akan dihapus.
      </>
    );

  const resetState = () => {
    setCreatePreviewRows([]);
    setDeletePreviewRows([]);
    setSkippedRows([]);
    setSelectedRowIndexes([]);
    setFileName("");
    setErrorMessage("");
    setDeleteErrorMessage("");
    setResults([]);
  };

  const switchMode = (nextMode: BulkMode) => {
    if (mode === nextMode) return;
    setMode(nextMode);
    resetState();
  };

  const toggleAllRows = (checked: boolean) => {
    setSelectedRowIndexes(checked ? previewRows.map((row) => row.index) : []);
  };

  const toggleRowSelection = (rowIndex: number, checked: boolean) => {
    setSelectedRowIndexes((prev) =>
      checked ? [...prev, rowIndex] : prev.filter((item) => item !== rowIndex),
    );
  };

  const handleCreateFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      setErrorMessage("File tidak memiliki sheet.");
      setCreatePreviewRows([]);
      setSkippedRows([]);
      return;
    }

    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
    const [headerRow, ...bodyRows] = raw;
    if (!headerRow || headerRow.length === 0) {
      setErrorMessage("Header tidak ditemukan pada file.");
      setCreatePreviewRows([]);
      setSkippedRows([]);
      return;
    }

    const headerIndexes: Partial<Record<keyof BulkRow, number>> = {};
    headerRow.forEach((header, index) => {
      const mapped = HEADER_MAP[normalizeHeader(header)];
      if (mapped) headerIndexes[mapped] = index;
    });

    const departmentLookup = new Map(
      departmentNames.map((departmentName) => [
        normalizeDepartmentLookup(departmentName),
        departmentName,
      ]),
    );

    const nextPreviewRows: BulkRow[] = [];
    const nextSkippedRows: SkippedPreviewRow[] = [];

    bodyRows.forEach((row, index) => {
      const lineNumber = index + 2;
      const rawRole = normalizeRoleValue(String(row[headerIndexes.role ?? -1] || "").trim());
      const normalizedRole = normalizedRoleParam || rawRole;
      const full_name = String(row[headerIndexes.full_name ?? -1] || "").trim();
      const email = String(row[headerIndexes.email ?? -1] || "").trim();
      const password = String(row[headerIndexes.password ?? -1] || "").trim();
      const requiresPassword = requiresUserPassword({
        email,
        role: normalizedRole,
      });
      const visibleFields = getVisibleUserFields(normalizedRole);
      const initials = String(row[headerIndexes.initials ?? -1] || "")
        .trim()
        .slice(0, 3);
      const rawDepartment = visibleFields.department
        ? String(row[headerIndexes.department ?? -1] || "")
        : "";
      const normalizedDepartment = normalizeDepartmentSpacing(rawDepartment);
      const department =
        visibleFields.department && normalizedDepartment
          ? (departmentLookup.get(normalizeDepartmentLookup(normalizedDepartment)) ??
            normalizedDepartment)
          : "";
      const batch = visibleFields.batch
        ? String(row[headerIndexes.batch ?? -1] || "").trim()
        : "";
      const id_number = visibleFields.idNumber
        ? String(row[headerIndexes.id_number ?? -1] || "").trim()
        : "";
      const institution = visibleFields.institution
        ? String(row[headerIndexes.institution ?? -1] || "").trim()
        : "";

      const isCompletelyEmpty =
        !full_name &&
        !email &&
        !password &&
        !rawRole &&
        !initials &&
        !department &&
        !batch &&
        !id_number &&
        !institution;

      if (isCompletelyEmpty) {
        return;
      }

      const reasons: string[] = [];
      if (!full_name) reasons.push("nama lengkap wajib diisi");
      if (!email) reasons.push("email wajib diisi");
      if (!hasRoleScope && !normalizedRole) reasons.push("role wajib diisi");
      if (!hasRoleScope && rawRole && !normalizedRole) reasons.push("role tidak valid");
      if (requiresPassword && !password) reasons.push("password wajib diisi untuk guest");
      if (
        normalizedDepartment &&
        departmentLookup.size > 0 &&
        !departmentLookup.has(normalizeDepartmentLookup(normalizedDepartment))
      ) {
        reasons.push("department tidak sesuai opsi");
      }
      if (batch && !isValidBatchValue(batch)) {
        reasons.push("batch harus berupa tahun 4 digit yang valid");
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
        full_name,
        email,
        password,
        role: normalizedRole,
        is_mentor: false,
        initials,
        department,
        batch,
        id_number,
        institution,
      });
    });

    setCreatePreviewRows(nextPreviewRows);
    setDeletePreviewRows([]);
    setSelectedRowIndexes(nextPreviewRows.map((row) => row.index));
    setSkippedRows(nextSkippedRows);

    if (!nextPreviewRows.length) {
      setErrorMessage("Tidak ada data valid untuk diproses.");
    } else if (nextSkippedRows.length) {
      setErrorMessage("Sebagian baris dilewati. Periksa alasan pada ringkasan preview.");
    }
  };

  const handleDeleteFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      setErrorMessage("File tidak memiliki sheet.");
      setDeletePreviewRows([]);
      setSkippedRows([]);
      return;
    }

    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
    const [headerRow, ...bodyRows] = raw;
    if (!headerRow || headerRow.length === 0) {
      setErrorMessage("Header tidak ditemukan pada file.");
      setDeletePreviewRows([]);
      setSkippedRows([]);
      return;
    }

    const emailColumnIndex = headerRow.findIndex(
      (header) => HEADER_MAP[normalizeHeader(header)] === "email",
    );

    if (emailColumnIndex < 0) {
      setErrorMessage("Kolom email wajib ada pada file.");
      setDeletePreviewRows([]);
      setSkippedRows([]);
      return;
    }

    const nextPreviewRows: DeletePreviewRow[] = [];
    const nextSkippedRows: SkippedPreviewRow[] = [];
    const seenEmails = new Set<string>();

    bodyRows.forEach((row, index) => {
      const lineNumber = index + 2;
      const email = String(row[emailColumnIndex] || "").trim().toLowerCase();
      const isCompletelyEmpty = row.every((cell) => !String(cell || "").trim());

      if (isCompletelyEmpty) {
        return;
      }

      if (!email) {
        nextSkippedRows.push({
          index: lineNumber,
          reason: "email wajib diisi",
        });
        return;
      }

      if (seenEmails.has(email)) {
        nextSkippedRows.push({
          index: lineNumber,
          reason: "email duplikat pada file",
        });
        return;
      }

      seenEmails.add(email);
      nextPreviewRows.push({
        index: lineNumber,
        email,
      });
    });

    setCreatePreviewRows([]);
    setDeletePreviewRows(nextPreviewRows);
    setSelectedRowIndexes(nextPreviewRows.map((row) => row.index));
    setSkippedRows(nextSkippedRows);

    if (!nextPreviewRows.length) {
      setErrorMessage("Tidak ada email valid untuk diproses.");
    } else if (nextSkippedRows.length) {
      setErrorMessage("Sebagian baris dilewati. Periksa alasan pada ringkasan preview.");
    }
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setErrorMessage("");
    setDeleteErrorMessage("");
    setResults([]);

    if (!file) {
      setCreatePreviewRows([]);
      setDeletePreviewRows([]);
      setSkippedRows([]);
      setFileName("");
      return;
    }

    setFileName(file.name);

    try {
      if (mode === "create") {
        await handleCreateFile(file);
      } else {
        await handleDeleteFile(file);
      }
    } catch (error) {
      console.error("Failed to parse file:", error);
      setErrorMessage("Gagal membaca file. Pastikan format Excel benar.");
      setCreatePreviewRows([]);
      setDeletePreviewRows([]);
      setSkippedRows([]);
    }
  };

  const handleDownloadTemplate = () => {
    if (mode === "create") {
      XLSX.writeFile(
        buildCreateTemplateWorkbook(hasRoleScope, normalizedRoleParam, departmentNames),
        "template-bulk-user.xlsx",
      );
      return;
    }

    XLSX.writeFile(buildDeleteTemplateWorkbook(), "template-bulk-delete-user.xlsx");
  };

  const handleSubmitBulk = async () => {
    if (!previewRows.length || !selectedRowIndexes.length) {
      setErrorMessage("Pilih minimal satu baris valid untuk diproses.");
      return;
    }

    setErrorMessage("");
    setDeleteErrorMessage("");

    if (mode === "create") {
      const selectedRows = createPreviewRows.filter((row) =>
        selectedRowIndexes.includes(row.index),
      );
      const bulkResults = await createUsers(selectedRows, setResults);
      const nextSuccessCount = bulkResults.filter((row) => row.status === "success").length;
      const failedRowIndexes = bulkResults
        .filter((row) => row.status === "error")
        .map((row) => row.index);

      setSelectedRowIndexes(failedRowIndexes);

      if (nextSuccessCount > 0) {
        onCompleted();
        toast.success(
          scopedRoleLabel
            ? `${nextSuccessCount} ${scopedRoleLabel.toLowerCase()} berhasil dibuat.`
            : `${nextSuccessCount} akun/profile berhasil dibuat.`,
        );
      }
      return;
    }

    const selectedRows = deletePreviewRows.filter((row) =>
      selectedRowIndexes.includes(row.index),
    );
    const result = await deleteUsersByIdentifiers(selectedRows.map((row) => row.email));

    const failedIdentifierSet = new Set((result.failedIds ?? []).map((item) => String(item).toLowerCase()));
    const deletedIdentifierSet = new Set((result.deletedIds ?? []).map((item) => String(item).toLowerCase()));

    const nextResults: ProcessResult[] = selectedRows.map((row) => ({
      index: row.index,
      email: row.email,
      status:
        !result.ok && deletedIdentifierSet.size === 0
          ? "error"
          : failedIdentifierSet.has(row.email)
            ? "error"
            : "success",
      message:
        !result.ok && deletedIdentifierSet.size === 0
          ? result.message || "Gagal menghapus akun/profile."
          : failedIdentifierSet.has(row.email)
            ? "User tidak ditemukan atau gagal dihapus."
            : "Sukses",
    }));

    setResults(nextResults);
    setSelectedRowIndexes(
      selectedRows
        .filter((row) => failedIdentifierSet.has(row.email))
        .map((row) => row.index),
    );

    if (!result.ok && result.deletedCount === 0) {
      setErrorMessage(result.message || deleteErrorMessage || "Gagal menghapus akun/profile.");
      return;
    }

    if ((result.deletedCount ?? 0) > 0) {
      onCompleted();
      if ((result.failedCount ?? 0) > 0) {
        toast.warning(
          `${result.deletedCount ?? 0} akun/profile berhasil dihapus, ${result.failedCount ?? 0} gagal.`,
        );
      } else {
        toast.success(`${result.deletedCount ?? 0} akun/profile berhasil dihapus.`);
      }
    }
  };

  const renderPreviewTable = () => {
    if (!previewRows.length) return null;

    if (mode === "delete") {
      return (
        <div className="min-w-0 space-y-2 rounded-md border p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
              Valid: {deletePreviewRows.length}
            </span>
            <span className="rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-700">
              Dipilih: {selectedRowIndexes.length}
            </span>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-700">
              Dilewati: {skippedRows.length}
            </span>
          </div>
          <div className="max-h-80 w-full min-w-0 max-w-full overflow-x-auto overflow-y-auto rounded-md border">
            <table className="w-full min-w-[420px] text-left text-xs">
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
                  <th className="px-2 py-2 font-medium">Email</th>
                </tr>
              </thead>
              <tbody>
                {deletePreviewRows.map((row) => (
                  <tr key={row.index} className="border-t">
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={selectedRowIndexes.includes(row.index)}
                        onChange={(event) => toggleRowSelection(row.index, event.target.checked)}
                        aria-label={`Pilih baris ${row.index}`}
                      />
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{row.index}</td>
                    <td className="px-2 py-2 text-muted-foreground">{row.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div className="min-w-0 space-y-2 rounded-md border p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
            Valid: {createPreviewRows.length}
          </span>
          <span className="rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-700">
            Dipilih: {selectedRowIndexes.length}
          </span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-700">
            Dilewati: {skippedRows.length}
          </span>
        </div>
        <div className="max-h-80 w-full min-w-0 max-w-full overflow-x-auto overflow-y-auto rounded-md border">
          <table className="w-full min-w-[1020px] text-left text-xs">
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
                <th className="px-2 py-2 font-medium">Email</th>
                <th className="w-[80px] px-2 py-2 font-medium">Inisial</th>
                <th className="px-2 py-2 font-medium">Password</th>
                <th className="w-[96px] px-2 py-2 font-medium">Role</th>
                <th className="px-2 py-2 font-medium">Department</th>
                <th className="w-[96px] px-2 py-2 font-medium">Batch</th>
                <th className="px-2 py-2 font-medium">ID Number</th>
                <th className="px-2 py-2 font-medium">Institusi</th>
              </tr>
            </thead>
            <tbody>
              {createPreviewRows.map((row) => (
                <tr key={row.index} className="border-t">
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={selectedRowIndexes.includes(row.index)}
                      onChange={(event) => toggleRowSelection(row.index, event.target.checked)}
                      aria-label={`Pilih baris ${row.index}`}
                    />
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">{row.index}</td>
                  <td className="px-2 py-2">{row.full_name}</td>
                  <td className="px-2 py-2 text-muted-foreground">{row.email}</td>
                  <td className="px-2 py-2">{row.initials || "-"}</td>
                  <td className="px-2 py-2">
                    {requiresUserPassword({ email: row.email, role: row.role })
                      ? row.password || "-"
                      : "-"}
                  </td>
                  <td className="px-2 py-2">{row.role || "-"}</td>
                  <td className="px-2 py-2">{row.department || "-"}</td>
                  <td className="px-2 py-2">{row.batch || "-"}</td>
                  <td className="px-2 py-2">{row.id_number || "-"}</td>
                  <td className="px-2 py-2">{row.institution || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <BulkImportDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onReset={resetState}
      title={resolvedTitle}
      description={resolvedDescription}
      topContent={
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={mode === "create" ? "default" : "outline"}
            size="sm"
            onClick={() => switchMode("create")}
            disabled={isProcessing}
          >
            Tambah
          </Button>
          <Button
            type="button"
            variant={mode === "delete" ? "default" : "outline"}
            size="sm"
            onClick={() => switchMode("delete")}
            disabled={isProcessing}
          >
            Hapus
          </Button>
        </div>
      }
      onDownloadTemplate={handleDownloadTemplate}
      onFileChange={handleFile}
      fileName={fileName}
      isProcessing={isProcessing}
      processingLabel={resolvedProcessingLabel}
      onStopProcessing={() => {
        if (mode === "create") {
          cancelCreateUsers();
          setErrorMessage("Proses bulk import dihentikan oleh pengguna.");
          return;
        }
        setErrorMessage("Proses bulk hapus sedang berjalan dan tidak bisa dihentikan di tengah proses.");
      }}
      error={
        errorMessage || deleteErrorMessage ? (
          <InlineErrorAlert>{errorMessage || deleteErrorMessage}</InlineErrorAlert>
        ) : undefined
      }
      contentClassName={USER_MODAL_WIDTH_CLASS}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmitBulk()}
            disabled={!previewRows.length || !selectedRowIndexes.length || isProcessing}
          >
            {isProcessing ? "Memproses..." : resolvedSubmitLabel}
          </Button>
        </>
      }
    >
      {renderPreviewTable()}

      {skippedRows.length ? (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-xs font-medium text-amber-800">Baris dilewati: {skippedRows.length}</p>
          <div className="max-h-40 space-y-1 overflow-y-auto text-xs text-amber-900">
            {skippedRows.map((row) => (
              <p key={`skipped-${row.index}`}>
                Baris {row.index}: {row.reason}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {results.length || isProcessing ? (
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <p className="font-medium">Hasil proses</p>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
              Sukses: {successCount}
            </span>
            <span className="rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-700">
              Gagal: {failedCount}
            </span>
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto text-xs">
            {results.map((row) => (
              <div
                key={`${row.index}-${row.email}-${row.status}`}
                className={
                  row.status === "success"
                    ? "rounded-md border border-emerald-200 bg-emerald-50/70 px-2 py-1.5 text-emerald-800"
                    : "rounded-md border border-rose-200 bg-rose-50/70 px-2 py-1.5 text-rose-800"
                }
              >
                <p className="font-medium">
                  Baris {row.index}: {row.email}
                </p>
                <p>{row.message}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </BulkImportDialogShell>
  );
}
