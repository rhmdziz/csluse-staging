"use client";

import { useEffect, useMemo, useState } from "react";

import { Plus, UserRound } from "lucide-react";

import { toast } from "sonner";

import { AdminDetailDialogShell, InlineErrorAlert } from "@/components/shared";

import { Button, DialogFooter, Input } from "@/components/ui";

import { USER_MODAL_WIDTH_CLASS } from "@/components/admin/user-management";

import { useRoomDetail, useRoomOptions, useUpdateRoom } from "@/hooks/shared/resources/rooms";

import { usePicUsers } from "@/hooks/shared/resources/users";

type AssignRoomPicDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
};

export default function AssignRoomPicDialog({
  open,
  onOpenChange,
  onAssigned,
}: AssignRoomPicDialogProps) {
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedPicIds, setSelectedPicIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const { rooms, isLoading: isLoadingRooms, error: roomOptionsError } = useRoomOptions(open);
  const { picUsers, isLoading: isLoadingPics, error: picUsersError } = usePicUsers(open);
  const {
    room,
    isLoading: isLoadingRoomDetail,
    error: roomDetailError,
  } = useRoomDetail(selectedRoomId || null);
  const { updateRoom, isSubmitting, errorMessage, setErrorMessage } = useUpdateRoom();

  useEffect(() => {
    setSelectedPicIds([]);
    setSearch("");
  }, [selectedRoomId]);

  const existingPicSet = useMemo(() => new Set(room?.picIds ?? []), [room?.picIds]);

  // Only show non-assigned users in the add list
  const filteredPicUsers = useMemo(() => {
    if (!selectedRoomId) return [];
    const normalized = search.trim().toLowerCase();
    return picUsers
      .filter((user) => !existingPicSet.has(user.id))
      .filter((user) => {
        if (!normalized) return true;
        return `${user.name} ${user.role ?? ""} ${user.department ?? ""}`
          .toLowerCase()
          .includes(normalized);
      });
  }, [picUsers, search, selectedRoomId, existingPicSet]);

  const resetState = () => {
    setSelectedRoomId("");
    setSearch("");
    setSelectedPicIds([]);
    setMessage("");
    setErrorMessage("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    if (!selectedRoomId) {
      setMessage("Pilih ruangan terlebih dahulu.");
      return;
    }
    if (!room) {
      setMessage("Detail ruangan belum siap.");
      return;
    }
    if (selectedPicIds.length === 0) {
      setMessage("Pilih minimal satu PIC baru untuk ditambahkan.");
      return;
    }

    const nextPicIds = Array.from(new Set([...(room.picIds ?? []), ...selectedPicIds]));

    const result = await updateRoom(selectedRoomId, {
      name: room.name,
      number: room.number,
      floor: room.floor,
      capacity: room.capacity,
      description: room.description,
      picIds: nextPicIds,
    });
    if (!result.ok) return;

    toast.success("PIC ruangan berhasil ditambahkan.");
    onAssigned();
    onOpenChange(false);
    resetState();
  };

  return (
    <AdminDetailDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseReset={resetState}
      title="Tambahkan PIC Ruangan"
      description="Pilih ruangan lalu pilih lecturer/admin sebagai PIC baru."
      icon={<Plus className="h-5 w-5" />}
      contentClassName={`${USER_MODAL_WIDTH_CLASS} gap-0 p-0 [--primary:#0048B4] [--primary-foreground:#FFFFFF] [--ring:#3B82F6]`}
    >
      <form className="space-y-4 px-5 py-4 sm:px-6" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label className="text-xs font-medium">Ruangan</label>
          <select
            value={selectedRoomId}
            onChange={(event) => {
              setSelectedRoomId(event.target.value);
              setMessage("");
            }}
            className="h-9 w-full rounded-md border border-sky-300 bg-sky-50/60 px-3 text-sm shadow-sm outline-none focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-200"
            disabled={isLoadingRooms}
          >
            <option value="">{isLoadingRooms ? "Memuat ruangan..." : "Pilih ruangan"}</option>
            {rooms.map((roomOption) => (
              <option key={roomOption.id} value={roomOption.id}>
                {roomOption.label}
              </option>
            ))}
          </select>
        </div>

        {selectedRoomId ? (
          <>
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-700">PIC Saat Ini</p>
              {isLoadingRoomDetail ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-muted-foreground">
                  Memuat...
                </div>
              ) : room?.picNames?.length ? (
                <div className="space-y-1.5">
                  {room.picNames.map((name) => (
                    <div
                      key={name}
                      className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 px-3 py-3 text-sm text-muted-foreground">
                  Belum ada PIC pada ruangan ini.
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-700">Tambah PIC</p>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama, role, atau department"
                className="border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
                disabled={isLoadingPics || isLoadingRoomDetail}
              />
              <div className="max-h-56 overflow-y-auto rounded-md border border-sky-200 bg-white">
                {isLoadingPics || isLoadingRoomDetail ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground">Memuat...</div>
                ) : filteredPicUsers.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground">
                    {search ? "Tidak ada hasil pencarian." : "Semua lecturer/admin sudah menjadi PIC ruangan ini."}
                  </div>
                ) : (
                  filteredPicUsers.map((user) => {
                    const checked = selectedPicIds.includes(user.id);
                    return (
                      <label
                        key={user.id}
                        className="flex cursor-pointer items-start gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-sky-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            setSelectedPicIds((prev) =>
                              event.target.checked
                                ? [...prev, user.id]
                                : prev.filter((id) => id !== user.id),
                            );
                          }}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
                          <p className="truncate text-xs text-slate-500">
                            {[user.role, user.department].filter(Boolean).join(" • ")}
                          </p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </>
        ) : null}

        {roomOptionsError || picUsersError || (selectedRoomId && roomDetailError) ? (
          <InlineErrorAlert>{roomOptionsError || picUsersError || roomDetailError}</InlineErrorAlert>
        ) : null}
        {message ? <InlineErrorAlert>{message}</InlineErrorAlert> : null}
        {errorMessage ? <InlineErrorAlert>{errorMessage}</InlineErrorAlert> : null}

        <DialogFooter>
          <Button
            type="submit"
            disabled={isSubmitting || isLoadingRoomDetail || !selectedRoomId}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {isSubmitting ? "Menyimpan..." : "Tambahkan PIC Ruangan"}
          </Button>
        </DialogFooter>
      </form>
    </AdminDetailDialogShell>
  );
}
