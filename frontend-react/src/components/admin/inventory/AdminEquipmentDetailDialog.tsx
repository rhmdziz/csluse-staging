"use client";


import { useEffect, useState } from "react";

import { ArrowUpRight, Wrench } from "lucide-react";

import { toast } from "sonner";

import { RelatedRoomDetailDialog } from "@/components/admin/history";

import {
  AdminDetailActions,
  AdminDetailDialogShell,
  ConfirmDeleteDialog,
  InlineErrorAlert,
} from "@/components/shared";

import { Input } from "@/components/ui";

import {
  BORROWABLE_OPTIONS,
  EQUIPMENT_CATEGORY_OPTIONS,
  EQUIPMENT_STATUS_OPTIONS,
  MOVEABLE_OPTIONS,
  SHAREABLE_OPTIONS,
} from "@/constants/equipments";

import { useDeleteEquipment } from "@/hooks/shared/resources/equipments";

import type { EquipmentRow } from "@/hooks/shared/resources/equipments";

import { useUpdateEquipment } from "@/hooks/shared/resources/equipments";

import { useRoomOptions } from "@/hooks/shared/resources/rooms";

const INVENTORY_MODAL_WIDTH_CLASS =
  "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-[50vw] sm:max-w-[960px] sm:min-w-[720px] sm:max-w-none";

type AdminEquipmentDetailDialogProps = {
  open: boolean;
  equipment: EquipmentRow | null;
  isLoading?: boolean;
  error?: string;
  canManage?: boolean;
  initialMode?: "view" | "edit";
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  onDeleted: () => void;
};

function formatStatus(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "-";
}

function isAvailableStatus(value: string) {
  return value.trim().toLowerCase() === "available";
}

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

