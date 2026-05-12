"use client";


import type { RefObject } from "react";

import { Eye, Pencil, Trash2 } from "lucide-react";

import { ConfirmDeleteDialog, TableActionIconButton } from "@/components/shared";
import AdminInventoryTable from "./AdminInventoryTable";

import type { EquipmentRow } from "@/hooks/shared/resources/equipments";

type EquipmentTableProps = {
  equipments: EquipmentRow[];
  isLoading: boolean;
  hasLoadedOnce: boolean;
  selectedIds: Array<string | number>;
  allVisibleSelected: boolean;
  isDeleting: boolean;
  deleteCandidate: EquipmentRow | null;
  statusStyles: Record<string, string>;
  formatStatus: (value: string) => string;
  togglingEquipmentId?: string | number | null;
  selectAllRef: RefObject<HTMLInputElement | null>;
  onToggleSelectAllVisible: (checked: boolean) => void;
  onToggleItemSelection: (equipment: EquipmentRow) => void;
  onToggleAvailability: (equipment: EquipmentRow, nextChecked: boolean) => void;
  onOpenDetail: (equipment: EquipmentRow, mode: "view" | "edit") => void;
  onDeleteCandidateChange: (equipment: EquipmentRow | null) => void;
  onDelete: (equipment: EquipmentRow) => void;
};

export default function EquipmentTable({
  equipments,
  isLoading,
  hasLoadedOnce,
  selectedIds,
  allVisibleSelected,
  isDeleting,
  deleteCandidate,
  statusStyles,
  formatStatus,
  togglingEquipmentId,
  selectAllRef,
  onToggleSelectAllVisible,
  onToggleItemSelection,
  onToggleAvailability,
  onOpenDetail,
  onDeleteCandidateChange,
  onDelete,
}: EquipmentTableProps) {
  const isAvailable = (status: string) => status.trim().toLowerCase() === "available";

  return (
    <AdminInventoryTable
      columns={[
        { key: "name", label: "Nama", className: "w-[220px]" },
        { key: "category", label: "Kategori", className: "w-[180px]" },
        { key: "status", label: "Status", className: "w-[150px]" },
        { key: "quantity", label: "Jumlah", className: "w-[120px]" },
        { key: "room", label: "Ruangan", className: "w-[230px]" },
        { key: "moveable", label: "Moveable", className: "w-[120px]" },
        { key: "shareable", label: "Shareable", className: "w-[120px]" },
        { key: "borrowable", label: "Borrowable", className: "w-[120px]" },
        {
          key: "actions",
          label: "Aksi",
          className:
            "sticky right-0 z-10 w-[144px] bg-slate-900 text-center shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.35)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-700",
        },
      ]}
      hasRows={equipments.length > 0}
      isLoading={isLoading}
      hasLoadedOnce={hasLoadedOnce}
      emptyMessage="Tidak ada data peralatan."
      tableClassName="min-w-[1160px]"
      selectAll={{
        ref: selectAllRef,
        checked: allVisibleSelected,
        ariaLabel: "Pilih semua peralatan yang tampil",
        onChange: onToggleSelectAllVisible,
      }}
    >
      {equipments.map((item) => (
        <tr key={String(item.id)} className="border-b last:border-b-0">
          <td className="px-3 py-2 text-center align-middle">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 align-middle"
              checked={selectedIds.includes(item.id)}
              onChange={() => onToggleItemSelection(item)}
              aria-label={`Pilih peralatan ${item.name}`}
            />
          </td>
          <td className="truncate px-3 py-2 align-middle font-medium">{item.name}</td>
          <td className="truncate px-3 py-2 align-middle text-muted-foreground">{item.category}</td>
          <td className="px-3 py-2 align-middle">
            <label className="inline-flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={isAvailable(item.status)}
                aria-label={`Ubah status available untuk ${item.name}`}
                onClick={() => onToggleAvailability(item, !isAvailable(item.status))}
                disabled={String(togglingEquipmentId ?? "") === String(item.id)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  isAvailable(item.status) ? "bg-emerald-500" : "bg-slate-300"
                } ${
                  String(togglingEquipmentId ?? "") === String(item.id)
                    ? "cursor-not-allowed opacity-60"
                    : ""
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                    isAvailable(item.status) ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusStyles[item.status] || "bg-muted text-muted-foreground"}`}
              >
                {formatStatus(item.status)}
              </span>
            </label>
          </td>
          <td className="px-3 py-2 align-middle text-muted-foreground">{item.quantity}</td>
          <td className="truncate px-3 py-2 align-middle text-muted-foreground">
            {item.roomName}
            {item.roomNumber && (
              <span className="ml-1 text-xs text-slate-400">({item.roomNumber})</span>
            )}
          </td>
          <td className="px-3 py-2 align-middle text-muted-foreground">
            {item.isMoveable ? "Ya" : "Tidak"}
          </td>
          <td className="px-3 py-2 align-middle text-muted-foreground">
            {item.isShareable ? "Ya" : "Tidak"}
          </td>
          <td className="px-3 py-2 align-middle text-muted-foreground">
            {item.isBorrowable ? "Ya" : "Tidak"}
          </td>
          <td className="sticky right-0 z-10 bg-card px-3 py-2 align-middle shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.18)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200">
            <div className="flex justify-center gap-2">
              <TableActionIconButton
                label="Lihat detail"
                variant="outline"
                size="icon-sm"
                onClick={() => onOpenDetail(item, "view")}
                icon={<Eye className="h-4 w-4" />}
              />
              <TableActionIconButton
                label="Edit peralatan"
                variant="outline"
                size="icon-sm"
                onClick={() => onOpenDetail(item, "edit")}
                icon={<Pencil className="h-4 w-4" />}
              />
              <ConfirmDeleteDialog
                open={deleteCandidate?.id === item.id}
                onOpenChange={(open) => onDeleteCandidateChange(open ? item : null)}
                size="sm"
                headerClassName="place-items-start text-left"
                footerClassName="sm:justify-start"
                title="Hapus peralatan?"
                description={`Peralatan ${item.name} akan dihapus.`}
                isDeleting={isDeleting}
                onConfirm={() => onDelete(item)}
                trigger={
                  <TableActionIconButton
                    label="Hapus peralatan"
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
