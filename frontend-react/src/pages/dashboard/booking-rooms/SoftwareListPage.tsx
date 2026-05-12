"use client";

import { useEffect, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { DashboardListTable } from "@/components/dashboard/shared";
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

      <DashboardListTable
        columns={[
          { key: "name", label: "Nama", className: "w-[220px]" },
          { key: "version", label: "Versi", className: "w-[100px]" },
          { key: "equipment", label: "Peralatan", className: "w-[220px]" },
          { key: "room", label: "Ruangan", className: "w-[220px]" },
        ]}
        colSpan={4}
        hasRows={softwares.length > 0}
        isLoading={isLoading}
        hasLoadedOnce={hasLoadedOnce}
        emptyMessage="Belum ada software yang tersedia."
        tableClassName="min-w-[980px] table-fixed"
      >
        {softwares.map((item) => (
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
        ))}
      </DashboardListTable>

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