function SelectDetailField({
  label,
  value,
  editable = false,
  options,
  onChange,
  placeholder,
  disabled,
  onValueClick,
}: {
  label: string;
  value: string;
  editable?: boolean;
  options: Array<{ value: string; label: string }>;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onValueClick?: () => void;
}) {
  if (!editable) return <DetailField label={label} value={value} onClick={onValueClick} />;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-700">{label}</p>
      <select
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        className="h-9 w-full rounded-md border border-sky-300 bg-sky-50/60 px-3 text-sm shadow-sm outline-none focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-200"
        disabled={disabled}
      >
        <option value="">
          {placeholder || `Pilih ${label.toLowerCase()}`}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AdminEquipmentDetailDialog({
  open,
  equipment,
  isLoading = false,
  error = "",
  canManage = true,
  initialMode = "view",
  onOpenChange,
  onUpdated,
  onDeleted,
}: AdminEquipmentDetailDialogProps) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [relatedRoomId, setRelatedRoomId] = useState<string | number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    quantity: "",
    category: "",
    status: "",
    roomId: "",
    isMoveable: "true",
    isShareable: "false",
    isBorrowable: "false",
    description: "",
  });
  const {
    rooms,
    isLoading: isLoadingRooms,
    error: roomError,
  } = useRoomOptions();
  const {
    updateEquipment,
    isSubmitting,
    errorMessage: updateErrorMessage,
    setErrorMessage: setUpdateErrorMessage,
  } = useUpdateEquipment();
  const {
    deleteEquipment,
    isDeleting,
    errorMessage: deleteErrorMessage,
    setErrorMessage: setDeleteErrorMessage,
  } = useDeleteEquipment();

  const roomOptions = rooms.map((room) => ({ value: room.id, label: room.label }));

  useEffect(() => {
    if (!open || !equipment) return;
    setFormData({
      name: equipment.name,
      quantity: equipment.quantity,
      category: equipment.category,
      status: equipment.status,
      roomId: equipment.roomId,
      isMoveable: String(equipment.isMoveable),
      isShareable: String(equipment.isShareable),
      isBorrowable: String(equipment.isBorrowable),
      description: equipment.description,
    });
    setIsEditing(initialMode === "edit" && canManage);
    setConfirmDeleteOpen(false);
    setUpdateErrorMessage("");
    setDeleteErrorMessage("");
  }, [canManage, equipment, initialMode, open, setDeleteErrorMessage, setUpdateErrorMessage]);

  const resetState = () => {
    setConfirmDeleteOpen(false);
    setIsEditing(false);
    setUpdateErrorMessage("");
    setDeleteErrorMessage("");
    setFormData({
      name: "",
      quantity: "",
      category: "",
      status: "",
      roomId: "",
      isMoveable: "true",
      isShareable: "false",
      isBorrowable: "false",
      description: "",
    });
  };

  const handleSave = async () => {
    if (!equipment) return;
    setUpdateErrorMessage("");

    if (!formData.name.trim())
      return setUpdateErrorMessage("Nama peralatan wajib diisi.");
    if (!formData.quantity || Number(formData.quantity) <= 0)
      return setUpdateErrorMessage("Jumlah harus lebih dari 0.");
    if (!formData.category)
      return setUpdateErrorMessage("Kategori wajib dipilih.");
    if (!formData.roomId)
      return setUpdateErrorMessage("Ruangan wajib dipilih.");

    const result = await updateEquipment(equipment.id, {
      name: formData.name,
      quantity: formData.quantity,
      category: formData.category,
      status: formData.status,
      roomId: formData.roomId,
      isMoveable: formData.isMoveable === "true",
      isShareable: formData.isShareable === "true",
      isBorrowable: formData.isBorrowable === "true",
      description: formData.description,
    });
    if (!result.ok) return;

    setIsEditing(false);
    onUpdated();
    toast.success("Peralatan berhasil diperbarui.");
  };

  const handleDelete = async () => {
    if (!equipment) return;
    setDeleteErrorMessage("");
    const result = await deleteEquipment(equipment.id);
    if (!result.ok) return;
    setConfirmDeleteOpen(false);
    onDeleted();
    onOpenChange(false);
    resetState();
    toast.success("Peralatan berhasil dihapus.");
  };

  const handleToggleAvailability = async (nextChecked: boolean) => {
    if (!equipment) return;
    setUpdateErrorMessage("");

    const result = await updateEquipment(equipment.id, {
      name: equipment.name,
      quantity: equipment.quantity,
      category: equipment.category,
      roomId: equipment.roomId,
      status: nextChecked ? "Available" : "In Storage",
      isMoveable: equipment.isMoveable,
      isShareable: equipment.isShareable,
      isBorrowable: equipment.isBorrowable,
      description: equipment.description,
    });
    if (!result.ok) return;

    onUpdated();
    toast.success(`Status peralatan diubah menjadi ${nextChecked ? "Available" : "In Storage"}.`);
  };

  return (
    <AdminDetailDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseReset={() => {
        resetState();
        setRelatedRoomId(null);
      }}
      title="Detail Peralatan"
      description="Tinjau informasi peralatan dan lakukan perubahan bila diperlukan."
      icon={<Wrench className="h-5 w-5" />}
      contentClassName={`${INVENTORY_MODAL_WIDTH_CLASS} max-h-[90vh] min-w-0 gap-0 overflow-hidden p-0`}
    >
        <div className="space-y-4 px-5 py-4 sm:px-6">
          {error ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : isLoading ? (
            <div className="space-y-4">
            <div className="rounded-xl border bg-slate-50/80 px-4 py-3">
              <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-4 w-32 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                  <div className="h-10 animate-pulse rounded bg-slate-100" />
                </div>
              ))}
            </div>
            </div>
          ) : !equipment ? (
            <div className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground">
              Data peralatan tidak ditemukan.
            </div>
          ) : (
            <div className="max-h-[calc(90vh-7rem)] overflow-y-auto pr-1 pb-2">
              <div className="space-y-4">
                <div className="rounded-xl border bg-slate-50/80 px-4 py-3">
                <p className="text-lg font-semibold text-slate-900">
                  {equipment.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatStatus(equipment.status)}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <DetailField
                  label="Nama"
                  value={isEditing ? formData.name : equipment.name}
                  editable={isEditing}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, name: value }))
                  }
                />
                <DetailField
                  label="Jumlah"
                  value={isEditing ? formData.quantity : equipment.quantity}
                  editable={isEditing}
                  type="number"
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, quantity: value }))
                  }
                />
                <SelectDetailField
                  label="Kategori"
                  value={isEditing ? formData.category : equipment.category}
                  editable={isEditing}
                  options={EQUIPMENT_CATEGORY_OPTIONS}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, category: value }))
                  }
                />
                <SelectDetailField
                  label="Status"
                  value={isEditing ? formData.status : equipment.status}
                  editable={isEditing}
                  options={EQUIPMENT_STATUS_OPTIONS}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
                />
                <SelectDetailField
                  label="Ruangan"
                  value={isEditing ? formData.roomId : equipment.roomName}
                  editable={isEditing}
                  options={roomOptions}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, roomId: value }))
                  }
                  placeholder={
                    isLoadingRooms ? "Memuat ruangan..." : "Pilih ruangan"
                  }
                  disabled={isLoadingRooms}
                  onValueClick={
                    !isEditing && equipment.roomId
                      ? () => setRelatedRoomId(equipment.roomId)
                      : undefined
                  }
                />
                {roomError ? (
                  <p className="text-xs text-destructive md:col-span-2">
                    {roomError}
                  </p>
                ) : null}
                <SelectDetailField
                  label="Moveable"
                  value={
                    isEditing
                      ? formData.isMoveable
                      : equipment.isMoveable
                        ? "Ya"
                        : "Tidak"
                  }
                  editable={isEditing}
                  options={MOVEABLE_OPTIONS}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, isMoveable: value }))
                  }
                />
                <SelectDetailField
                  label="Shareable"
                  value={
                    isEditing
                      ? formData.isShareable
                      : equipment.isShareable
                        ? "Ya"
                        : "Tidak"
                  }
                  editable={isEditing}
                  options={SHAREABLE_OPTIONS}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, isShareable: value }))
                  }
                />
                <SelectDetailField
                  label="Borrowable (Dapat Dipinjam)"
                  value={
                    isEditing
                      ? formData.isBorrowable
                      : equipment.isBorrowable
                        ? "Ya"
                        : "Tidak"
                  }
                  editable={isEditing}
                  options={BORROWABLE_OPTIONS}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, isBorrowable: value }))
                  }
                />
                {!isEditing ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-700">Available</p>
                    <label className="inline-flex items-center gap-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isAvailableStatus(equipment.status)}
                        aria-label={`Ubah status available untuk ${equipment.name}`}
                        onClick={() => void handleToggleAvailability(!isAvailableStatus(equipment.status))}
                        disabled={isSubmitting}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                          isAvailableStatus(equipment.status) ? "bg-emerald-500" : "bg-slate-300"
                        } ${isSubmitting ? "cursor-not-allowed opacity-60" : ""}`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                            isAvailableStatus(equipment.status) ? "translate-x-5" : "translate-x-1"
                          }`}
                        />
                      </button>
                      <span className="text-sm text-slate-700">
                        {isAvailableStatus(equipment.status) ? "Aktif" : "Nonaktif"}
                      </span>
                    </label>
                  </div>
                ) : null}

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
                      {equipment.description || "-"}
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
                  deleteLabel="Hapus Peralatan"
                  onEdit={() => setIsEditing(true)}
                  onCancelEdit={() => {
                    setIsEditing(false);
                    setUpdateErrorMessage("");
                    setFormData({
                      name: equipment.name,
                      quantity: equipment.quantity,
                      category: equipment.category,
                      status: equipment.status,
                      roomId: equipment.roomId,
                      isMoveable: String(equipment.isMoveable),
                      isShareable: String(equipment.isShareable),
                      isBorrowable: String(equipment.isBorrowable),
                      description: equipment.description,
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
                      title="Hapus peralatan?"
                      description={`Peralatan ${equipment.name} akan dihapus.`}
                      isDeleting={isDeleting}
                      onConfirm={() => void handleDelete()}
                    />
              ) : null}
              </div>
            </div>
          )}
        </div>

      <RelatedRoomDetailDialog
        open={Boolean(relatedRoomId)}
        roomId={relatedRoomId}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setRelatedRoomId(null);
        }}
      />
    </AdminDetailDialogShell>
  );
}
