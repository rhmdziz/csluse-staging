"use client";


import { useEffect, useMemo, useState } from "react";

import { Boxes, Loader2 } from "lucide-react";

import { AdminDetailDialogShell, DataPagination, InlineErrorAlert } from "@/components/shared";
import { DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE_OPTIONS } from "@/constants/pagination";

import { useEquipments } from "@/hooks/shared/resources/equipments";

type RoomEquipmentsDialogProps = {
  roomId: string | number | null;
  roomName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function RoomEquipmentsDialog({
  roomId,
  roomName,
  open,
  onOpenChange,
}: RoomEquipmentsDialogProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    if (open) {
      setPage(1);
    }
  }, [open, roomId]);

  const { equipments, totalCount, isLoading, hasLoadedOnce, error } = useEquipments(
    page,
    pageSize,
    { room: roomId ? String(roomId) : "" },
    0,
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((totalCount || equipments.length) / pageSize)),
    [equipments.length, pageSize, totalCount],
  );

  return (
    <AdminDetailDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Peralatan Ruangan"
      description={`Daftar peralatan yang terhubung dengan ${roomName || "ruangan ini"}.`}
      icon={<Boxes className="h-5 w-5" />}
      contentClassName="w-[min(960px,calc(100%-2rem))] max-w-none gap-0 p-0 sm:max-w-none"
    >
      <div className="space-y-4 px-5 py-4 sm:px-6">
        {error ? <InlineErrorAlert>{error}</InlineErrorAlert> : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[720px] table-fixed bg-white">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr className="text-left text-sm">
                <th className="w-[220px] px-4 py-3 font-medium text-slate-900">Nama Alat</th>
                <th className="w-[140px] px-4 py-3 font-medium text-slate-900">Kategori</th>
                <th className="w-[120px] px-4 py-3 font-medium text-slate-900">Status</th>
                <th className="w-[100px] px-4 py-3 font-medium text-slate-900">Jumlah</th>
                <th className="px-4 py-3 font-medium text-slate-900">Deskripsi</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {isLoading || !hasLoadedOnce ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memuat peralatan...
                    </div>
                  </td>
                </tr>
              ) : equipments.length ? (
                equipments.map((equipment) => (
                  <tr key={String(equipment.id)} className="border-b last:border-b-0">
                    <td className="px-4 py-3 font-medium text-slate-900">{equipment.name}</td>
                    <td className="px-4 py-3 text-slate-600">{equipment.category}</td>
                    <td className="px-4 py-3 text-slate-600">{equipment.status}</td>
                    <td className="px-4 py-3 text-slate-600">{equipment.quantity}</td>
                    <td className="px-4 py-3 text-slate-600">{equipment.description || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    Belum ada peralatan pada ruangan ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <DataPagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          itemLabel="peralatan"
          isLoading={isLoading}
          onPageChange={setPage}
          pageSizeOptions={[...DEFAULT_PAGE_SIZE_OPTIONS]}
          onPageSizeChange={(nextPageSize) => {
            setPage(1);
            setPageSize(nextPageSize);
          }}
        />
      </div>
    </AdminDetailDialogShell>
  );
}
