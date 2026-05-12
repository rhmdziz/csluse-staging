"use client";


import type { RefObject } from "react";

import { Eye, Pencil, Trash2 } from "lucide-react";

import { ConfirmDeleteDialog, TableActionIconButton } from "@/components/shared";
import AdminInventoryTable from "./AdminInventoryTable";

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
    <AdminInventoryTable
      columns={[
        { key: "name", label: "Nama", className: "w-[220px]" },
        { key: "version", label: "Versi", className: "w-[100px]" },
        { key: "license", label: "Lisensi", className: "w-[100px]" },
        { key: "expired", label: "Expired", className: "w-[160px]" },
        { key: "equipment", label: "Peralatan", className: "w-[180px]" },
        { key: "room", label: "Ruangan", className: "w-[200px]" },
        {
          key: "actions",
          label: "Aksi",
          className:
            "sticky right-0 z-10 w-[144px] bg-slate-900 text-center shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.35)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-700",
        },
      ]}
      hasRows={softwares.length > 0}
      isLoading={isLoading}
      hasLoadedOnce={hasLoadedOnce}
      emptyMessage="Tidak ada data software."
      tableClassName="min-w-[1120px]"
      selectAll={{
        ref: selectAllRef,
        checked: allVisibleSelected,
        ariaLabel: "Pilih semua software yang tampil",
        onChange: onToggleSelectAllVisible,
      }}
    >
      {softwares.map((item) => (
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
      ))}
    </AdminInventoryTable>
  );
}
