"use client";


import { useEffect, useMemo, useState } from "react";

import { Plus, X } from "lucide-react";

import { toast } from "sonner";

import { AdminDetailDialogShell, InlineErrorAlert } from "@/components/shared";

import { Button, DialogFooter, Input } from "@/components/ui";

import { USER_MODAL_WIDTH_CLASS } from "@/components/admin/user-management";

import { useRoomDetail } from "@/hooks/shared/resources/rooms";

import { useRoomOptions } from "@/hooks/shared/resources/rooms";

import { useUpdateRoom } from "@/hooks/shared/resources/rooms";

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
  const [assignmentMode, setAssignmentMode] = useState<"append" | "replace">("append");
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
    if (!room) {
      setSelectedPicIds([]);
      return;
    }

    if (assignmentMode === "replace") {
      setSelectedPicIds(room.picIds);
      return;
    }

    setSelectedPicIds([]);
  }, [assignmentMode, room]);

  const filteredPicUsers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return picUsers.filter((user) => {
      if (!normalized) return true;
      return `${user.name} ${user.role ?? ""} ${user.department ?? ""}`
        .toLowerCase()
        .includes(normalized);
    });
  }, [picUsers, search]);

  const selectedPicSet = useMemo(() => new Set(selectedPicIds), [selectedPicIds]);
  const existingPicSet = useMemo(() => new Set(room?.picIds ?? []), [room?.picIds]);
  const existingPicNames = room?.picNames ?? [];
  const selectedPicChips = useMemo(
    () => picUsers.filter((user) => selectedPicSet.has(user.id)),
    [picUsers, selectedPicSet],
  );

  const resetState = () => {
    setAssignmentMode("append");
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
      setMessage(
        assignmentMode === "append"
          ? "Pilih minimal satu PIC baru untuk ditambahkan."
          : "Pilih minimal satu PIC untuk menggantikan daftar saat ini.",
      );
      return;
    }

    const nextPicIds =
      assignmentMode === "append"
        ? Array.from(new Set([...(room.picIds ?? []), ...selectedPicIds]))
        : selectedPicIds;

    const result = await updateRoom(selectedRoomId, {
      name: room.name,
      number: room.number,
      floor: room.floor,
      capacity: room.capacity,
      description: room.description,
      picIds: nextPicIds,
    });
    if (!result.ok) return;

    toast.success(
      assignmentMode === "append"
        ? "PIC ruangan berhasil ditambahkan."
        : "Daftar PIC ruangan berhasil diganti.",
    );
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
      description="Pilih ruangan lalu petakan lecturer/admin sebagai PIC untuk ruangan tersebut."
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
              setSelectedPicIds([]);
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

        <div className="space-y-2">
          <label className="text-xs font-medium">Mode Assignment</label>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setAssignmentMode("append");
                setMessage("");
              }}
              className={`rounded-lg border px-3 py-3 text-left transition ${
                assignmentMode === "append"
                  ? "border-sky-600 bg-sky-50 ring-2 ring-sky-100"
                  : "border-slate-200 bg-white hover:border-sky-300"
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">Append</p>
              <p className="mt-1 text-xs text-slate-500">
                Tambahkan PIC baru tanpa menghapus PIC yang sudah ada.
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setAssignmentMode("replace");
                setMessage("");
              }}
              className={`rounded-lg border px-3 py-3 text-left transition ${
                assignmentMode === "replace"
                  ? "border-amber-600 bg-amber-50 ring-2 ring-amber-100"
                  : "border-slate-200 bg-white hover:border-amber-300"
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">Replace</p>
              <p className="mt-1 text-xs text-slate-500">
                Ganti seluruh daftar PIC ruangan dengan pilihan baru.
              </p>
            </button>
          </div>
        </div>

        {selectedRoomId ? (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-slate-700">PIC Saat Ini</p>
              <span className="text-[11px] text-slate-500">
                {existingPicNames.length} user
              </span>
            </div>
            {existingPicNames.length ? (
              <div className="flex flex-wrap gap-2">
                {existingPicNames.map((picName) => (
                  <span
                    key={picName}
                    className="inline-flex max-w-full items-center rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    <span className="truncate">{picName}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Belum ada PIC pada ruangan ini.</p>
            )}
          </div>
        ) : null}

        <div className="space-y-1">
          <label className="text-xs font-medium">Cari PIC</label>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nama, role, atau department"
            className="border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
            disabled={isLoadingPics}
          />
        </div>

        {selectedPicChips.length ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-700">
              {assignmentMode === "append" ? "PIC yang Akan Ditambahkan" : "PIC Pengganti"}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedPicChips.map((user) => (
                <span
                  key={user.id}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-900"
                >
                  <span className="truncate">{user.name}</span>
                  <button
                    type="button"
                    className="rounded-full p-0.5 text-sky-700 hover:bg-sky-200"
                    onClick={() =>
                      setSelectedPicIds((prev) => prev.filter((id) => id !== user.id))
                    }
                    aria-label={`Hapus ${user.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="max-h-64 overflow-y-auto rounded-md border border-sky-200 bg-white">
          {filteredPicUsers.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Tidak ada lecturer/admin yang bisa dipilih.
            </div>
          ) : (
            filteredPicUsers.map((user) => {
              const checked = selectedPicSet.has(user.id);
              const alreadyAssigned = existingPicSet.has(user.id);
              const disabled = assignmentMode === "append" && alreadyAssigned;
              return (
                <label
                  key={user.id}
                  className={`flex items-start gap-3 border-b px-3 py-2 last:border-b-0 ${
                    disabled ? "cursor-not-allowed bg-slate-50/70" : "cursor-pointer hover:bg-sky-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
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
                    {alreadyAssigned ? (
                      <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                        {assignmentMode === "append"
                          ? "Sudah menjadi PIC pada ruangan ini"
                          : "PIC saat ini"}
                      </p>
                    ) : null}
                  </div>
                </label>
              );
            })
          )}
        </div>

        {(roomOptionsError || picUsersError || roomDetailError) ? (
          <InlineErrorAlert>
            {roomOptionsError || picUsersError || roomDetailError}
          </InlineErrorAlert>
        ) : null}
        {message ? <InlineErrorAlert>{message}</InlineErrorAlert> : null}
        {errorMessage ? <InlineErrorAlert>{errorMessage}</InlineErrorAlert> : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || isLoadingRoomDetail || !selectedRoomId}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {isSubmitting
              ? "Menyimpan..."
              : assignmentMode === "append"
                ? "Tambahkan PIC Ruangan"
                : "Ganti PIC Ruangan"}
          </Button>
        </DialogFooter>
      </form>
    </AdminDetailDialogShell>
  );
}
