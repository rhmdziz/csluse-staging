"use client";


import { useEffect, useState } from "react";

import { CalendarPlus2, Eye, Loader2 } from "lucide-react";

import { useRouter, useSearchParams } from "next/navigation";

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

      <div className="w-full max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[920px] table-fixed">
          <thead className="border-b border-slate-800 bg-slate-900">
            <tr className="text-left text-sm">
              <th className="w-[300px] px-3 py-3 font-medium text-slate-50">Nama Ruangan</th>
              <th className="w-[130px] px-3 py-3 font-medium text-slate-50">Nomor</th>
              <th className="w-[100px] px-3 py-3 font-medium text-slate-50">Lantai</th>
              <th className="w-[120px] px-3 py-3 font-medium text-slate-50">Kapasitas</th>
              <th className="w-[120px] px-3 py-3 font-medium text-slate-50">PIC</th>
              {/* <th className="w-[250px] px-3 py-3 font-medium text-slate-50">Deskripsi</th> */}
              <th className="sticky right-0 z-20 w-[150px] bg-slate-900 px-3 py-3 text-center font-medium text-slate-50 shadow-[-1px_0_0_0_rgba(51,65,85,1)]">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {isLoading || !hasLoadedOnce ? (
              <tr>
                <td colSpan={6} className="px-3 py-5 text-center text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat data...
                  </div>
                </td>
              </tr>
            ) : rooms.length ? (
              rooms.map((room) => (
                <tr key={String(room.id)} className="border-b last:border-b-0">
                  <td className="truncate px-3 py-2.5 font-medium text-slate-800">{room.name}</td>
                  <td className="truncate px-3 py-2.5">{room.number}</td>
                  <td className="truncate px-3 py-2.5">{room.floor}</td>
                  <td className="truncate px-3 py-2.5">{room.capacity}</td>
                  <td className="truncate px-3 py-2.5">{room.picName}</td>
                  {/* <td className="truncate px-3 py-2.5">{room.description || "-"}</td> */}
                  <td className="sticky right-0 z-10 bg-white px-3 py-2.5 text-center shadow-[-1px_0_0_0_rgba(226,232,240,1)]">
                    <div className="flex justify-center gap-2">
                      <TableActionIconButton
                        type="button"
                        label="Lihat detail"
                        icon={<Eye className="h-3.5 w-3.5" />}
                        className="w-8 rounded-md border border-slate-200 bg-slate-50 p-0 text-slate-700 shadow-none hover:bg-slate-100"
                        onClick={() => router.push(`/rooms/${room.id}`)}
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
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-3 py-5 text-center text-slate-500">
                  Belum ada ruangan yang tersedia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
