"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

import { FlaskConical, Plus } from "lucide-react";

import { toast } from "sonner";

import { AdminDetailDialogShell, InlineErrorAlert } from "@/components/shared";

import { Button, Input, DialogFooter } from "@/components/ui";

import { MATERIAL_CATEGORY_OPTIONS } from "@/constants/materials";

import { useCreateMaterial } from "@/hooks/shared/resources/materials";

import { useRoomOptions } from "@/hooks/shared/resources/rooms";

type MaterialCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export default function MaterialCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: MaterialCreateDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    quantity: "",
    unit: "",
    category: "",
    roomId: "",
    description: "",
  });
  const { rooms, isLoading: isLoadingRooms, error: roomError } = useRoomOptions();
  const { createMaterial, isSubmitting, errorMessage, setErrorMessage } = useCreateMaterial();

  const resetForm = () => {
    setErrorMessage("");
    setFormData({
      name: "",
      quantity: "",
      unit: "",
      category: "",
      roomId: "",
      description: "",
    });
  };

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!formData.name.trim()) return setErrorMessage("Nama bahan wajib diisi.");
    if (!formData.quantity || Number(formData.quantity) <= 0) {
      return setErrorMessage("Jumlah harus lebih dari 0.");
    }
    if (!formData.category) return setErrorMessage("Kategori wajib dipilih.");

    const result = await createMaterial({
      name: formData.name,
      quantity: formData.quantity,
      unit: formData.unit,
      category: formData.category,
      roomId: formData.roomId || undefined,
      description: formData.description,
    });

    if (result.ok) {
      onCreated();
      onOpenChange(false);
      resetForm();
      toast.success("Bahan berhasil ditambahkan.");
    }
  };

  return (
    <AdminDetailDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseReset={resetForm}
      title="Tambah Bahan"
      description="Tambahkan data bahan habis pakai baru untuk inventaris laboratorium."
      icon={<FlaskConical className="h-5 w-5" />}
      contentClassName="w-[min(720px,calc(100%-2rem))] max-w-none gap-0 p-0 sm:max-w-none [--primary:#0048B4] [--primary-foreground:#FFFFFF] [--ring:#3B82F6]"
    >
      <form className="space-y-4 px-5 py-4 sm:px-6" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-xs font-medium">Nama</label>
            <Input
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Jumlah</label>
              <Input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                className="border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Satuan <span className="text-muted-foreground">(opsional)</span></label>
              <Input
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                placeholder="Contoh: ml, gram, pcs"
                className="border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Kategori</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="h-9 w-full rounded-md border border-sky-300 bg-sky-50/60 px-3 text-sm shadow-sm outline-none focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-200"
            >
              <option value="">Pilih kategori</option>
              {MATERIAL_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Ruangan <span className="text-muted-foreground">(opsional)</span></label>
            <select
              name="roomId"
              value={formData.roomId}
              onChange={handleChange}
              className="h-9 w-full rounded-md border border-sky-300 bg-sky-50/60 px-3 text-sm shadow-sm outline-none focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-200"
              disabled={isLoadingRooms}
            >
              <option value="">{isLoadingRooms ? "Memuat ruangan..." : "Pilih ruangan (opsional)"}</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.label}
                </option>
              ))}
            </select>
            {roomError ? <p className="text-xs text-destructive">{roomError}</p> : null}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Deskripsi</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full rounded-md border border-sky-300 bg-sky-50/60 px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-200"
              placeholder="Deskripsi (opsional)"
            />
          </div>

          {errorMessage ? <InlineErrorAlert>{errorMessage}</InlineErrorAlert> : null}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              <Plus className="h-4 w-4" />
              {isSubmitting ? "Menyimpan..." : "Simpan Bahan"}
            </Button>
          </DialogFooter>
      </form>
    </AdminDetailDialogShell>
  );
}
