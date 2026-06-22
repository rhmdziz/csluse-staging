"use client";


import { useEffect, useRef, useState } from "react";

import { Building2, ChevronDown, Plus, Trash2, X } from "lucide-react";

import { toast } from "sonner";

import {
  AdminFilterField,
  AdminFilterGrid,
  ADMIN_FILTER_INPUT_CLASS,
  ADMIN_FILTER_SELECT_CLASS,
} from "@/components/admin/shared";

import {
  AssignRoomPicDialog,
  RoomPicDetailDialog,
  TaskManagementPageShell,
} from "@/components/admin/task-management";

import { MentorTaskTable } from "@/components/admin/user-management";

import { ConfirmDeleteDialog } from "@/components/shared";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
} from "@/components/ui";

import { ROLE_OPTIONS } from "@/constants/roles";

import { useDepartmentOptions } from "@/hooks/shared/resources/departments";
import { useRoomOptions } from "@/hooks/shared/resources/rooms";

import {
  bulkRemoveRoomPicAssignments,
  removeRoomPicAssignments,
  useRoomPicTaskUsers,
  type RoomPicTaskUserRow,
} from "@/hooks/shared/resources/users";

export default function TaskManagementRoomPicPage() {
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("");
  const [room, setRoom] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<RoomPicTaskUserRow | null>(null);
  const [detailMode, setDetailMode] = useState<"view" | "edit">("view");
  const [removeCandidate, setRemoveCandidate] = useState<RoomPicTaskUserRow | null>(null);
  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Array<number | string>>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isRemoving, setIsRemoving] = useState(false);
  const { departmentNames } = useDepartmentOptions();
  const { rooms } = useRoomOptions();
  const {
    users,
    setUsers,
    totalCount,
    isLoading,
    hasLoadedOnce,
    error,
  } = useRoomPicTaskUsers(
    {
      department,
      role,
      room,
      search: debouncedSearch,
    },
    reloadKey,
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

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

  const handleRemovePic = async () => {
    const targetId = removeCandidate?.profileId ?? removeCandidate?.id;
    if (!targetId || !removeCandidate?.id) return;

    try {
      setIsRemoving(true);
      setErrorMessage("");
      await removeRoomPicAssignments(targetId);
      setUsers((prev) => prev.filter((item) => String(item.id) !== String(removeCandidate.id)));
      if (detailUser && String(detailUser.id) === String(removeCandidate.id)) {
        setDetailUser(null);
      }
      setSelectedIds((prev) => prev.filter((id) => String(id) !== String(removeCandidate.id)));
      setRemoveCandidate(null);
      toast.success("PIC ruangan berhasil dilepas.");
    } catch (removeError) {
      setErrorMessage(
        removeError instanceof Error ? removeError.message : "Gagal melepas PIC ruangan.",
      );
    } finally {
      setIsRemoving(false);
    }
  };

  const handleBulkRemovePic = async () => {
    if (!selectedIds.length) return;

    try {
      setIsRemoving(true);
      setErrorMessage("");
      const result = await bulkRemoveRoomPicAssignments(selectedIds);
      const removedIds = new Set((result.removed_ids ?? []).map((id) => String(id)));
      if (removedIds.size > 0) {
        setUsers((prev) => prev.filter((item) => !removedIds.has(String(item.id))));
        if (detailUser && removedIds.has(String(detailUser.id))) {
          setDetailUser(null);
        }
      }
      setSelectedIds([]);
      setBulkRemoveOpen(false);
      toast.success(`${removedIds.size} PIC ruangan berhasil dilepas.`);
    } catch (removeError) {
      setErrorMessage(
        removeError instanceof Error
          ? removeError.message
          : "Gagal melepas PIC ruangan terpilih.",
      );
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <>
      <TaskManagementPageShell
      title="PIC Ruangan"
      description={`Total ${totalCount} user terdaftar sebagai PIC ruangan.`}
      icon={<Building2 className="h-5 w-5 text-sky-200" />}
      error={error || errorMessage}
      filterOpen={filterOpen}
      onToggleFilter={() => setFilterOpen((prev) => !prev)}
      onResetFilter={() => {
        setSearch("");
        setDepartment("");
        setRole("");
        setRoom("");
        setDebouncedSearch("");
      }}
      filterContent={
        <form
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <AdminFilterGrid columns={4}>
            <AdminFilterField label="Cari">
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nama atau role"
                className={ADMIN_FILTER_INPUT_CLASS}
              />
            </AdminFilterField>
            <AdminFilterField label="Department">
              <select
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                className={ADMIN_FILTER_SELECT_CLASS}
              >
                <option value="">Semua</option>
                {departmentNames.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </AdminFilterField>
            <AdminFilterField label="Role">
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className={ADMIN_FILTER_SELECT_CLASS}
              >
                <option value="">Semua</option>
                {ROLE_OPTIONS.filter(
                  (option) => option.value === "Lecturer" || option.value === "Admin",
                ).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </AdminFilterField>
            <AdminFilterField label="Ruangan">
              <select
                value={room}
                onChange={(event) => setRoom(event.target.value)}
                className={ADMIN_FILTER_SELECT_CLASS}
              >
                <option value="">Semua</option>
                {rooms.map((roomOption) => (
                  <option key={roomOption.id} value={roomOption.id}>
                    {roomOption.label}
                  </option>
                ))}
              </select>
            </AdminFilterField>
          </AdminFilterGrid>
        </form>
      }
      actions={
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={selectedCount === 0 || isRemoving}
              >
                Aksi Terpilih
                {selectedCount ? ` (${selectedCount})` : ""}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="start" className="w-56">
              <DropdownMenuItem
                variant="destructive"
                disabled={selectedCount === 0 || isRemoving}
                onClick={() => setBulkRemoveOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Lepaskan PIC Ruangan
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
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Tambahkan PIC Ruangan
          </Button>
        </>
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
          onOpenDetail={(user) => { setDetailMode("view"); setDetailUser(user); }}
          onEdit={(user) => { setDetailMode("edit"); setDetailUser(user); }}
          onDelete={setRemoveCandidate}
          isDeleting={isRemoving}
          selectionLabel="PIC ruangan"
          removeLabel="Lepaskan PIC Ruangan"
          emptyMessage="Tidak ada PIC ruangan terdaftar."
          roomHeader="Ruangan"
          getRoomLabel={(user) => {
            if (user.roomAssignments?.length) {
              const visibleAssignments = user.roomAssignments.slice(0, 2);
              const hiddenCount = user.roomAssignments.length - visibleAssignments.length;

              return (
                <div className="flex flex-wrap gap-1.5">
                  {visibleAssignments.map((roomAssignment) => (
                    <span
                      key={roomAssignment.id}
                      className="inline-flex max-w-full items-center rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-900"
                      title={roomAssignment.label}
                    >
                      <span className="truncate">{roomAssignment.label}</span>
                    </span>
                  ))}
                  {hiddenCount > 0 ? (
                    <span
                      className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                      title={user.roomAssignments.slice(2).map((roomAssignment) => roomAssignment.label).join(", ")}
                    >
                      +{hiddenCount} lagi
                    </span>
                  ) : null}
                </div>
              );
            }
            if (!user.roomNames?.length) return "-";

            const visibleRoomNames = user.roomNames.slice(0, 2);
            const hiddenCount = user.roomNames.length - visibleRoomNames.length;

            return (
              <div className="flex flex-wrap gap-1.5">
                {visibleRoomNames.map((roomName) => (
                  <span
                    key={roomName}
                    className="inline-flex max-w-full items-center rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-900"
                    title={roomName}
                  >
                    <span className="truncate">{roomName}</span>
                  </span>
                ))}
                {hiddenCount > 0 ? (
                  <span
                    className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                    title={user.roomNames.slice(2).join(", ")}
                  >
                    +{hiddenCount} lagi
                  </span>
                ) : null}
              </div>
            );
          }}
          secondaryHeader="Role"
          getSecondaryLabel={(user) => user.role}
        />
      </TaskManagementPageShell>

      <AssignRoomPicDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onAssigned={() => setReloadKey((prev) => prev + 1)}
      />

      <RoomPicDetailDialog
        open={Boolean(detailUser)}
        user={detailUser}
        mode={detailMode}
        onOpenChange={(open) => {
          if (!open) setDetailUser(null);
        }}
        onUpdated={() => setReloadKey((prev) => prev + 1)}
      />

      <ConfirmDeleteDialog
        open={Boolean(removeCandidate)}
        title="Lepaskan PIC ruangan?"
        description={
          removeCandidate
            ? `${removeCandidate.name || removeCandidate.email} akan dilepas dari semua penugasan PIC ruangan.`
            : "Data akan diperbarui."
        }
        confirmLabel="Lepaskan"
        pendingLabel="Melepas..."
        isDeleting={isRemoving}
        onOpenChange={(open) => {
          if (!open) setRemoveCandidate(null);
        }}
        onConfirm={() => {
          void handleRemovePic();
        }}
      />

      <ConfirmDeleteDialog
        open={bulkRemoveOpen}
        title="Lepaskan PIC ruangan terpilih?"
        description={`${selectedCount} user yang dipilih akan dilepas dari semua penugasan PIC ruangan.`}
        confirmLabel="Lepaskan"
        pendingLabel="Melepas..."
        isDeleting={isRemoving}
        onOpenChange={setBulkRemoveOpen}
        onConfirm={() => {
          void handleBulkRemovePic();
        }}
      />
    </>
  );
}
