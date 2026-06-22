"use client";


import { useEffect, useMemo, useRef, useState } from "react";

import { ChevronDown, Trash2, UserPlus, Users, X } from "lucide-react";

import { toast } from "sonner";

import {
  AdminFilterField,
  AdminFilterGrid,
  ADMIN_FILTER_INPUT_CLASS,
  ADMIN_FILTER_SELECT_CLASS,
} from "@/components/admin/shared";

import { TaskManagementPageShell } from "@/components/admin/task-management";

import { AssignMentorDialog, MentorTaskTable, UserDetailDialog } from "@/components/admin/user-management";

import { ConfirmDeleteDialog, DataPagination } from "@/components/shared";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
} from "@/components/ui";

import { isPrivilegedRole } from "@/constants/roles";

import { useLoadProfile } from "@/hooks/shared/profile";
import { useDepartmentOptions } from "@/hooks/shared/resources/departments";
import { useUpdateUserProfile } from "@/hooks/shared/resources/users";

import { useUsers, type UserRow } from "@/hooks/shared/resources/users";

const PAGE_SIZE = 20;

export default function MentorTaskManagementContent() {
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const { profile } = useLoadProfile();
  const { departmentNames } = useDepartmentOptions();
  const canManageUsers = isPrivilegedRole(profile?.role);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<UserRow | null>(null);
  const [removeCandidate, setRemoveCandidate] = useState<UserRow | null>(null);
  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Array<number | string>>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const { updateUserProfile, isSubmitting } = useUpdateUserProfile();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const {
    users,
    setUsers,
    totalCount,
    setTotalCount,
    isLoading,
    hasLoadedOnce,
    error,
  } = useUsers(
    page,
    PAGE_SIZE,
    {
      role: "Lecturer",
      isMentor: true,
      department,
      search: debouncedSearch,
    },
    reloadKey,
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((totalCount || users.length) / PAGE_SIZE)),
    [totalCount, users.length],
  );
  const selectedCount = selectedIds.length;
  const allVisibleSelected =
    users.length > 0 && users.every((user) => selectedIds.includes(user.id));
  const someVisibleSelected =
    users.some((user) => selectedIds.includes(user.id)) && !allVisibleSelected;

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) => users.some((user) => String(user.id) === String(id))),
    );
  }, [users]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

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

  const handleRemoveMentor = async () => {
    if (!removeCandidate?.profileId) return;

    try {
      await updateUserProfile(removeCandidate.profileId, { is_mentor: false });
      setUsers((prev) =>
        prev.filter((item) => String(item.profileId) !== String(removeCandidate.profileId)),
      );
      setTotalCount((prev) => Math.max(0, prev - 1));
      if (detailUser && String(detailUser.profileId) === String(removeCandidate.profileId)) {
        setDetailUser(null);
      }
      setRemoveCandidate(null);
      toast.success("Dosen pembimbing berhasil dilepas.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal melepas dosen pembimbing.",
      );
    }
  };

  const handleBulkRemoveMentor = async () => {
    if (!selectedIds.length) return;

    try {
      const selectedUsers = users.filter((user) => selectedIds.includes(user.id));
      for (const user of selectedUsers) {
        if (!user.profileId) continue;
        await updateUserProfile(user.profileId, { is_mentor: false });
      }

      const removedIds = new Set(selectedIds.map((id) => String(id)));
      setUsers((prev) => prev.filter((item) => !removedIds.has(String(item.id))));
      setTotalCount((prev) => Math.max(0, prev - removedIds.size));
      if (detailUser && removedIds.has(String(detailUser.id))) {
        setDetailUser(null);
      }
      setSelectedIds([]);
      setBulkRemoveOpen(false);
      toast.success(`${removedIds.size} dosen pembimbing berhasil dilepas.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal melepas dosen pembimbing terpilih.",
      );
    }
  };

  return (
    <>
      <TaskManagementPageShell
      title="Dosen Pembimbing"
      description={`Total ${totalCount || users.length} dosen pembimbing terdaftar.`}
      icon={<Users className="h-5 w-5 text-sky-200" />}
      error={error || errorMessage}
      filterOpen={filterOpen}
      onToggleFilter={() => setFilterOpen((prev) => !prev)}
      onResetFilter={() => {
        setSearch("");
        setDepartment("");
        setDebouncedSearch("");
        setPage(1);
      }}
      filterContent={
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
          }}
        >
          <AdminFilterGrid columns={4}>
            <AdminFilterField label="Cari">
              <Input
                type="search"
                value={search}
                placeholder="Nama, email, atau ID"
                className={ADMIN_FILTER_INPUT_CLASS}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </AdminFilterField>
            <AdminFilterField label="Department">
              <select
                value={department}
                className={ADMIN_FILTER_SELECT_CLASS}
                onChange={(event) => {
                  setDepartment(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Semua</option>
                {departmentNames.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </AdminFilterField>
          </AdminFilterGrid>
        </form>
      }
      actions={
        <>
          <div className="flex items-center justify-between gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={selectedCount === 0 || isSubmitting}
              >
                Aksi Terpilih
                {selectedCount ? ` (${selectedCount})` : ""}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="start" className="w-56">
              <DropdownMenuItem
                variant="destructive"
                disabled={selectedCount === 0 || isSubmitting}
                onClick={() => setBulkRemoveOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Lepaskan Dosen Pembimbing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={selectedCount === 0}
                onClick={() => setSelectedIds([])}
                className="text-xs text-slate-500"
              >
                <X className="h-3.5 w-3.5" />
                Clear selection
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
          {canManageUsers ? (
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Tambahkan Dosen Pembimbing
            </Button>
          ) : null}
        </>
      }
        footer={
          <DataPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            itemLabel="dosen pembimbing"
            isLoading={isLoading}
            onPageChange={setPage}
          />
        }
      >
        <MentorTaskTable
          users={users}
          isLoading={isLoading}
          hasLoadedOnce={hasLoadedOnce}
          selectedIds={selectedIds}
          allVisibleSelected={allVisibleSelected}
          onToggleItemSelection={toggleItemSelection}
          onToggleSelectAllVisible={toggleSelectAllVisible}
          selectAllRef={selectAllRef}
          onOpenDetail={(user) => setDetailUser(user)}
          onDelete={setRemoveCandidate}
          isDeleting={isSubmitting}
        />
      </TaskManagementPageShell>

      <AssignMentorDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onAssigned={() => setReloadKey((prev) => prev + 1)}
      />

      <UserDetailDialog
        open={Boolean(detailUser)}
        user={detailUser}
        mode="view"
        canManageUsers={false}
        onOpenChange={(open) => {
          if (!open) setDetailUser(null);
        }}
        onDeleteRequest={() => {}}
        onUserUpdated={() => {}}
      />

      <ConfirmDeleteDialog
        open={Boolean(removeCandidate)}
        title="Hapus dosen pembimbing?"
        description={
          removeCandidate
            ? `${removeCandidate.name || removeCandidate.email} akan dilepas dari daftar dosen pembimbing.`
            : "Data akan diperbarui."
        }
        confirmLabel="Lepaskan"
        pendingLabel="Melepas..."
        isDeleting={isSubmitting}
        onOpenChange={(open) => {
          if (!open) setRemoveCandidate(null);
        }}
        onConfirm={() => {
          void handleRemoveMentor();
        }}
      />
      <ConfirmDeleteDialog
        open={bulkRemoveOpen}
        title="Lepaskan dosen pembimbing terpilih?"
        description={`${selectedCount} dosen yang dipilih akan dilepas dari status dosen pembimbing.`}
        confirmLabel="Lepaskan"
        pendingLabel="Melepas..."
        isDeleting={isSubmitting}
        onOpenChange={setBulkRemoveOpen}
        onConfirm={() => {
          void handleBulkRemoveMentor();
        }}
      />
    </>
  );
}
