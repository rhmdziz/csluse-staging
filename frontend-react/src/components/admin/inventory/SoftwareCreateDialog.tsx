"use client";


import { useState, type ChangeEvent, type FormEvent } from "react";

import { Box, Plus } from "lucide-react";

import { toast } from "sonner";

import { AdminDetailDialogShell, InlineErrorAlert } from "@/components/shared";

import { Button, DialogFooter, Input } from "@/components/ui";

import { useEquipmentOptions } from "@/hooks/shared/resources/equipments";

import { useCreateSoftware } from "@/hooks/shared/resources/softwares";

type SoftwareCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export default function SoftwareCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: SoftwareCreateDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    version: "",
    licenseInfo: "",
    licenseExpiration: "",
    equipmentId: "",
    description: "",
  });
  const {
    equipments,
    isLoading: isLoadingEquipments,
    error: equipmentError,
  } = useEquipmentOptions("", "", true, undefined, "Computer");
  const { createSoftware, isSubmitting, errorMessage, setErrorMessage } = useCreateSoftware();

  const resetForm = () => {
    setErrorMessage("");
    setFormData({
      name: "",
      version: "",
      licenseInfo: "",
      licenseExpiration: "",
      equipmentId: "",
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

    if (!formData.name.trim()) return setErrorMessage("Nama software wajib diisi.");
    if (!formData.equipmentId) return setErrorMessage("Peralatan wajib dipilih.");

    const result = await createSoftware(formData);
    if (!result.ok) return;

    onCreated();
    onOpenChange(false);
    resetForm();
    toast.success("Software berhasil ditambahkan.");
  };

  return (
    <AdminDetailDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseReset={resetForm}
      title="Tambah Software"
      description="Tambahkan data software baru untuk inventaris laboratorium."
      icon={<Box className="h-5 w-5" />}
      contentClassName="w-[min(720px,calc(100%-2rem))] max-w-none gap-0 p-0 sm:max-w-none [--primary:#0048B4] [--primary-foreground:#FFFFFF] [--ring:#3B82F6]"
    >
      <form className="space-y-4 px-5 py-4 sm:px-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            <label className="text-xs font-medium">Versi</label>
            <Input
              name="version"
              value={formData.version}
              onChange={handleChange}
              className="border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Lisensi</label>
            <Input
              name="licenseInfo"
              value={formData.licenseInfo}
              onChange={handleChange}
              className="border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Expired</label>
            <Input
              type="date"
              name="licenseExpiration"
              value={formData.licenseExpiration}
              onChange={handleChange}
              className="border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium">Peralatan</label>
            <select
              name="equipmentId"
              value={formData.equipmentId}
              onChange={handleChange}
              className="h-9 w-full rounded-md border border-sky-300 bg-sky-50/60 px-3 text-sm shadow-sm outline-none focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-200"
              disabled={isLoadingEquipments}
            >
              <option value="">
                {isLoadingEquipments ? "Memuat peralatan..." : "Pilih peralatan"}
              </option>
              {equipments.map((equipment) => (
                <option key={equipment.id} value={equipment.id}>
                  {equipment.label}
                </option>
              ))}
            </select>
            {equipmentError ? <p className="text-xs text-destructive">{equipmentError}</p> : null}
          </div>

          <div className="space-y-1 md:col-span-2">
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
        </div>

        {errorMessage ? <InlineErrorAlert>{errorMessage}</InlineErrorAlert> : null}

        <DialogFooter>
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            <Plus className="h-4 w-4" />
            {isSubmitting ? "Menyimpan..." : "Simpan Software"}
          </Button>
        </DialogFooter>
      </form>
    </AdminDetailDialogShell>
  );
}
