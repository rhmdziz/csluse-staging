"use client";

import type { RefObject } from "react";
import {
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";

import { TableActionIconButton } from "@/components/shared";
import AdminUserManagementTable from "./AdminUserManagementTable";
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
    <AdminUserManagementTable
      columns={[
        { key: "initials", label: "Inisial", className: "w-[72px]" },
        { key: "name", label: "Nama", className: "w-[180px]" },
        { key: "email", label: "Email", className: "w-[240px]" },
        ...(!isRoleScoped ? [{ key: "role", label: "Role", className: "w-[120px]" }] : []),
        { key: "status", label: "Status", className: "w-[140px] text-center" },
        { key: "user-type", label: "User Type", className: "w-[140px]" },
        { key: "last-login", label: "Last Login", className: "w-[180px]" },
        {
          key: "actions",
          label: "Aksi",
          className:
            "sticky right-0 z-10 w-[144px] bg-slate-900 text-center shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.35)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-700",
        },
      ]}
      hasRows={users.length > 0}
      isLoading={isLoading}
      hasLoadedOnce={hasLoadedOnce}
      emptyMessage="Tidak ada akun/profile terdaftar."
      tableClassName="min-w-[980px]"
      loadingIndicator={<div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />}
      selectAll={
        canManageUsers
          ? {
              ref: selectAllRef,
              checked: allVisibleSelected,
              ariaLabel: "Pilih semua akun atau profile yang tampil",
              onChange: onToggleSelectAllVisible,
            }
          : undefined
      }
    >
      {users.map((user) => {
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
            <td className="sticky right-0 z-10 bg-card px-3 py-2 shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.18)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200">
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
      })}
    </AdminUserManagementTable>
  );
}
