"use client";


import { useEffect, useState } from "react";

import { Eye, HandHelping } from "lucide-react";

import { useRouter, useSearchParams } from "next/navigation";

import { DashboardListTable } from "@/components/dashboard/shared";
import { DataPagination, TableActionIconButton } from "@/components/shared";

import { useEquipments } from "@/hooks/shared/resources/equipments";

const PAGE_SIZE = 20;

const STATUS_STYLES: Record<string, string> = {
  available: "bg-emerald-500/10 text-emerald-600",
  borrowed: "bg-sky-500/10 text-sky-700",
  maintenance: "bg-amber-500/10 text-amber-700",
  broken: "bg-rose-500/10 text-rose-700",
  storage: "bg-slate-500/10 text-slate-600",
};

function formatStatus(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "-";
}

export default function BorrowEquipmentAvailablePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const search = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const room = searchParams.get("room") ?? "";

  useEffect(() => {
    setPage(1);
  }, [search, category, room]);

  const { equipments, totalCount, isLoading, hasLoadedOnce, error } =
    useEquipments(page, PAGE_SIZE, {
      search: search.trim(),
      status: "Available",
      category,
      room,
      is_moveable: "true",
      is_borrowable: "true",
    });

  const totalPages = Math.max(
    1,
    Math.ceil((totalCount || equipments.length) / PAGE_SIZE),
  );

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
          { key: "category", label: "Kategori", className: "w-[160px]" },
          { key: "status", label: "Status", className: "w-[120px]" },
          { key: "quantity", label: "Jumlah", className: "w-[90px]" },
          { key: "room", label: "Ruangan", className: "w-[220px]" },
          {
            key: "actions",
            label: "Aksi",
            className:
              "sticky right-0 z-20 w-[150px] bg-slate-900 text-center shadow-[-1px_0_0_0_rgba(51,65,85,1)]",
          },
        ]}
        colSpan={6}
        hasRows={equipments.length > 0}
        isLoading={isLoading}
        hasLoadedOnce={hasLoadedOnce}
        emptyMessage="Belum ada alat yang tersedia untuk dipinjam."
        tableClassName="min-w-[1020px] table-fixed"
      >
        {equipments.map((item) => (
          <tr key={String(item.id)} className="border-b last:border-b-0">
            <td className="truncate px-3 py-2.5 font-medium text-slate-800">
              {item.name}
            </td>
            <td className="truncate px-3 py-2.5">{item.category}</td>
            <td className="px-3 py-2.5">
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[item.status.toLowerCase()] || "bg-slate-500/10 text-slate-600"}`}
              >
                {formatStatus(item.status)}
              </span>
            </td>
            <td className="truncate px-3 py-2.5">{item.quantity}</td>
            <td className="truncate px-3 py-2.5">{item.roomName}</td>
            <td className="sticky right-0 z-10 bg-white px-3 py-2.5 text-center shadow-[-1px_0_0_0_rgba(226,232,240,1)]">
              <div className="flex justify-center gap-2">
                <TableActionIconButton
                  type="button"
                  label="Lihat detail"
                  icon={<Eye className="h-3.5 w-3.5" />}
                  className="w-8 rounded-md border border-slate-200 bg-slate-50 p-0 text-slate-700 shadow-none hover:bg-slate-100"
                  onClick={() => router.push(`/borrow-equipment/equipment/${item.id}`)}
                />
                <TableActionIconButton
                  type="button"
                  label="Ajukan peminjaman"
                  icon={<HandHelping className="h-3.5 w-3.5" />}
                  className="w-8 rounded-md border border-slate-200 bg-sky-50 p-0 text-sky-700 shadow-none hover:bg-sky-100"
                  onClick={() => router.push(`/borrow-equipment/form?equipment=${item.id}`)}
                />
              </div>
            </td>
          </tr>
        ))}
      </DashboardListTable>

      <DataPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount || equipments.length}
        pageSize={PAGE_SIZE}
        itemLabel="peralatan"
        isLoading={isLoading}
        onPageChange={setPage}
      />
    </section>
  );
}
