"use client";


import { useEffect, useState } from "react";

import { CalendarPlus2, Eye } from "lucide-react";

import { useRouter, useSearchParams } from "next/navigation";

import { DashboardListTable } from "@/components/dashboard/shared";
import { DataPagination, TableActionIconButton } from "@/components/shared";

import { useRooms } from "@/hooks/shared/resources/rooms";

const PAGE_SIZE = 10;

export default function RoomsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const search = searchParams.get("q") ?? "";
  const floor = searchParams.get("floor") ?? "";

  useEffect(() => {
    setPage(1);
  }, [search, floor]);

  const { rooms, totalCount, isLoading, hasLoadedOnce, error } = useRooms(page, PAGE_SIZE, {
    search: search.trim(),
    floor,
  });

  const totalPages = Math.max(1, Math.ceil((totalCount || rooms.length) / PAGE_SIZE));

  return (
    <section className="space-y-4">
      {error ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <DashboardListTable
        columns={[
          { key: "name", label: "Nama Ruangan", className: "w-[300px]" },
          { key: "number", label: "Nomor", className: "w-[130px]" },
          { key: "floor", label: "Lantai", className: "w-[100px]" },
          { key: "capacity", label: "Kapasitas", className: "w-[120px]" },
          { key: "pic", label: "PIC", className: "w-[120px]" },
          {
            key: "actions",
            label: "Aksi",
            className:
              "sticky right-0 z-20 w-[150px] bg-slate-900 text-center shadow-[-1px_0_0_0_rgba(51,65,85,1)]",
          },
        ]}
        colSpan={6}
        hasRows={rooms.length > 0}
        isLoading={isLoading}
        hasLoadedOnce={hasLoadedOnce}
        emptyMessage="Belum ada ruangan yang tersedia."
        tableClassName="min-w-[920px] table-fixed"
      >
        {rooms.map((room) => (
          <tr key={String(room.id)} className="border-b last:border-b-0">
            <td className="truncate px-3 py-2.5 font-medium text-slate-800">{room.name}</td>
            <td className="truncate px-3 py-2.5">{room.number}</td>
            <td className="truncate px-3 py-2.5">{room.floor}</td>
            <td className="truncate px-3 py-2.5">{room.capacity}</td>
            <td className="truncate px-3 py-2.5">{room.picName}</td>
            <td className="sticky right-0 z-10 bg-white px-3 py-2.5 text-center shadow-[-1px_0_0_0_rgba(226,232,240,1)]">
              <div className="flex justify-center gap-2">
                <TableActionIconButton
                  type="button"
                  label="Lihat detail"
                  icon={<Eye className="h-3.5 w-3.5" />}
                  className="w-8 rounded-md border border-slate-200 bg-slate-50 p-0 text-slate-700 shadow-none hover:bg-slate-100"
                  onClick={() => router.push(`/booking-rooms/rooms/${room.id}`)}
                />
                <TableActionIconButton
                  type="button"
                  label="Ajukan peminjaman lab"
                  icon={<CalendarPlus2 className="h-3.5 w-3.5" />}
                  className="w-8 rounded-md border border-slate-200 bg-sky-50 p-0 text-sky-700 shadow-none hover:bg-sky-100"
                  onClick={() => router.push(`/booking-rooms/form?room=${room.id}`)}
                />
              </div>
            </td>
          </tr>
        ))}
      </DashboardListTable>

      <DataPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount || rooms.length}
        pageSize={PAGE_SIZE}
        itemLabel="ruangan"
        isLoading={isLoading}
        onPageChange={setPage}
      />
    </section>
  );
}
