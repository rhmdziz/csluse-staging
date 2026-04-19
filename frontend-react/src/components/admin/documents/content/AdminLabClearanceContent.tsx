"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Search,
  User,
  XCircle,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminLabClearance } from "@/hooks/admin/documents";
import { generateLabClearancePdf } from "@/lib/admin/lab-clearance-pdf";
import type { LabClearanceActiveService } from "@/services/admin";

const SERVICE_TYPE_LABEL: Record<string, string> = {
  borrow: "Peminjaman Alat",
  booking: "Peminjaman Lab",
  use: "Penggunaan Alat",
  pengujian: "Pengujian Sampel",
};

const STATUS_COLOR: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800",
  Approved: "bg-blue-100 text-blue-800",
  Borrowed: "bg-purple-100 text-purple-800",
  "Returned Pending Inspection": "bg-orange-100 text-orange-800",
  Overdue: "bg-red-100 text-red-800",
  Diproses: "bg-blue-100 text-blue-800",
  "Menunggu Pembayaran": "bg-yellow-100 text-yellow-800",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

function ServiceRow({ service }: { service: LabClearanceActiveService }) {
  const colorClass = STATUS_COLOR[service.status] ?? "bg-slate-100 text-slate-700";
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-3 pr-4 font-mono text-xs text-slate-600">{service.code}</td>
      <td className="py-3 pr-4 text-sm text-slate-700">
        {SERVICE_TYPE_LABEL[service.type] ?? service.type}
      </td>
      <td className="py-3 pr-4 text-sm text-slate-800">{service.label}</td>
      <td className="py-3 pr-4">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
          {service.status}
        </span>
      </td>
      <td className="py-3 text-sm text-slate-600">{formatDate(service.endTime)}</td>
    </tr>
  );
}

