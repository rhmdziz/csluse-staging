"use client";


import type { RefObject } from "react";

import { Boxes, Eye, Pencil, Trash2 } from "lucide-react";

import { ConfirmDeleteDialog, TableActionIconButton } from "@/components/shared";
import AdminInventoryTable from "./AdminInventoryTable";

import type { RoomRow } from "@/hooks/shared/resources/rooms";

type RoomTableProps = {
  rooms: RoomRow[];
  isLoading: boolean;
  hasLoadedOnce: boolean;
  selectedIds: Array<string | number>;
  allVisibleSelected: boolean;
  isDeleting: boolean;
  deleteCandidate: RoomRow | null;
  selectAllRef: RefObject<HTMLInputElement | null>;
  onToggleSelectAllVisible: (checked: boolean) => void;
  onToggleItemSelection: (room: RoomRow) => void;
  onOpenDetail: (room: RoomRow, mode: "view" | "edit") => void;
  onOpenEquipments: (room: RoomRow) => void;
  onDeleteCandidateChange: (room: RoomRow | null) => void;
  onDelete: (room: RoomRow) => void;
};

export default function RoomTable({
  rooms,
  isLoading,
  hasLoadedOnce,
  selectedIds,
  allVisibleSelected,
  isDeleting,
  deleteCandidate,
  selectAllRef,
  onToggleSelectAllVisible,
  onToggleItemSelection,
  onOpenDetail,
  onOpenEquipments,
  onDeleteCandidateChange,
  onDelete,
}: RoomTableProps) {
  return (
    <AdminInventoryTable
      columns={[
        { key: "name", label: "Nama", className: "w-[270px]" },
        { key: "number", label: "Nomor", className: "w-[84px]" },
        { key: "floor", label: "Lantai", className: "w-[84px]" },
        { key: "capacity", label: "Kapasitas", className: "w-[84px]" },
        { key: "description", label: "Deskripsi", className: "w-[230px]" },
        { key: "pic", label: "PIC", className: "w-[230px]" },
        {
          key: "actions",
          label: "Aksi",
          className:
            "sticky right-0 z-10 w-[188px] bg-slate-900 text-center shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.35)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-700",
        },
      ]}
      hasRows={rooms.length > 0}
      isLoading={isLoading}
      hasLoadedOnce={hasLoadedOnce}
      emptyMessage="Tidak ada data ruangan."
      tableClassName="min-w-[1160px]"
      selectAll={{
        ref: selectAllRef,
        checked: allVisibleSelected,
        ariaLabel: "Pilih semua ruangan yang tampil",
        onChange: onToggleSelectAllVisible,
      }}
    >
      {rooms.map((room) => (
        <tr key={String(room.id)} className="border-b last:border-b-0">
          <td className="px-3 py-2 text-center align-middle">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 align-middle"
              checked={selectedIds.includes(room.id)}
              onChange={() => onToggleItemSelection(room)}
              aria-label={`Pilih ruangan ${room.name}`}
            />
          </td>
          <td className="truncate px-3 py-2 align-middle font-medium">{room.name}</td>
          <td className="truncate px-3 py-2 align-middle text-muted-foreground">{room.number}</td>
          <td className="px-3 py-2 align-middle text-muted-foreground">{room.floor}</td>
          <td className="px-3 py-2 align-middle text-muted-foreground">{room.capacity}</td>
          <td className="px-3 py-2">
            <div className="whitespace-normal wrap-break-word text-muted-foreground">
              {room.description || "-"}
            </div>
          </td>
          <td className="truncate px-3 py-2 align-middle text-muted-foreground">{room.picName}</td>
          <td className="sticky right-0 z-10 bg-card px-3 py-2 align-middle shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.18)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200">
            <div className="flex justify-center gap-2">
              <TableActionIconButton
                label="Lihat detail"
                variant="outline"
                size="icon-sm"
                onClick={() => onOpenDetail(room, "view")}
                icon={<Eye className="h-4 w-4" />}
              />
              <TableActionIconButton
                label="Lihat peralatan"
                variant="outline"
                size="icon-sm"
                onClick={() => onOpenEquipments(room)}
                icon={<Boxes className="h-4 w-4" />}
              />
              <TableActionIconButton
                label="Edit ruangan"
                variant="outline"
                size="icon-sm"
                onClick={() => onOpenDetail(room, "edit")}
                icon={<Pencil className="h-4 w-4" />}
              />
              <ConfirmDeleteDialog
                open={deleteCandidate?.id === room.id}
                onOpenChange={(open) => onDeleteCandidateChange(open ? room : null)}
                size="sm"
                headerClassName="place-items-start text-left"
                footerClassName="sm:justify-start"
                title="Hapus ruangan?"
                description={`Ruangan ${room.name} akan dihapus.`}
                isDeleting={isDeleting}
                onConfirm={() => onDelete(room)}
                trigger={
                  <TableActionIconButton
                    label="Hapus ruangan"
                    variant="outline"
                    size="icon-sm"
                    disabled={isDeleting}
                    icon={<Trash2 className="h-4 w-4 text-destructive" />}
                  />
                }
              />
            </div>
          </td>
        </tr>
      ))}
    </AdminInventoryTable>
  );
}
