"use client";


import { useEffect, useMemo, useState } from "react";

import { ArrowUpRight, MapPinned } from "lucide-react";

import { toast } from "sonner";

import { PicMultiSelect } from "./PicMultiSelect";

import { RelatedUserDetailDialog } from "@/components/admin/history";

import {
  AdminDetailActions,
  AdminDetailDialogShell,
  ConfirmDeleteDialog,
  InlineErrorAlert,
} from "@/components/shared";

import { Input } from "@/components/ui";

import { useDeleteRoom } from "@/hooks/shared/resources/rooms";

import type { RoomRow } from "@/hooks/shared/resources/rooms";

import { useUpdateRoom } from "@/hooks/shared/resources/rooms";

import { usePicUsers } from "@/hooks/shared/resources/users";

const INVENTORY_MODAL_WIDTH_CLASS =
  "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-[50vw] sm:max-w-[960px] sm:min-w-[720px] sm:max-w-none";

type AdminRoomDetailDialogProps = {
  open: boolean;
  room: RoomRow | null;
  isLoading?: boolean;
  error?: string;
  canManage?: boolean;
  initialMode?: "view" | "edit";
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  onDeleted: () => void;
};

function DetailField({
  label,
  value,
  editable = false,
  onChange,
  type = "text",
  onClick,
}: {
  label: string;
  value: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  type?: "text" | "number";
  onClick?: () => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-700">{label}</p>
      {editable ? (
        <Input
          type={type}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          className="border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
        />
      ) : onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-sky-700 transition hover:text-sky-800"
        >
          {value || "-"}
          <ArrowUpRight className="ml-2 inline h-3.5 w-3.5 align-text-top text-sky-500" />
        </button>
      ) : (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {value || "-"}
        </div>
      )}
    </div>
  );
}