export default function AdminLabClearanceContent() {
  const {
    searchResults,
    isSearching,
    searchError,
    selectedUser,
    clearanceData,
    isChecking,
    checkError,
    searchUsers,
    selectUser,
    reset,
  } = useAdminLabClearance();

  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      setShowDropdown(true);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void searchUsers(val);
      }, 400);
    },
    [searchUsers],
  );

  const handleSelectUser = useCallback(
    (user: (typeof searchResults)[number]) => {
      setQuery(user.name);
      setShowDropdown(false);
      void selectUser(user);
    },
    [selectUser],
  );

  const handleReset = useCallback(() => {
    setQuery("");
    setShowDropdown(false);
    reset();
  }, [reset]);

  const handleGeneratePdf = useCallback(async () => {
    if (!clearanceData) return;
    setIsGenerating(true);
    try {
      await generateLabClearancePdf(clearanceData);
    } finally {
      setIsGenerating(false);
    }
  }, [clearanceData]);

  return (
    <section className="w-full min-w-0 space-y-4 px-4 pb-6">
      <AdminPageHeader
        eyebrow="Dokumen"
        title="Surat Bebas Lab"
        description="Cari mahasiswa atau pengguna untuk mengecek status tanggungan laboratorium dan mencetak surat keterangan bebas tanggungan."
        icon={<FileText className="h-5 w-5 text-white" />}
      />

      {/* Search panel */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-700">Cari Mahasiswa / Pengguna</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Nama, NIM, atau email..."
            value={query}
            onChange={handleQueryChange}
            onFocus={() => setShowDropdown(true)}
            className="pl-9"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
          )}

          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
              {searchResults.map((user) => (
                <button
                  key={String(user.id)}
                  type="button"
                  onClick={() => handleSelectUser(user)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                    <User className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{user.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {user.idNumber !== "-" ? `${user.idNumber} · ` : ""}
                      {user.email} · {user.role}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {searchError && (
          <p className="mt-2 flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3" />
            {searchError}
          </p>
        )}
      </div>

      {/* Result panel */}
      {selectedUser && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* User info card */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                <User className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">{selectedUser.name}</p>
                <p className="text-sm text-slate-500">
                  {selectedUser.idNumber !== "-" ? `${selectedUser.idNumber} · ` : ""}
                  {selectedUser.email}
                </p>
                <p className="text-xs text-slate-400">
                  {selectedUser.role}
                  {selectedUser.department !== "-" ? ` · ${selectedUser.department}` : ""}
                  {selectedUser.batch !== "-" ? ` · Angkatan ${selectedUser.batch}` : ""}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset} className="shrink-0">
              Ganti
            </Button>
          </div>

          {/* Loading state */}
          {isChecking && (
            <div className="flex items-center justify-center gap-2 p-8 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Mengecek tanggungan...</span>
            </div>
          )}

          {/* Error */}
          {!isChecking && checkError && (
            <div className="flex items-center gap-2 p-5 text-red-600">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm">{checkError}</p>
            </div>
          )}

          {/* Clearance result */}
          {!isChecking && clearanceData && (
            <>
              {/* Status badge */}
              <div className="p-5">
                {clearanceData.isClear ? (
                  <div className="flex items-center gap-3 rounded-lg bg-green-50 px-4 py-3">
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
                    <div>
                      <p className="font-semibold text-green-800">Bebas Tanggungan Laboratorium</p>
                      <p className="text-sm text-green-700">
                        Tidak ada layanan aktif yang belum diselesaikan.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg bg-red-50 px-4 py-3">
                    <XCircle className="h-6 w-6 shrink-0 text-red-600" />
                    <div>
                      <p className="font-semibold text-red-800">Masih Ada Tanggungan</p>
                      <p className="text-sm text-red-700">
                        Terdapat {clearanceData.summary.totalActive} layanan aktif yang belum
                        diselesaikan.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Summary chips */}
              {!clearanceData.isClear && (
                <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-3">
                  {clearanceData.summary.borrowCount > 0 && (
                    <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                      Peminjaman Alat: {clearanceData.summary.borrowCount}
                    </span>
                  )}
                  {clearanceData.summary.bookingCount > 0 && (
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                      Peminjaman Lab: {clearanceData.summary.bookingCount}
                    </span>
                  )}
                  {clearanceData.summary.useCount > 0 && (
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">
                      Penggunaan Alat: {clearanceData.summary.useCount}
                    </span>
                  )}
                  {clearanceData.summary.pengujianCount > 0 && (
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
                      Pengujian Sampel: {clearanceData.summary.pengujianCount}
                    </span>
                  )}
                </div>
              )}

              {/* Active services table */}
              {clearanceData.activeServices.length > 0 && (
                <div className="overflow-x-auto border-t border-slate-100">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Kode
                        </th>
                        <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Jenis
                        </th>
                        <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Keterangan
                        </th>
                        <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Status
                        </th>
                        <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Batas Waktu
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 px-4">
                      {clearanceData.activeServices.map((s) => (
                        <tr key={s.id} className="px-4">
                          <td className="px-4 py-3 font-mono text-xs text-slate-600">{s.code}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {SERVICE_TYPE_LABEL[s.type] ?? s.type}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-800">{s.label}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[s.status] ?? "bg-slate-100 text-slate-700"}`}
                            >
                              {s.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {formatDate(s.endTime)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Generate PDF button */}
              <div className="flex justify-end border-t border-slate-100 p-4">
                <Button
                  onClick={() => void handleGeneratePdf()}
                  disabled={isGenerating}
                  className="gap-2"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  {isGenerating ? "Membuat PDF..." : "Generate Surat Bebas Lab"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {!selectedUser && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center">
          <Search className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">Cari mahasiswa untuk memulai</p>
          <p className="mt-1 text-xs text-slate-400">
            Masukkan nama, NIM, atau email di kotak pencarian di atas
          </p>
        </div>
      )}
    </section>
  );
}

export { ServiceRow };
