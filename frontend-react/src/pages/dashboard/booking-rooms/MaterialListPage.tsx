"use client";

import { useEffect, useState } from "react";

import { Eye, Loader2 } from "lucide-react";

import { useRouter, useSearchParams } from "next/navigation";

import { DataPagination, TableActionIconButton } from "@/components/shared";

import { useMaterials } from "@/hooks/shared/resources/materials";

const PAGE_SIZE = 20;

const STATUS_STYLES: Record<string, string> = {
  available: "bg-emerald-500/10 text-emerald-600",
  "in storage": "bg-slate-500/10 text-slate-600",
  consumed: "bg-amber-500/10 text-amber-700",
  expired: "bg-rose-500/10 text-rose-700",
};

function formatStatus(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "-";
}

export default function MaterialListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const search = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const category = searchParams.get("category") ?? "";
  const room = searchParams.get("room") ?? "";

  useEffect(() => {
    setPage(1);
  }, [search, status, category, room]);

  const { materials, totalCount, isLoading, hasLoadedOnce, error } = useMaterials(page, PAGE_SIZE, {
    search: search.trim(),
    status,
    category,
    room,
  });

  const totalPages = Math.max(1, Math.ceil((totalCount || materials.length) / PAGE_SIZE));

  return (
    <section className="space-y-4">
      {error ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="w-full max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1020px] table-fixed">
          <thead className="border-b border-slate-800 bg-slate-900">
            <tr className="text-left text-sm">
              <th className="w-[180px] px-3 py-3 font-medium text-slate-50">Nama</th>
              <th className="w-[140px] px-3 py-3 font-medium text-slate-50">Kategori</th>
              <th className="w-[120px] px-3 py-3 font-medium text-slate-50">Status</th>
              <th className="w-[280px] px-3 py-3 font-medium text-slate-50">Ruangan</th>
              <th className="sticky right-0 z-20 w-[100px] bg-slate-900 px-3 py-3 text-center font-medium text-slate-50 shadow-[-1px_0_0_0_rgba(51,65,85,1)]">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {isLoading || !hasLoadedOnce ? (
              <tr>
                <td colSpan={5} className="px-3 py-5 text-center text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat data...
                  </div>
                </td>
              </tr>
            ) : materials.length ? (
              materials.map((item) => (
                <tr key={String(item.id)} className="border-b last:border-b-0">
                  <td className="truncate px-3 py-2.5 font-medium text-slate-800">{item.name}</td>
                  <td className="truncate px-3 py-2.5">{item.category}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[item.status?.toLowerCase()] || "bg-slate-500/10 text-slate-600"}`}
                    >
                      {formatStatus(item.status)}
                    </span>
                  </td>
                  <td className="truncate px-3 py-2.5">
                    {item.roomName}
                    {item.roomNumber && (
                      <span className="ml-1 text-xs text-slate-400">({item.roomNumber})</span>
                    )}
                  </td>
                  <td className="sticky right-0 z-10 bg-white px-3 py-2.5 text-center shadow-[-1px_0_0_0_rgba(226,232,240,1)]">
                    <TableActionIconButton
                      type="button"
                      label="Lihat detail"
                      icon={<Eye className="h-3.5 w-3.5" />}
                      className="w-8 rounded-md border border-slate-200 bg-slate-50 p-0 text-slate-700 shadow-none hover:bg-slate-100"
                      onClick={() => router.push(`/booking-rooms/materials/${item.id}`)}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-3 py-5 text-center text-slate-500">
                  Belum ada bahan yang tersedia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <DataPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount || materials.length}
        pageSize={PAGE_SIZE}
        itemLabel="bahan"
        isLoading={isLoading}
        onPageChange={setPage}
      />
    </section>
  );
}