export default function AdminRoomDetailDialog({
  open,
  room,
  isLoading = false,
  error = "",
  canManage = true,
  initialMode = "view",
  onOpenChange,
  onUpdated,
  onDeleted,
}: AdminRoomDetailDialogProps) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [relatedUserId, setRelatedUserId] = useState<string | number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    number: "",
    floor: "",
    capacity: "",
    description: "",
    picIds: [] as string[],
  });
  const {
    picUsers,
    isLoading: isLoadingPics,
    error: picError,
  } = usePicUsers(isEditing && open);
  const {
    updateRoom,
    isSubmitting,
    errorMessage: updateErrorMessage,
    setErrorMessage: setUpdateErrorMessage,
  } = useUpdateRoom();
  const {
    deleteRoom,
    isDeleting,
    errorMessage: deleteErrorMessage,
    setErrorMessage: setDeleteErrorMessage,
  } = useDeleteRoom();

  const picOptions = useMemo(
    () => picUsers.map((user) => ({ value: user.id, label: user.name })),
    [picUsers],
  );
  useEffect(() => {
    if (!open || !room) return;
    setFormData({
      name: room.name,
      number: room.number,
      floor: room.floor,
      capacity: room.capacity,
      description: room.description,
      picIds: room.picIds,
    });
    setIsEditing(initialMode === "edit" && canManage);
    setConfirmDeleteOpen(false);
    setUpdateErrorMessage("");
    setDeleteErrorMessage("");
  }, [canManage, initialMode, open, room, setDeleteErrorMessage, setUpdateErrorMessage]);

  const resetState = () => {
    setConfirmDeleteOpen(false);
    setIsEditing(false);
    setUpdateErrorMessage("");
    setDeleteErrorMessage("");
    setFormData({
      name: "",
      number: "",
      floor: "",
      capacity: "",
      description: "",
      picIds: [],
    });
  };

  const handleSave = async () => {
    if (!room) return;
    setUpdateErrorMessage("");

    if (!formData.name.trim())
      return setUpdateErrorMessage("Nama ruangan wajib diisi.");
    if (!formData.number.trim())
      return setUpdateErrorMessage("Nomor ruangan wajib diisi.");
    if (!formData.floor.trim())
      return setUpdateErrorMessage("Lantai wajib diisi.");
    if (!formData.capacity || Number(formData.capacity) <= 0)
      return setUpdateErrorMessage("Kapasitas harus lebih dari 0.");

    const result = await updateRoom(room.id, {
      name: formData.name,
      number: formData.number,
      floor: formData.floor,
      capacity: formData.capacity,
      description: formData.description,
      picIds: formData.picIds,
    });
    if (!result.ok) return;

    setIsEditing(false);
    onUpdated();
    toast.success("Ruangan berhasil diperbarui.");
  };

  const handleDelete = async () => {
    if (!room) return;
    setDeleteErrorMessage("");
    const result = await deleteRoom(room.id);
    if (!result.ok) return;
    setConfirmDeleteOpen(false);
    onDeleted();
    onOpenChange(false);
    resetState();
    toast.success("Ruangan berhasil dihapus.");
  };

  return (
    <AdminDetailDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseReset={() => {
        resetState();
        setRelatedUserId(null);
      }}
      title="Detail Ruangan"
      description="Tinjau informasi ruangan dan lakukan perubahan bila diperlukan."
      icon={<MapPinned className="h-5 w-5" />}
      contentClassName={`${INVENTORY_MODAL_WIDTH_CLASS} max-h-[90vh] min-w-0 gap-0 overflow-hidden p-0`}
    >
        <div className="space-y-4 px-5 py-4 sm:px-6">
          {error ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : isLoading ? (
            <div className="max-h-[calc(90vh-7rem)] overflow-y-auto pr-1 pb-2">
              <div className="space-y-4">
                <div className="rounded-xl border bg-slate-50/80 px-4 py-3">
                  <div className="h-6 w-56 animate-pulse rounded bg-slate-200" />
                  <div className="mt-2 h-4 w-28 animate-pulse rounded bg-slate-100" />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="space-y-2">
                      <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                      <div className="h-10 rounded-md border border-slate-200 bg-slate-100 animate-pulse" />
                    </div>
                  ))}

                  <div className="space-y-2 md:col-span-2">
                    <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
                    <div className="rounded-md border border-slate-200 bg-slate-100 p-3">
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <div
                            key={index}
                            className="h-8 w-24 animate-pulse rounded-full bg-slate-200"
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                    <div className="h-24 rounded-md border border-slate-200 bg-slate-100 animate-pulse" />
                  </div>

                </div>
              </div>
            </div>
          ) : !room ? (
            <div className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground">
              Data ruangan tidak ditemukan.
            </div>
          ) : (
            <div className="max-h-[calc(90vh-7rem)] overflow-y-auto pr-1 pb-2">
              <div className="space-y-4">
                <div className="rounded-xl border bg-slate-50/80 px-4 py-3">
                <p className="text-lg font-semibold text-slate-900">
                  {room.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Ruangan {room.number}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <DetailField
                  label="Nama Ruangan"
                  value={isEditing ? formData.name : room.name}
                  editable={isEditing}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, name: value }))
                  }
                />
                <DetailField
                  label="Nomor Ruangan"
                  value={isEditing ? formData.number : room.number}
                  editable={isEditing}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, number: value }))
                  }
                />
                <DetailField
                  label="Lantai"
                  value={isEditing ? formData.floor : room.floor}
                  editable={isEditing}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, floor: value }))
                  }
                />
                <DetailField
                  label="Kapasitas"
                  value={isEditing ? formData.capacity : room.capacity}
                  editable={isEditing}
                  type="number"
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, capacity: value }))
                  }
                />

                <div className="space-y-1 md:col-span-2">
                  <p className="text-xs font-medium text-slate-700">PIC</p>
                  {isEditing ? (
                    <PicMultiSelect
                      options={picOptions}
                      selectedIds={formData.picIds}
                      onChange={(nextIds) =>
                        setFormData((prev) => ({ ...prev, picIds: nextIds }))
                      }
                      disabled={isLoadingPics}
                    />
                  ) : room.picNames.length ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {room.picNames.map((name, index) => {
                          const picId = room.picIds[index];
                          if (!picId) {
                            return (
                              <span key={`${name}-${index}`} className="text-sm text-slate-700">
                                {name}
                              </span>
                            );
                          }

                          return (
                            <button
                              key={picId}
                              type="button"
                              className="text-sm font-medium text-sky-700 transition hover:text-sky-800"
                              onClick={() => setRelatedUserId(picId)}
                            >
                              {name}
                              <ArrowUpRight className="ml-1 inline h-3.5 w-3.5 align-text-top text-sky-500" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      -
                    </div>
                  )}
                  {picError ? (
                    <p className="text-xs text-destructive">{picError}</p>
                  ) : null}
                </div>

                <div className="space-y-1 md:col-span-2">
                  <p className="text-xs font-medium text-slate-700">
                    Deskripsi
                  </p>
                  {isEditing ? (
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                      rows={3}
                      className="w-full rounded-md border border-sky-300 bg-sky-50/60 px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-200"
                    />
                  ) : (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {room.description || "-"}
                    </div>
                  )}
                </div>

              </div>

              {updateErrorMessage ? (
                <InlineErrorAlert>{updateErrorMessage}</InlineErrorAlert>
              ) : null}
              {deleteErrorMessage ? (
                <InlineErrorAlert>{deleteErrorMessage}</InlineErrorAlert>
              ) : null}

              {canManage ? (
                <AdminDetailActions
                  isEditing={isEditing}
                  isSubmitting={isSubmitting}
                  showDeleteAction
                  deleteLabel="Hapus Ruangan"
                  onEdit={() => setIsEditing(true)}
                  onCancelEdit={() => {
                    setIsEditing(false);
                    setUpdateErrorMessage("");
                    setFormData({
                      name: room.name,
                      number: room.number,
                      floor: room.floor,
                      capacity: room.capacity,
                      description: room.description,
                      picIds: room.picIds,
                    });
                  }}
                  onSave={() => void handleSave()}
                  onDelete={() => setConfirmDeleteOpen(true)}
                />
              ) : null}

              {!isEditing && canManage ? (
                  <ConfirmDeleteDialog
                    open={confirmDeleteOpen}
                    onOpenChange={setConfirmDeleteOpen}
                    size="sm"
                    headerClassName="place-items-start text-left"
                    footerClassName="sm:justify-start"
                    title="Hapus ruangan?"
                    description={`Ruangan ${room.name} akan dihapus.`}
                    isDeleting={isDeleting}
                    onConfirm={() => void handleDelete()}
                  />
              ) : null}
            </div>
          </div>
          )}
        </div>

      <RelatedUserDetailDialog
        open={Boolean(relatedUserId)}
        userId={relatedUserId}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setRelatedUserId(null);
        }}
      />
    </AdminDetailDialogShell>
  );
}
