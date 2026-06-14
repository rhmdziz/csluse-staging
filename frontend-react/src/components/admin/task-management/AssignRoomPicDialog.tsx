"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { Building2, Plus, UserRound } from "lucide-react";

import { toast } from "sonner";

import { AdminDetailDialogShell, InlineErrorAlert } from "@/components/shared";

import { Button, DialogFooter, Input } from "@/components/ui";

import { USER_MODAL_WIDTH_CLASS } from "@/components/admin/user-management";

import { useRoomOptions } from "@/hooks/shared/resources/rooms";

import { useBulkAssignRoomPics, usePicUsers } from "@/hooks/shared/resources/users";

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
  const [roomSearch, setRoomSearch] = useState("");
  const [picSearch, setPicSearch] = useState("");
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [selectedPicIds, setSelectedPicIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const { rooms, isLoading: isLoadingRooms, error: roomOptionsError } = useRoomOptions(open);
  const { picUsers, isLoading: isLoadingPics, error: picUsersError } = usePicUsers(open);
  const {
    bulkAssignRoomPics,
    isSubmitting,
    errorMessage,
    setErrorMessage,
  } = useBulkAssignRoomPics();

  const filteredRooms = useMemo(() => {
    const normalized = roomSearch.trim().toLowerCase();
    return rooms.filter((roomOption) => {
      if (!normalized) return true;
      return `${roomOption.label} ${roomOption.name}`.toLowerCase().includes(normalized);
    });
  }, [rooms, roomSearch]);

  const filteredPicUsers = useMemo(() => {
    const normalized = picSearch.trim().toLowerCase();
    return picUsers.filter((user) => {
      if (!normalized) return true;
      return `${user.name} ${user.role ?? ""} ${user.department ?? ""}`
        .toLowerCase()
        .includes(normalized);
    });
  }, [picUsers, picSearch]);

  const selectedRoomSelections = useMemo(
    () =>
      selectedRoomIds
        .map((roomId) => ({
          id: roomId,
          label: rooms.find((roomOption) => String(roomOption.id) === roomId)?.label ?? roomId,
        })),
    [rooms, selectedRoomIds],
  );

  const selectedPicSelections = useMemo(
    () =>
      selectedPicIds
        .map((picId) => ({
          id: picId,
          label: picUsers.find((user) => user.id === picId)?.name ?? picId,
        })),
    [picUsers, selectedPicIds],
  );

  const resetState = () => {
    setRoomSearch("");
    setPicSearch("");
    setSelectedRoomIds([]);
    setSelectedPicIds([]);
    setMessage("");
    setErrorMessage("");
  };

  useEffect(() => {
    if (!open) return;
    setMessage("");
    setErrorMessage("");
  }, [open, setErrorMessage]);

  const toggleSelection = (
    value: string,
    setter: Dispatch<SetStateAction<string[]>>,
  ) => {
    setter((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    if (selectedRoomIds.length === 0) {
      setMessage("Pilih minimal satu ruangan.");
      return;
    }

    if (selectedPicIds.length === 0) {
      setMessage("Pilih minimal satu PIC.");
      return;
    }

    const result = await bulkAssignRoomPics({
      roomIds: selectedRoomIds,
      picIds: selectedPicIds,
    });
    if (!result.ok) return;

    const createdCount = result.data.created_assignment_count ?? 0;
    const skippedCount = result.data.skipped_existing_count ?? 0;

    toast.success(
      skippedCount > 0
        ? `${createdCount} assignment ditambahkan, ${skippedCount} assignment lama dilewati.`
        : `${createdCount} assignment PIC ruangan berhasil ditambahkan.`,
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
      description="Pilih satu atau banyak ruangan, lalu pilih lecturer/admin yang ingin ditugaskan sekaligus."
      icon={<Plus className="h-5 w-5" />}
      contentClassName={`${USER_MODAL_WIDTH_CLASS} gap-0 p-0 [--primary:#0048B4] [--primary-foreground:#FFFFFF] [--ring:#3B82F6]`}
    >
      <form className="space-y-4 px-5 py-4 sm:px-6" onSubmit={handleSubmit}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-medium">Ruangan</label>
              <span className="text-xs text-slate-500">{selectedRoomIds.length} dipilih</span>
            </div>
            <Input
              value={roomSearch}
              onChange={(event) => setRoomSearch(event.target.value)}
              placeholder="Cari nama atau nomor ruangan"
              className="border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
              disabled={isLoadingRooms}
            />
            <div className="max-h-72 overflow-y-auto rounded-md border border-sky-200 bg-white">
              {isLoadingRooms ? (
                <div className="px-3 py-3 text-sm text-muted-foreground">Memuat ruangan...</div>
              ) : filteredRooms.length === 0 ? (
                <div className="px-3 py-3 text-sm text-muted-foreground">
                  {roomSearch ? "Tidak ada hasil pencarian ruangan." : "Belum ada ruangan tersedia."}
                </div>
              ) : (
                filteredRooms.map((roomOption) => {
                  const checked = selectedRoomIds.includes(String(roomOption.id));
                  return (
                    <label
                      key={roomOption.id}
                      className="flex cursor-pointer items-start gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-sky-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelection(String(roomOption.id), setSelectedRoomIds)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{roomOption.label}</p>
                        <p className="truncate text-xs text-slate-500">Kapasitas {roomOption.capacity}</p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-medium">PIC</label>
              <span className="text-xs text-slate-500">{selectedPicIds.length} dipilih</span>
            </div>
            <Input
              value={picSearch}
              onChange={(event) => setPicSearch(event.target.value)}
              placeholder="Cari nama, role, atau department"
              className="border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
              disabled={isLoadingPics}
            />
            <div className="max-h-72 overflow-y-auto rounded-md border border-sky-200 bg-white">
              {isLoadingPics ? (
                <div className="px-3 py-3 text-sm text-muted-foreground">Memuat PIC...</div>
              ) : filteredPicUsers.length === 0 ? (
                <div className="px-3 py-3 text-sm text-muted-foreground">
                  {picSearch ? "Tidak ada hasil pencarian PIC." : "Belum ada PIC tersedia."}
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
                        onChange={() => toggleSelection(user.id, setSelectedPicIds)}
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
        </div>

        {selectedRoomIds.length || selectedPicIds.length ? (
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-slate-700">
                <Building2 className="h-4 w-4" />
                <span className="font-medium">Ruangan Terpilih</span>
              </div>
              {selectedRoomSelections.length ? (
                selectedRoomSelections.map((roomSelection) => (
                  <div key={roomSelection.id} className="truncate text-slate-600">
                    {roomSelection.label}
                  </div>
                ))
              ) : (
                <div className="text-slate-500">Belum ada ruangan dipilih.</div>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-slate-700">
                <UserRound className="h-4 w-4" />
                <span className="font-medium">PIC Terpilih</span>
              </div>
              {selectedPicSelections.length ? (
                selectedPicSelections.map((picSelection) => (
                  <div key={picSelection.id} className="truncate text-slate-600">
                    {picSelection.label}
                  </div>
                ))
              ) : (
                <div className="text-slate-500">Belum ada PIC dipilih.</div>
              )}
            </div>
          </div>
        ) : null}

        {roomOptionsError || picUsersError ? (
          <InlineErrorAlert>{roomOptionsError || picUsersError}</InlineErrorAlert>
        ) : null}
        {message ? <InlineErrorAlert>{message}</InlineErrorAlert> : null}
        {errorMessage ? <InlineErrorAlert>{errorMessage}</InlineErrorAlert> : null}

        <DialogFooter>
          <Button
            type="submit"
            disabled={isSubmitting || isLoadingRooms || isLoadingPics}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {isSubmitting ? "Menyimpan..." : "Tambahkan PIC ke Ruangan Terpilih"}
          </Button>
        </DialogFooter>
      </form>
    </AdminDetailDialogShell>
  );
}
