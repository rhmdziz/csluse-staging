"use client";

import { useEffect, useState } from "react";

import { ArrowUpRight, FlaskConical } from "lucide-react";

import { toast } from "sonner";

import { RelatedRoomDetailDialog } from "@/components/admin/history";

import {
  AdminDetailActions,
  AdminDetailDialogShell,
  ConfirmDeleteDialog,
  InlineErrorAlert,
} from "@/components/shared";

import { Input } from "@/components/ui";

import { MATERIAL_CATEGORY_OPTIONS, MATERIAL_STATUS_OPTIONS } from "@/constants/materials";

import { useDeleteMaterial } from "@/hooks/shared/resources/materials";

import type { MaterialRow } from "@/hooks/shared/resources/materials";

import { useUpdateMaterial } from "@/hooks/shared/resources/materials";

import { useRoomOptions } from "@/hooks/shared/resources/rooms";

const INVENTORY_MODAL_WIDTH_CLASS =
  "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-[50vw] sm:max-w-[960px] sm:min-w-[720px] sm:max-w-none";

type AdminMaterialDetailDialogProps = {
  open: boolean;
  material: MaterialRow | null;
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

function DetailField({
  label,
  value,
  editable = false,
  onChange,
  type = "text",
  onClick,
  placeholder,
}: {
  label: string;
  value: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  type?: "text" | "number";
  onClick?: () => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-700">{label}</p>
      {editable ? (
        <Input
          type={type}
          value={value}
          placeholder={placeholder}
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

export default function AdminMaterialDetailDialog({
  open,
  material,
  isLoading = false,
  error = "",
  canManage = true,
  initialMode = "view",
  onOpenChange,
  onUpdated,
  onDeleted,
}: AdminMaterialDetailDialogProps) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [relatedRoomId, setRelatedRoomId] = useState<string | number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    quantity: "",
    unit: "",
    category: "",
    status: "",
    roomId: "",
    description: "",
  });
  const {
    rooms,
    isLoading: isLoadingRooms,
    error: roomError,
  } = useRoomOptions();
  const {
    updateMaterial,
    isSubmitting,
    errorMessage: updateErrorMessage,
    setErrorMessage: setUpdateErrorMessage,
  } = useUpdateMaterial();
  const {
    deleteMaterial,
    isDeleting,
    errorMessage: deleteErrorMessage,
    setErrorMessage: setDeleteErrorMessage,
  } = useDeleteMaterial();

  const roomOptions = rooms.map((room) => ({ value: room.id, label: room.label }));

  useEffect(() => {
    if (!open || !material) return;
    setFormData({
      name: material.name,
      quantity: material.quantity,
      unit: material.unit,
      category: material.category,
      status: material.status,
      roomId: material.roomId,
      description: material.description,
    });
    setIsEditing(initialMode === "edit" && canManage);
    setConfirmDeleteOpen(false);
    setUpdateErrorMessage("");
    setDeleteErrorMessage("");
  }, [canManage, material, initialMode, open, setDeleteErrorMessage, setUpdateErrorMessage]);

  const resetState = () => {
    setConfirmDeleteOpen(false);
    setIsEditing(false);
    setUpdateErrorMessage("");
    setDeleteErrorMessage("");
    setFormData({
      name: "",
      quantity: "",
      unit: "",
      category: "",
      status: "",
      roomId: "",
      description: "",
    });
  };

  const handleSave = async () => {
    if (!material) return;
    setUpdateErrorMessage("");

    if (!formData.name.trim())
      return setUpdateErrorMessage("Nama bahan wajib diisi.");
    if (!formData.quantity || Number(formData.quantity) <= 0)
      return setUpdateErrorMessage("Jumlah harus lebih dari 0.");
    if (!formData.category)
      return setUpdateErrorMessage("Kategori wajib dipilih.");

    const result = await updateMaterial(material.id, {
      name: formData.name,
      quantity: formData.quantity,
      unit: formData.unit,
      category: formData.category,
      status: formData.status,
      roomId: formData.roomId || undefined,
      description: formData.description,
    });
    if (!result.ok) return;

    setIsEditing(false);
    onUpdated();
    toast.success("Bahan berhasil diperbarui.");
  };

  const handleDelete = async () => {
    if (!material) return;
    setDeleteErrorMessage("");
    const result = await deleteMaterial(material.id);
    if (!result.ok) return;
    setConfirmDeleteOpen(false);
    onDeleted();
    onOpenChange(false);
    resetState();
    toast.success("Bahan berhasil dihapus.");
  };

  return (
    <AdminDetailDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseReset={() => {
        resetState();
        setRelatedRoomId(null);
      }}
      title="Detail Bahan"
      description="Tinjau informasi bahan dan lakukan perubahan bila diperlukan."
      icon={<FlaskConical className="h-5 w-5" />}
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
          ) : !material ? (
            <div className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground">
              Data bahan tidak ditemukan.
            </div>
          ) : (
            <div className="max-h-[calc(90vh-7rem)] overflow-y-auto pr-1 pb-2">
              <div className="space-y-4">
                <div className="rounded-xl border bg-slate-50/80 px-4 py-3">
                <p className="text-lg font-semibold text-slate-900">
                  {material.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatStatus(material.status)}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <DetailField
                  label="Nama"
                  value={isEditing ? formData.name : material.name}
                  editable={isEditing}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, name: value }))
                  }
                />
                <DetailField
                  label="Jumlah"
                  value={isEditing ? formData.quantity : material.quantity}
                  editable={isEditing}
                  type="number"
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, quantity: value }))
                  }
                />
                <DetailField
                  label="Satuan"
                  value={isEditing ? formData.unit : (material.unit || "-")}
                  editable={isEditing}
                  placeholder="Contoh: ml, gram, pcs"
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, unit: value }))
                  }
                />
                <SelectDetailField
                  label="Kategori"
                  value={isEditing ? formData.category : material.category}
                  editable={isEditing}
                  options={MATERIAL_CATEGORY_OPTIONS}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, category: value }))
                  }
                />
                <SelectDetailField
                  label="Status"
                  value={isEditing ? formData.status : material.status}
                  editable={isEditing}
                  options={MATERIAL_STATUS_OPTIONS}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
                />
                <SelectDetailField
                  label="Ruangan"
                  value={isEditing ? formData.roomId : material.roomName}
                  editable={isEditing}
                  options={roomOptions}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, roomId: value }))
                  }
                  placeholder={
                    isLoadingRooms ? "Memuat ruangan..." : "Pilih ruangan (opsional)"
                  }
                  disabled={isLoadingRooms}
                  onValueClick={
                    !isEditing && material.roomId
                      ? () => setRelatedRoomId(material.roomId)
                      : undefined
                  }
                />
                {roomError ? (
                  <p className="text-xs text-destructive md:col-span-2">
                    {roomError}
                  </p>
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
                      {material.description || "-"}
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
                  deleteLabel="Hapus Bahan"
                  onEdit={() => setIsEditing(true)}
                  onCancelEdit={() => {
                    setIsEditing(false);
                    setUpdateErrorMessage("");
                    setFormData({
                      name: material.name,
                      quantity: material.quantity,
                      unit: material.unit,
                      category: material.category,
                      status: material.status,
                      roomId: material.roomId,
                      description: material.description,
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
                      title="Hapus bahan?"
                      description={`Bahan ${material.name} akan dihapus.`}
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
