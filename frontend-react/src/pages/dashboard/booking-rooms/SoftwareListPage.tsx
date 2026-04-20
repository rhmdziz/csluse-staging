"use client";

import { useEffect, useState } from "react";

import { Loader2 } from "lucide-react";

import { useRouter, useSearchParams } from "next/navigation";

import { DataPagination } from "@/components/shared";

import { useSoftwares } from "@/hooks/shared/resources/softwares";

const PAGE_SIZE = 20;

export default function SoftwareListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const search = searchParams.get("q") ?? "";
  const equipment = searchParams.get("equipment") ?? "";
  const room = searchParams.get("room") ?? "";

  useEffect(() => {
    setPage(1);
  }, [search, equipment, room]);

  const { softwares, totalCount, isLoading, hasLoadedOnce, error } = useSoftwares(page, PAGE_SIZE, {
    search: search.trim(),
    equipment,
    room,
  });

  const totalPages = Math.max(1, Math.ceil((totalCount || softwares.length) / PAGE_SIZE));

  return (
    <section className="space-y-4">
      {error ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="w-full max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[980px] table-fixed">
          <thead className="border-b border-slate-800 bg-slate-900">
            <tr className="text-left text-sm">
              <th className="w-[220px] px-3 py-3 font-medium text-slate-50">Nama</th>
              <th className="w-[100px] px-3 py-3 font-medium text-slate-50">Versi</th>
              <th className="w-[220px] px-3 py-3 font-medium text-slate-50">Peralatan</th>
              <th className="w-[220px] px-3 py-3 font-medium text-slate-50">Ruangan</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {isLoading || !hasLoadedOnce ? (
              <tr>
                <td colSpan={4} className="px-3 py-5 text-center text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat data...
                  </div>
                </td>
              </tr>
            ) : softwares.length ? (
              softwares.map((item) => (
                <tr key={String(item.id)} className="border-b last:border-b-0">
                  <td className="truncate px-3 py-2.5 font-medium text-slate-800">{item.name}</td>
                  <td className="truncate px-3 py-2.5">{item.version || "-"}</td>
                  <td className="truncate px-3 py-2.5">{item.equipmentName}</td>
                  <td className="truncate px-3 py-2.5">
                    {item.roomName}
                    {item.roomNumber && (
                      <span className="ml-1 text-xs text-slate-400">({item.roomNumber})</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-5 text-center text-slate-500">
                  Belum ada software yang tersedia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <DataPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount || softwares.length}
        pageSize={PAGE_SIZE}
        itemLabel="software"
        isLoading={isLoading}
        onPageChange={setPage}
      />
    </section>
  );
}
