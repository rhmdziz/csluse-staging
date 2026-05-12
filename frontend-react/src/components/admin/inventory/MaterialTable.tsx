"use client";

import type { RefObject } from "react";

import { Eye, Pencil, Trash2 } from "lucide-react";

import { ConfirmDeleteDialog, TableActionIconButton } from "@/components/shared";
import AdminInventoryTable from "./AdminInventoryTable";

import type { MaterialRow } from "@/hooks/shared/resources/materials";

const STATUS_STYLES: Record<string, string> = {
  available: "bg-emerald-500/10 text-emerald-600",
  "in storage": "bg-slate-500/10 text-slate-600",
  consumed: "bg-amber-500/10 text-amber-700",
  expired: "bg-rose-500/10 text-rose-700",
};

function getStatusStyle(status: string) {
  return STATUS_STYLES[status.trim().toLowerCase()] ?? "bg-muted text-muted-foreground";
}

function formatStatusLabel(status: string) {
  if (!status || status === "-") return "-";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

type MaterialTableProps = {
  materials: MaterialRow[];
  isLoading: boolean;
  hasLoadedOnce: boolean;
  selectedIds: Array<string | number>;
  allVisibleSelected: boolean;
  isDeleting: boolean;
  deleteCandidate: MaterialRow | null;
  selectAllRef: RefObject<HTMLInputElement | null>;
  onToggleSelectAllVisible: (checked: boolean) => void;
  onToggleItemSelection: (material: MaterialRow) => void;
  onOpenDetail: (material: MaterialRow, mode: "view" | "edit") => void;
  onDeleteCandidateChange: (material: MaterialRow | null) => void;
  onDelete: (material: MaterialRow) => void;
};

export default function MaterialTable({
  materials,
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
}: MaterialTableProps) {
  return (
    <AdminInventoryTable
      columns={[
        { key: "name", label: "Nama", className: "w-[220px]" },
        { key: "category", label: "Kategori", className: "w-[170px]" },
        { key: "status", label: "Status", className: "w-[140px]" },
        { key: "quantity", label: "Jumlah", className: "w-[100px]" },
        { key: "unit", label: "Satuan", className: "w-[100px]" },
        { key: "room", label: "Ruangan", className: "w-[220px]" },
        {
          key: "actions",
          label: "Aksi",
          className:
            "sticky right-0 z-10 w-[144px] bg-slate-900 text-center shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.35)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-700",
        },
      ]}
      hasRows={materials.length > 0}
      isLoading={isLoading}
      hasLoadedOnce={hasLoadedOnce}
      emptyMessage="Tidak ada data bahan."
      tableClassName="min-w-[1000px]"
      selectAll={{
        ref: selectAllRef,
        checked: allVisibleSelected,
        ariaLabel: "Pilih semua bahan yang tampil",
        onChange: onToggleSelectAllVisible,
      }}
    >
      {materials.map((item) => (
        <tr key={String(item.id)} className="border-b last:border-b-0">
          <td className="px-3 py-2 text-center align-middle">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 align-middle"
              checked={selectedIds.includes(item.id)}
              onChange={() => onToggleItemSelection(item)}
              aria-label={`Pilih bahan ${item.name}`}
            />
          </td>
          <td className="truncate px-3 py-2 align-middle font-medium">{item.name}</td>
          <td className="truncate px-3 py-2 align-middle text-muted-foreground">{item.category}</td>
          <td className="px-3 py-2 align-middle">
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusStyle(item.status)}`}
            >
              {formatStatusLabel(item.status)}
            </span>
          </td>
          <td className="px-3 py-2 align-middle text-muted-foreground">{item.quantity}</td>
          <td className="px-3 py-2 align-middle text-muted-foreground">{item.unit || "-"}</td>
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
                label="Edit bahan"
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
                title="Hapus bahan?"
                description={`Bahan ${item.name} akan dihapus.`}
                isDeleting={isDeleting}
                onConfirm={() => onDelete(item)}
                trigger={
                  <TableActionIconButton
                    label="Hapus bahan"
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
