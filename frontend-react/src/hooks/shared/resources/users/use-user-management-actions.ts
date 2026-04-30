"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { UserRow } from "@/hooks/shared/resources/users";
import { useDeleteUser } from "@/hooks/shared/resources/users";
import type { UserDetailMode } from "@/components/admin/user-management";

type DetailState = {
  user: UserRow | null;
  mode: UserDetailMode;
};

type UseUserManagementActionsArgs = {
  canManageUsers: boolean;
  users: UserRow[];
  setUsers: React.Dispatch<React.SetStateAction<UserRow[]>>;
  setTotalCount: React.Dispatch<React.SetStateAction<number>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  onDataChanged: () => void;
};

export function useUserManagementActions({
  canManageUsers,
  users,
  setUsers,
  setTotalCount,
  setError,
  onDataChanged,
}: UseUserManagementActionsArgs) {
  const [deleteCandidate, setDeleteCandidate] = useState<UserRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Array<number | string>>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [detailState, setDetailState] = useState<DetailState>({
    user: null,
    mode: "view",
  });

  const { deleteUser, deleteUsers, isDeleting } = useDeleteUser();

  const selectedCount = selectedIds.length;
  const allVisibleSelected =
    canManageUsers &&
    users.length > 0 &&
    users.every((user) => selectedIds.includes(user.id));
  const someVisibleSelected =
    canManageUsers &&
    users.some((user) => selectedIds.includes(user.id)) &&
    !allVisibleSelected;

  const deletedIdSet = useMemo(
    () => new Set(selectedIds.map((id) => String(id))),
    [selectedIds],
  );

  const selectedRows = useMemo(
    () => users.filter((user) => deletedIdSet.has(String(user.id))),
    [deletedIdSet, users],
  );

  const openDetail = (user: UserRow, mode: UserDetailMode = "view") => {
    setDetailState({ user, mode });
  };

  const closeDetail = () => {
    setDetailState({ user: null, mode: "view" });
  };

  const toggleItemSelection = (id: number | string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id],
    );
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    if (!checked) {
      setSelectedIds((prev) =>
        prev.filter((id) => !users.some((user) => String(user.id) === String(id))),
      );
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      users.forEach((user) => next.add(user.id));
      return Array.from(next);
    });
  };

  const syncSelectionWithUsers = (nextUsers: UserRow[]) => {
    setSelectedIds((prev) =>
      prev.filter((id) => nextUsers.some((user) => String(user.id) === String(id))),
    );
  };

  const handleDelete = async () => {
    if (!canManageUsers || !deleteCandidate?.id) return;

    const result = await deleteUser(deleteCandidate);
    if (!result.ok) {
      setError(result.message || "Gagal menghapus data.");
      return;
    }

    setSelectedIds((prev) => prev.filter((id) => String(id) !== String(deleteCandidate.id)));
    if (detailState.user && String(detailState.user.id) === String(deleteCandidate.id)) {
      closeDetail();
    }
    setDeleteCandidate(null);
    onDataChanged();
    toast.success(
      deleteCandidate.hasUser
        ? "Akun dan profile berhasil dihapus."
        : "Profile pre-provisioned berhasil dihapus.",
    );
  };

  const handleBulkDelete = async () => {
    if (!canManageUsers || !selectedIds.length) return;

    const result = await deleteUsers(selectedRows);
    if (!result.ok) {
      setError(result.message || "Gagal menghapus akun/profile terpilih.");
      toast.error(result.message || "Gagal menghapus akun/profile terpilih.");
      return;
    }

    const removedIds = new Set((result.deletedIds ?? []).map((id) => String(id)));
    if (removedIds.size > 0) {
      setSelectedIds((prev) => prev.filter((id) => !removedIds.has(String(id))));
      if (detailState.user && removedIds.has(String(detailState.user.id))) {
        closeDetail();
      }
      onDataChanged();
    }

    setIsBulkDeleteOpen(false);

    if ((result.failedCount ?? 0) > 0) {
      toast.warning(
        `${result.deletedCount ?? 0} akun/profile berhasil dihapus, ${result.failedCount ?? 0} gagal.`,
      );
      return;
    }

    toast.success(`${result.deletedCount ?? 0} akun/profile berhasil dihapus.`);
  };

  return {
    deleteCandidate,
    setDeleteCandidate,
    detailState,
    openDetail,
    closeDetail,
    selectedIds,
    setSelectedIds,
    selectedRows,
    selectedCount,
    allVisibleSelected,
    someVisibleSelected,
    toggleItemSelection,
    toggleSelectAllVisible,
    syncSelectionWithUsers,
    isBulkDeleteOpen,
    setIsBulkDeleteOpen,
    handleDelete,
    handleBulkDelete,
    isDeleting,
  };
}

export default useUserManagementActions;
