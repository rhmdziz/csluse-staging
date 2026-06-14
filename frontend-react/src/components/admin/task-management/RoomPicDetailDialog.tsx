"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DoorOpen, Plus, X } from "lucide-react";

import { toast } from "sonner";

import { InlineErrorAlert } from "@/components/shared";
import { getUserInitials } from "@/hooks/shared/resources/users";
import type { RoomPicTaskUserRow } from "@/hooks/shared/resources/users";
import { USER_MODAL_WIDTH_CLASS } from "@/components/admin/user-management";
import { useRoomOptions } from "@/hooks/shared/resources/rooms";
import { roomsService, mapRoom } from "@/services/shared/resources";
import { Button, Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui";

type RoomPicDetailDialogProps = {
  open: boolean;
  user: RoomPicTaskUserRow | null;
  onOpenChange: (open: boolean) => void;
  mode?: "view" | "edit";
  onUpdated?: () => void;
};

export default function RoomPicDetailDialog({
  open,
  user,
  onOpenChange,
  mode = "view",
  onUpdated,
}: RoomPicDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localRoomIds, setLocalRoomIds] = useState<string[]>([]);
  const pendingRemovalsRef = useRef<string[]>([]);
  const pendingAdditionsRef = useRef<string[]>([]);
  const [selectedAddRoomId, setSelectedAddRoomId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { rooms: roomOptions, isLoading: isLoadingRooms } = useRoomOptions(open);

  const resolveLabel = (roomId: string) =>
    roomOptions.find((r) => String(r.id) === String(roomId))?.label ?? roomId;

  const availableRooms = useMemo(() => {
    const localSet = new Set(localRoomIds);
    return roomOptions.filter((r) => !localSet.has(String(r.id)));
  }, [roomOptions, localRoomIds]);

  const resetPending = () => {
    pendingRemovalsRef.current = [];
    pendingAdditionsRef.current = [];
  };

  const stageRoomAddition = (roomId: string) => {
    const room = roomOptions.find((option) => String(option.id) === String(roomId));
    if (!room || localRoomIds.includes(String(room.id))) return false;

    setLocalRoomIds((prev) => [...prev, String(room.id)]);
    const removals = pendingRemovalsRef.current;
    if (removals.includes(String(room.id))) {
      pendingRemovalsRef.current = removals.filter((id) => id !== String(room.id));
    } else if (!pendingAdditionsRef.current.includes(String(room.id))) {
      pendingAdditionsRef.current = [...pendingAdditionsRef.current, String(room.id)];
    }
    setSelectedAddRoomId("");
    return true;
  };

  useEffect(() => {
    if (!open) return;
    const editing = mode === "edit";
    setIsEditing(editing);
    setLocalRoomIds(editing ? (user?.roomAssignments ?? []).map((room) => room.id) : []);
    resetPending();
    setSelectedAddRoomId("");
    setErrorMessage("");
  }, [open, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEnterEdit = () => {
    setLocalRoomIds((user?.roomAssignments ?? []).map((room) => room.id));
    resetPending();
    setSelectedAddRoomId("");
    setErrorMessage("");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setLocalRoomIds([]);
    resetPending();
    setSelectedAddRoomId("");
    setErrorMessage("");
  };

  const handleAddRoom = () => {
    if (!selectedAddRoomId) return;
    stageRoomAddition(selectedAddRoomId);
  };

  const handleRemoveRoom = (roomId: string) => {
    setLocalRoomIds((prev) => prev.filter((id) => id !== roomId));
    const additions = pendingAdditionsRef.current;
    if (additions.includes(roomId)) {
      pendingAdditionsRef.current = additions.filter((id) => id !== roomId);
    } else {
      pendingRemovalsRef.current = [...pendingRemovalsRef.current, roomId];
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setErrorMessage("");

    if (selectedAddRoomId) {
      stageRoomAddition(selectedAddRoomId);
    }

    setIsSaving(true);

    const removedNames = [...pendingRemovalsRef.current];
    const addedNames = [...pendingAdditionsRef.current];

    if (removedNames.length === 0 && addedNames.length === 0) {
      setErrorMessage("Belum ada perubahan penugasan ruangan untuk disimpan.");
      setIsSaving(false);
      return;
    }

    // Cache room details to avoid duplicate fetches
    type RawDetail = Awaited<ReturnType<typeof roomsService.getDetail>>;
    const rawCache = new Map<string, RawDetail>();
    const getDetail = async (roomId: string): Promise<RawDetail> => {
      if (rawCache.has(roomId)) return rawCache.get(roomId)!;
      const raw = await roomsService.getDetail(roomId);
      rawCache.set(roomId, raw);
      return raw;
    };

    // Find the user's exact PIC ID via email match in pics_detail of any existing room
    const findUserPicId = (raw: RawDetail): string | null => {
      const match = (raw.pics_detail ?? []).find(
        (pic) => (pic?.email ?? "").toLowerCase() === user.email.toLowerCase(),
      );
      return match?.id != null ? String(match.id) : null;
    };

    // Resolve confirmed ID from one of the user's existing rooms
    let confirmedUserId: string | null = null;
    for (const roomAssignment of user.roomAssignments ?? []) {
      try {
        const raw = await getDetail(roomAssignment.id);
        const found = findUserPicId(raw);
        if (found) { confirmedUserId = found; break; }
      } catch { /* continue */ }
    }

    // Fallback to profile ID or auth user ID if email match didn't work
    const userId = confirmedUserId ?? String(user.profileId ?? user.id);

    try {
      for (const roomId of removedNames) {
        const raw = await getDetail(roomId);
        const detail = mapRoom(raw);
        const result = await roomsService.update(roomId, {
          name: detail.name,
          number: detail.number,
          floor: detail.floor,
          capacity: detail.capacity,
          description: detail.description,
          picIds: detail.picIds.filter((pid) => pid !== userId),
        });
        if (!result.ok) throw new Error(`Gagal memperbarui ruangan ${detail.name} (${detail.number}).`);
      }

      for (const roomId of addedNames) {
        const raw = await getDetail(roomId);
        const detail = mapRoom(raw);
        if (!detail.picIds.includes(userId)) {
          const result = await roomsService.update(roomId, {
            name: detail.name,
            number: detail.number,
            floor: detail.floor,
            capacity: detail.capacity,
            description: detail.description,
            picIds: [...detail.picIds, userId],
          });
          if (!result.ok) throw new Error(`Gagal memperbarui ruangan ${detail.name} (${detail.number}).`);
        }
      }

      toast.success("Penugasan ruangan PIC berhasil diperbarui.");
      onUpdated?.();
      onOpenChange(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Gagal menyimpan perubahan.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${USER_MODAL_WIDTH_CLASS} max-h-[90vh] min-w-0 gap-0 overflow-y-auto p-0 [--primary:#0048B4] [--primary-foreground:#FFFFFF] [--ring:#3B82F6]`}
      >
        <DialogTitle className="sr-only">
          {isEditing ? "Edit Ruangan PIC" : "Detail PIC Ruangan"}
        </DialogTitle>

        {user ? (
          <div className="space-y-5 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3 border-b pb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-lg font-semibold uppercase">
                {getUserInitials(user)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-slate-900">{user.name}</p>
                <p className="hidden text-sm text-slate-500 sm:block">{user.email}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-900">Ruangan Ditugaskan</p>

              {isEditing ? (
                <div className="space-y-2">
                  {localRoomIds.length ? (
                    <div className="space-y-1.5">
                      {localRoomIds.map((roomId) => (
                        <div
                          key={roomId}
                          className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <DoorOpen className="h-4 w-4 shrink-0 text-slate-400" />
                            <span>{resolveLabel(roomId)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveRoom(roomId)}
                            className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                            aria-label={`Hapus ${resolveLabel(roomId)}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-slate-300 px-3 py-3 text-sm text-muted-foreground">
                      Belum ada ruangan. Tambahkan dari pilihan di bawah.
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <select
                      value={selectedAddRoomId}
                      onChange={(e) => setSelectedAddRoomId(e.target.value)}
                      disabled={isLoadingRooms || availableRooms.length === 0}
                      className="h-9 flex-1 rounded-md border border-sky-300 bg-sky-50/60 px-3 text-sm shadow-sm outline-none focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-200 disabled:opacity-60"
                    >
                      <option value="">
                        {isLoadingRooms
                          ? "Memuat ruangan..."
                          : availableRooms.length === 0
                            ? "Semua ruangan sudah dipilih"
                            : "Pilih ruangan untuk ditambahkan..."}
                      </option>
                      {availableRooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddRoom}
                      disabled={!selectedAddRoomId}
                      className="shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : user.roomAssignments?.length ? (
                <div className="space-y-1.5">
                  {user.roomAssignments.map((roomAssignment) => (
                    <div
                      key={roomAssignment.id}
                      className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <DoorOpen className="h-4 w-4 shrink-0 text-slate-400" />
                      <span>{roomAssignment.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm text-muted-foreground">
                  User ini belum ditugaskan ke ruangan mana pun.
                </div>
              )}
            </div>

            {errorMessage ? <InlineErrorAlert>{errorMessage}</InlineErrorAlert> : null}

            <DialogFooter>
              {isEditing ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    Batal
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={isSaving}
                  >
                    {isSaving ? "Menyimpan..." : "Simpan"}
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={handleEnterEdit}>
                    Edit
                  </Button>
                </>
              )}
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
