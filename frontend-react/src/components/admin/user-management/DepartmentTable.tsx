"use client";

import type { RefObject } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { TableActionIconButton } from "@/components/shared";
import AdminUserManagementTable from "./AdminUserManagementTable";
import type { DepartmentRow } from "@/hooks/shared/resources/departments";
import { formatDateTimeId } from "@/lib/date";

type DepartmentTableProps = {
  departments: DepartmentRow[];
  isLoading: boolean;
  hasLoadedOnce: boolean;
  selectedIds: Array<string | number>;
  allVisibleSelected: boolean;
  isDeleting: boolean;
  selectAllRef: RefObject<HTMLInputElement | null>;
  onToggleSelectAllVisible: (checked: boolean) => void;
  onToggleItemSelection: (department: DepartmentRow) => void;
  onOpenDetail: (department: DepartmentRow, mode: "view" | "edit") => void;
  onDelete: (department: DepartmentRow) => void;
};

export default function DepartmentTable({
  departments,
  isLoading,
  hasLoadedOnce,
  selectedIds,
  allVisibleSelected,
  isDeleting,
  selectAllRef,
  onToggleSelectAllVisible,
  onToggleItemSelection,
  onOpenDetail,
  onDelete,
}: DepartmentTableProps) {
  return (
    <AdminUserManagementTable
      columns={[
        { key: "name", label: "Department", className: "w-[320px]" },
        { key: "profiles", label: "Dipakai Profile", className: "w-[160px]" },
        { key: "updated", label: "Diperbarui", className: "w-[180px]" },
        {
          key: "actions",
          label: "Aksi",
          className:
            "sticky right-0 z-10 w-[144px] bg-slate-900 text-center shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.35)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-700",
        },
      ]}
      hasRows={departments.length > 0}
      isLoading={isLoading}
      hasLoadedOnce={hasLoadedOnce}
      emptyMessage="Tidak ada department."
      tableClassName="min-w-[820px]"
      loadingIndicator={
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
      }
      selectAll={{
        ref: selectAllRef,
        checked: allVisibleSelected,
        ariaLabel: "Pilih semua department yang tampil",
        onChange: onToggleSelectAllVisible,
      }}
    >
      {departments.map((department) => (
        <tr key={department.id} className="border-b last:border-b-0">
          <td className="px-3 py-2 text-center align-middle">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 align-middle"
              checked={selectedIds.includes(department.id)}
              onChange={() => onToggleItemSelection(department)}
              aria-label={`Pilih department ${department.name}`}
            />
          </td>
          <td className="px-3 py-2 align-middle font-medium text-slate-900">
            {department.name}
          </td>
          <td className="px-3 py-2 align-middle">
            <span className="inline-flex items-center rounded-full bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-700">
              {department.profileCount} profile
            </span>
          </td>
          <td className="px-3 py-2 align-middle text-muted-foreground">
            {department.updatedAt ? formatDateTimeId(department.updatedAt) : "-"}
          </td>
          <td className="sticky right-0 z-10 bg-card px-3 py-2 align-middle shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.18)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200">
            <div className="flex justify-center gap-2">
              <TableActionIconButton
                label="Lihat detail department"
                variant="outline"
                size="icon-sm"
                onClick={() => onOpenDetail(department, "view")}
                icon={<Eye className="h-4 w-4" />}
              />
              <TableActionIconButton
                label="Edit department"
                variant="outline"
                size="icon-sm"
                disabled={isDeleting}
                onClick={() => onOpenDetail(department, "edit")}
                icon={<Pencil className="h-4 w-4" />}
              />
              <TableActionIconButton
                label="Hapus department"
                variant="outline"
                size="icon-sm"
                disabled={isDeleting}
                onClick={() => onDelete(department)}
                icon={<Trash2 className="h-4 w-4 text-destructive" />}
              />
            </div>
          </td>
        </tr>
      ))}
    </AdminUserManagementTable>
  );
}
