"use client";

import type { RefObject } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";

import { TableActionIconButton } from "@/components/shared";
import { getUserInitials, type UserRow } from "@/hooks/shared/resources/users";
import type { UserDetailMode } from "@/components/admin/user-management";

type TaskTableUserRow = UserRow & {
  roomNames?: string[];
};

type MentorTaskTableProps = {
  users: TaskTableUserRow[];
  isLoading: boolean;
  hasLoadedOnce: boolean;
  selectedIds: Array<number | string>;
  allVisibleSelected: boolean;
  onToggleItemSelection: (id: number | string) => void;
  onToggleSelectAllVisible: (checked: boolean) => void;
  selectAllRef: RefObject<HTMLInputElement | null>;
  onOpenDetail: (user: TaskTableUserRow, mode: UserDetailMode) => void;
  onEdit?: (user: TaskTableUserRow) => void;
  onDelete: (user: TaskTableUserRow) => void;
  isDeleting: boolean;
  selectionLabel?: string;
  removeLabel?: string;
  emptyMessage?: string;
  roomHeader?: string;
  getRoomLabel?: (user: TaskTableUserRow) => string;
  secondaryHeader?: string;
  getSecondaryLabel?: (user: TaskTableUserRow) => string;
};

export default function MentorTaskTable({
  users,
  isLoading,
  hasLoadedOnce,
  selectedIds,
  allVisibleSelected,
  onToggleItemSelection,
  onToggleSelectAllVisible,
  selectAllRef,
  onOpenDetail,
  onEdit,
  onDelete,
  isDeleting,
  selectionLabel = "user",
  removeLabel = "Hapus item",
  emptyMessage = "Tidak ada data terdaftar.",
  roomHeader = "Department",
  getRoomLabel,
  secondaryHeader = "ID Number",
  getSecondaryLabel,
}: MentorTaskTableProps) {
  return (
    <div className="w-full max-w-full overflow-x-auto rounded border border-slate-200 bg-card">
      <table className="w-full min-w-[820px] table-fixed">
        <thead className="border-b border-slate-800 bg-slate-900">
          <tr className="text-left text-sm">
            <th className="w-[52px] px-3 py-3 text-center align-middle font-medium text-slate-50">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 align-middle"
                checked={allVisibleSelected}
                onChange={(event) => onToggleSelectAllVisible(event.target.checked)}
                aria-label={`Pilih semua ${selectionLabel} yang tampil`}
              />
            </th>
            <th className="w-[72px] px-3 py-3 font-medium text-slate-50">Inisial</th>
            <th className="w-[220px] px-3 py-3 font-medium text-slate-50">Nama</th>
            <th className="w-[260px] px-3 py-3 font-medium text-slate-50">Email</th>
            <th className="w-[220px] px-3 py-3 font-medium text-slate-50">{roomHeader}</th>
            <th className="w-[140px] px-3 py-3 font-medium text-slate-50">{secondaryHeader}</th>
            <th className="sticky right-0 z-10 relative w-36 bg-slate-900 px-3 py-3 text-center font-medium text-slate-50 shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.35)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-700">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {isLoading || !hasLoadedOnce ? (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                </div>
              </td>
            </tr>
          ) : users.length ? (
            users.map((user) => (
              <tr key={String(user.uid)} className="border-b last:border-b-0">
                <td className="px-3 py-2 text-center align-middle">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 align-middle"
                    checked={selectedIds.includes(user.id)}
                    onChange={() => onToggleItemSelection(user.id)}
                    aria-label={`Pilih ${selectionLabel} ${user.name || user.email}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase">
                    {getUserInitials(user)}
                  </div>
                </td>
                <td className="truncate px-3 py-2">{user.name}</td>
                <td className="truncate px-3 py-2 text-muted-foreground">{user.email}</td>
                <td className="px-3 py-2">{getRoomLabel ? getRoomLabel(user) : user.department}</td>
                <td className="px-3 py-2">{getSecondaryLabel ? getSecondaryLabel(user) : user.idNumber}</td>
                <td className="sticky right-0 z-10 relative bg-card px-3 py-2 shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.18)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200">
                  <div className="flex justify-center gap-2">
                    <TableActionIconButton
                      label="Lihat detail"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => onOpenDetail(user, "view")}
                      icon={<Eye className="h-4 w-4" />}
                    />
                    {onEdit && (
                      <TableActionIconButton
                        label="Edit ruangan"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => onEdit(user)}
                        icon={<Pencil className="h-4 w-4" />}
                      />
                    )}
                    <TableActionIconButton
                      label={removeLabel}
                      variant="outline"
                      size="icon-sm"
                      disabled={isDeleting}
                      onClick={() => onDelete(user)}
                      icon={<Trash2 className="h-4 w-4 text-destructive" />}
                    />
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
