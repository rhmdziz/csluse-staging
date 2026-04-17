"use client";


import { useState, type ChangeEvent, type FormEvent } from "react";

import { Plus, Wrench } from "lucide-react";

import { toast } from "sonner";

import { AdminDetailDialogShell, InlineErrorAlert } from "@/components/shared";

import { Button, Input, DialogFooter } from "@/components/ui";

import { BORROWABLE_OPTIONS, EQUIPMENT_CATEGORY_OPTIONS, MOVEABLE_OPTIONS, SHAREABLE_OPTIONS, USEABLE_OPTIONS } from "@/constants/equipments";

import { useCreateEquipment } from "@/hooks/shared/resources/equipments";

import { useRoomOptions } from "@/hooks/shared/resources/rooms";

type EquipmentCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export default function EquipmentCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: EquipmentCreateDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    quantity: "",
    category: "",
    roomId: "",
    isMoveable: "true",
    isShareable: "false",
    isBorrowable: "false",
    isUseable: "false",
    description: "",
  });
  const { rooms, isLoading: isLoadingRooms, error: roomError } = useRoomOptions();
  const { createEquipment, isSubmitting, errorMessage, setErrorMessage } = useCreateEquipment();

  const resetForm = () => {
    setErrorMessage("");
    setFormData({
      name: "",
      quantity: "",
      category: "",
      roomId: "",
      isMoveable: "true",
      isShareable: "false",
      isBorrowable: "false",
      isUseable: "false",
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

    if (!formData.name.trim()) return setErrorMessage("Nama peralatan wajib diisi.");
    if (!formData.quantity || Number(formData.quantity) <= 0) {
      return setErrorMessage("Jumlah harus lebih dari 0.");
    }
    if (!formData.category) return setErrorMessage("Kategori wajib dipilih.");
    if (!formData.roomId) return setErrorMessage("Ruangan wajib dipilih.");

    const result = await createEquipment({
      name: formData.name,
      quantity: formData.quantity,
      category: formData.category,
      roomId: formData.roomId,
      isMoveable: formData.isMoveable === "true",
      isShareable: formData.isShareable === "true",
      isBorrowable: formData.isBorrowable === "true",
      isUseable: formData.isUseable === "true",
      description: formData.description,
    });

    if (result.ok) {
      onCreated();
      onOpenChange(false);
      resetForm();
      toast.success("Peralatan berhasil ditambahkan.");
    }
  };

  return (
    <AdminDetailDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseReset={resetForm}
      title="Tambah Peralatan"
      description="Tambahkan data peralatan baru untuk inventaris laboratorium."
      icon={<Wrench className="h-5 w-5" />}
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
            <label className="text-xs font-medium">Kategori</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="h-9 w-full rounded-md border border-sky-300 bg-sky-50/60 px-3 text-sm shadow-sm outline-none focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-200"
            >
              <option value="">Pilih kategori</option>
              {EQUIPMENT_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Ruangan</label>
            <select
              name="roomId"
              value={formData.roomId}
              onChange={handleChange}
              className="h-9 w-full rounded-md border border-sky-300 bg-sky-50/60 px-3 text-sm shadow-sm outline-none focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-200"
              disabled={isLoadingRooms}
            >
              <option value="">{isLoadingRooms ? "Memuat ruangan..." : "Pilih ruangan"}</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.label}
                </option>
              ))}
            </select>
            {roomError ? <p className="text-xs text-destructive">{roomError}</p> : null}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Moveable</label>
            <select
              name="isMoveable"
              value={formData.isMoveable}
              onChange={handleChange}
              className="h-9 w-full rounded-md border border-sky-300 bg-sky-50/60 px-3 text-sm shadow-sm outline-none focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-200"
            >
              <option value="">Pilih status</option>
              {MOVEABLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Shareable</label>
            <select
              name="isShareable"
              value={formData.isShareable}
              onChange={handleChange}
              className="h-9 w-full rounded-md border border-sky-300 bg-sky-50/60 px-3 text-sm shadow-sm outline-none focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-200"
            >
              <option value="">Pilih status</option>
              {SHAREABLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Borrowable (Dapat Dipinjam)</label>
            <select
              name="isBorrowable"
              value={formData.isBorrowable}
              onChange={handleChange}
              className="h-9 w-full rounded-md border border-sky-300 bg-sky-50/60 px-3 text-sm shadow-sm outline-none focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-200"
            >
              <option value="">Pilih status</option>
              {BORROWABLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Useable (Dapat Digunakan)</label>
            <select
              name="isUseable"
              value={formData.isUseable}
              onChange={handleChange}
              className="h-9 w-full rounded-md border border-sky-300 bg-sky-50/60 px-3 text-sm shadow-sm outline-none focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-200"
            >
              <option value="">Pilih status</option>
              {USEABLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              <Plus className="h-4 w-4" />
              {isSubmitting ? "Menyimpan..." : "Simpan Peralatan"}
            </Button>
          </DialogFooter>
      </form>
    </AdminDetailDialogShell>
  );
}
