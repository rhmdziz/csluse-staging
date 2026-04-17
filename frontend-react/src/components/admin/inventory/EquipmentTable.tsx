"use client";


import type { RefObject } from "react";

import { Eye, Loader2, Pencil, Trash2 } from "lucide-react";

import { ConfirmDeleteDialog, TableActionIconButton } from "@/components/shared";

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
    <div className="w-full min-w-0 overflow-x-auto rounded border border-slate-200 bg-card [scrollbar-width:thin]">
      <table className="w-full min-w-[1160px] table-fixed">
        <thead className="border-b border-slate-800 bg-slate-900">
          <tr className="text-left text-sm">
            <th className="w-12 px-3 py-3 text-center font-medium text-slate-50">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 align-middle"
                checked={allVisibleSelected}
                onChange={(event) => onToggleSelectAllVisible(event.target.checked)}
                aria-label="Pilih semua peralatan yang tampil"
              />
            </th>
            <th className="w-[220px] px-3 py-3 font-medium text-slate-50">Nama</th>
            <th className="w-[180px] px-3 py-3 font-medium text-slate-50">Kategori</th>
            <th className="w-[150px] px-3 py-3 font-medium text-slate-50">Status</th>
            <th className="w-[120px] px-3 py-3 font-medium text-slate-50">Jumlah</th>
            <th className="w-[230px] px-3 py-3 font-medium text-slate-50">Ruangan</th>
            <th className="w-[120px] px-3 py-3 font-medium text-slate-50">Moveable</th>
            <th className="w-[120px] px-3 py-3 font-medium text-slate-50">Shareable</th>
            <th className="w-[120px] px-3 py-3 font-medium text-slate-50">Borrowable</th>
            <th className="w-[120px] px-3 py-3 font-medium text-slate-50">Useable</th>
            <th className="sticky right-0 z-10 relative w-[144px] bg-slate-900 px-3 py-3 text-center font-medium text-slate-50 shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.35)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-700">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {isLoading || !hasLoadedOnce ? (
            <tr>
              <td colSpan={10} className="px-3 py-8 text-center">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              </td>
            </tr>
          ) : equipments.length ? (
            equipments.map((item) => (
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
                <td className="px-3 py-2 align-middle text-muted-foreground">
                  {item.isUseable ? "Ya" : "Tidak"}
                </td>
                <td className="sticky right-0 z-10 relative bg-card px-3 py-2 align-middle shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.18)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200">
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
            ))
          ) : (
            <tr>
              <td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">
                Tidak ada data peralatan.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
