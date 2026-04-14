"use client";


import type { RefObject } from "react";

import { Eye, Loader2, Pencil, Trash2 } from "lucide-react";

import { ConfirmDeleteDialog, TableActionIconButton } from "@/components/shared";

import type { SoftwareRow } from "@/hooks/shared/resources/softwares";

type SoftwareTableProps = {
  softwares: SoftwareRow[];
  isLoading: boolean;
  hasLoadedOnce: boolean;
  selectedIds: Array<string | number>;
  allVisibleSelected: boolean;
  isDeleting: boolean;
  deleteCandidate: SoftwareRow | null;
  selectAllRef: RefObject<HTMLInputElement | null>;
  onToggleSelectAllVisible: (checked: boolean) => void;
  onToggleItemSelection: (software: SoftwareRow) => void;
  onOpenDetail: (software: SoftwareRow, mode: "view" | "edit") => void;
  onDeleteCandidateChange: (software: SoftwareRow | null) => void;
  onDelete: (software: SoftwareRow) => void;
};

export default function SoftwareTable({
  softwares,
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
  onDeleteCandidateChange,
  onDelete,
}: SoftwareTableProps) {
  return (
    <div className="w-full min-w-0 overflow-x-auto rounded border border-slate-200 bg-card [scrollbar-width:thin]">
      <table className="w-full min-w-[1120px] table-fixed">
        <thead className="border-b border-slate-800 bg-slate-900">
          <tr className="text-left text-sm">
            <th className="w-12 px-3 py-3 text-center font-medium text-slate-50">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 align-middle"
                checked={allVisibleSelected}
                onChange={(event) => onToggleSelectAllVisible(event.target.checked)}
                aria-label="Pilih semua software yang tampil"
              />
            </th>
            <th className="w-[220px] px-3 py-3 font-medium text-slate-50">Nama</th>
            <th className="w-[100px] px-3 py-3 font-medium text-slate-50">Versi</th>
            <th className="w-[100px] px-3 py-3 font-medium text-slate-50">Lisensi</th>
            <th className="w-[160px] px-3 py-3 font-medium text-slate-50">Expired</th>
            <th className="w-[180px] px-3 py-3 font-medium text-slate-50">Peralatan</th>
            <th className="w-[200px] px-3 py-3 font-medium text-slate-50">Ruangan</th>
            <th className="sticky right-0 z-10 relative w-[144px] bg-slate-900 px-3 py-3 text-center font-medium text-slate-50 shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.35)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-700">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {isLoading || !hasLoadedOnce ? (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              </td>
            </tr>
          ) : softwares.length ? (
            softwares.map((item) => (
              <tr key={String(item.id)} className="border-b last:border-b-0">
                <td className="px-3 py-2 text-center align-middle">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 align-middle"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => onToggleItemSelection(item)}
                    aria-label={`Pilih software ${item.name}`}
                  />
                </td>
                <td className="truncate px-3 py-2 align-middle font-medium">{item.name}</td>
                <td className="px-3 py-2 align-middle text-muted-foreground">{item.version || "-"}</td>
                <td className="truncate px-3 py-2 align-middle text-muted-foreground">{item.licenseInfo || "-"}</td>
                <td className="px-3 py-2 align-middle text-muted-foreground">{item.licenseExpiration || "-"}</td>
                <td className="truncate px-3 py-2 align-middle text-muted-foreground">{item.equipmentName}</td>
                <td className="truncate px-3 py-2 align-middle text-muted-foreground">
                  {item.roomName}
                  {item.roomNumber && (
                    <span className="ml-1 text-xs text-slate-400">({item.roomNumber})</span>
                  )}
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
                      label="Edit software"
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
                      title="Hapus software?"
                      description={`Software ${item.name} akan dihapus.`}
                      isDeleting={isDeleting}
                      onConfirm={() => onDelete(item)}
                      trigger={
                        <TableActionIconButton
                          label="Hapus software"
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
              <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                Tidak ada data software.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
