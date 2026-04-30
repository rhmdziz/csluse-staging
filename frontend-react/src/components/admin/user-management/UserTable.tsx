"use client";

import type { RefObject } from "react";
import {
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";

import { TableActionIconButton } from "@/components/shared";
import { USER_TYPE_VALUES } from "@/constants/user-types";
import { getUserInitials, type UserRow } from "@/hooks/shared/resources/users";
import { formatDateTimeId } from "@/lib/date";
import type { UserDetailMode } from "@/components/admin/user-management";

type UserTableProps = {
  users: UserRow[];
  isLoading: boolean;
  hasLoadedOnce: boolean;
  canManageUsers: boolean;
  isRoleScoped: boolean;
  columnCount: number;
  selectedIds: Array<number | string>;
  allVisibleSelected: boolean;
  onToggleItemSelection: (id: number | string) => void;
  onToggleSelectAllVisible: (checked: boolean) => void;
  onOpenDetail: (user: UserRow, mode: UserDetailMode) => void;
  onDelete: (user: UserRow) => void;
  isDeleting: boolean;
  selectAllRef: RefObject<HTMLInputElement | null>;
};

function getUserStatusPresentation(user: UserRow) {
  const isGuest = String(user.role).trim().toLowerCase() === "guest";

  if (isGuest && !user.isVerified) {
    return {
      label: "Belum dikonfirmasi",
      className: "bg-amber-500/10 text-amber-700",
    };
  }

  if (user.lastLogin) {
    return {
      label: "Sudah Login",
      className: "bg-emerald-500/10 text-emerald-700",
    };
  }

  return {
    label: "Belum Login",
    className: "bg-slate-500/10 text-slate-700",
  };
}

export default function UserTable({
  users,
  isLoading,
  hasLoadedOnce,
  canManageUsers,
  isRoleScoped,
  columnCount,
  selectedIds,
  allVisibleSelected,
  onToggleItemSelection,
  onToggleSelectAllVisible,
  onOpenDetail,
  onDelete,
  isDeleting,
  selectAllRef,
}: UserTableProps) {
  return (
    <div className="w-full max-w-full overflow-x-auto rounded border border-slate-200 bg-card">
      <table className="w-full min-w-[980px] table-fixed">
        <thead className="border-b border-slate-800 bg-slate-900">
          <tr className="text-left text-sm">
            {canManageUsers ? (
              <th className="w-[52px] px-3 py-3 text-center align-middle font-medium text-slate-50">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 align-middle"
                  checked={allVisibleSelected}
                  onChange={(event) => onToggleSelectAllVisible(event.target.checked)}
                  aria-label="Pilih semua akun atau profile yang tampil"
                />
              </th>
            ) : null}
            <th className="w-[72px] px-3 py-3 font-medium text-slate-50">Inisial</th>
            <th className="w-[180px] px-3 py-3 font-medium text-slate-50">Nama</th>
            <th className="w-[240px] px-3 py-3 font-medium text-slate-50">Email</th>
            {!isRoleScoped ? (
              <th className="w-[120px] px-3 py-3 font-medium text-slate-50">Role</th>
            ) : null}
            <th className="w-[140px] px-3 py-3 text-center font-medium text-slate-50">
              Status
            </th>
            <th className="w-[140px] px-3 py-3 font-medium text-slate-50">User Type</th>
            <th className="w-[180px] px-3 py-3 font-medium text-slate-50">Last Login</th>
            <th className="sticky right-0 z-10 relative w-[144px] bg-slate-900 px-3 py-3 text-center font-medium text-slate-50 shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.35)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-700">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {isLoading || !hasLoadedOnce ? (
            <tr>
              <td colSpan={columnCount} className="px-3 py-8 text-center">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                </div>
              </td>
            </tr>
          ) : users.length ? (
            users.map((user) => {
              const status = getUserStatusPresentation(user);

              return (
                <tr key={String(user.uid)} className="border-b last:border-b-0">
                  {canManageUsers ? (
                    <td className="px-3 py-2 text-center align-middle">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 align-middle"
                        checked={selectedIds.includes(user.id)}
                        onChange={() => onToggleItemSelection(user.id)}
                        aria-label={`Pilih akun atau profile ${user.name || user.email}`}
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase">
                      {getUserInitials(user)}
                    </div>
                  </td>
                  <td className="truncate px-3 py-2">{user.name}</td>
                  <td className="truncate px-3 py-2 text-muted-foreground">{user.email}</td>
                  {!isRoleScoped ? <td className="px-3 py-2">{user.role}</td> : null}
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        user.userType === USER_TYPE_VALUES.INTERNAL
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-sky-500/10 text-sky-700"
                      }`}
                    >
                      {user.userType}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {user.lastLogin ? formatDateTimeId(user.lastLogin) : "-"}
                  </td>
                  <td className="sticky right-0 z-10 relative bg-card px-3 py-2 shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.18)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200">
                    <div className="flex justify-center gap-2">
                      <TableActionIconButton
                        label="Lihat detail"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => onOpenDetail(user, "view")}
                        icon={<Eye className="h-4 w-4" />}
                      />
                      {canManageUsers ? (
                        <TableActionIconButton
                          label="Edit akun atau profile"
                          variant="outline"
                          size="icon-sm"
                          disabled={isDeleting}
                          onClick={() => onOpenDetail(user, "edit")}
                          icon={<Pencil className="h-4 w-4" />}
                        />
                      ) : null}
                      {canManageUsers ? (
                        <TableActionIconButton
                          label="Hapus akun atau profile"
                          variant="outline"
                          size="icon-sm"
                          disabled={isDeleting}
                          onClick={() => onDelete(user)}
                          icon={<Trash2 className="h-4 w-4 text-destructive" />}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={columnCount} className="px-3 py-6 text-center text-muted-foreground">
                Tidak ada akun/profile terdaftar.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
