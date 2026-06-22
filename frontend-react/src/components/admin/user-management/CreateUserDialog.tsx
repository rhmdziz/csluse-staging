"use client";


import { useState } from "react";

import { Eye, EyeOff, UserPlus } from "lucide-react";

import { toast } from "sonner";

import { AdminDetailDialogShell, BatchInput, InlineErrorAlert } from "@/components/shared";

import { Button, Input, DialogFooter } from "@/components/ui";

import { BATCH_OPTIONS } from "@/constants/batches";

import { DEPARTMENT_VALUES } from "@/constants/departments";

import { ROLE_FILTER_OPTIONS, ROLE_OPTIONS, ROLE_VALUES, normalizeRoleValue } from "@/constants/roles";

import { useCreateUser } from "@/hooks/shared/resources/users";

import {
  createEmptyUserForm,
  getVisibleUserFields,
  isCampusEmail,
  requiresUserPassword,
  toCreateProfilePayload,
  toCreateUserPayload,
  USER_MODAL_WIDTH_CLASS,
} from "@/components/admin/user-management";

type CreateUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleParam: string | null;
  onCreated: () => void;
};

export default function CreateUserDialog({
  open,
  onOpenChange,
  roleParam,
  onCreated,
}: CreateUserDialogProps) {
  const normalizedRoleParam = (() => {
    if (!roleParam) return "";
    const normalizedRole = normalizeRoleValue(roleParam);
    return (ROLE_FILTER_OPTIONS as readonly string[]).includes(normalizedRole) ? normalizedRole : "";
  })();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [form, setForm] = useState(() => createEmptyUserForm(normalizedRoleParam));
  const { createUser, createProfile, isSubmitting, errorMessage, setErrorMessage } = useCreateUser();

  const visibleFields = getVisibleUserFields(form.role);
  const passwordRequired = requiresUserPassword({ email, role: form.role });
  const useDirectUserProvisioning = passwordRequired;
  const isCampusDomain = isCampusEmail(email);

  const resetState = () => {
    setShowPassword(false);
    setEmail("");
    setPassword("");
    setForm(createEmptyUserForm(normalizedRoleParam));
    setErrorMessage("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!form.full_name.trim()) return setErrorMessage("Nama wajib diisi.");
    if (!email.trim()) return setErrorMessage("Email wajib diisi.");
    if (passwordRequired && !password) {
      return setErrorMessage("Password wajib diisi untuk email non-domain kampus.");
    }

    const result = useDirectUserProvisioning
      ? await createUser(toCreateUserPayload({ email, password, form }) as never)
      : await createProfile(toCreateProfilePayload({ email, form }) as never);
    if (!result.ok) return;

    onCreated();
    onOpenChange(false);
    resetState();
    toast.success(
      useDirectUserProvisioning
        ? "Akun berhasil dibuat."
        : "Profile internal berhasil dibuat. User akan terhubung saat login Microsoft pertama.",
    );
  };

  return (
    <AdminDetailDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseReset={resetState}
      title={useDirectUserProvisioning ? "Buat Akun" : "Buat Profile Internal"}
      description={
        useDirectUserProvisioning
          ? "Tambahkan akun baru dan lengkapi password awal yang dibutuhkan."
          : "Siapkan profile terlebih dahulu. User akan dibuat saat login Microsoft pertama."
      }
      icon={<UserPlus className="h-5 w-5" />}
      contentClassName={`${USER_MODAL_WIDTH_CLASS} gap-0 p-0 [--primary:#0048B4] [--primary-foreground:#FFFFFF] [--ring:#3B82F6]`}
    >
      <form className="space-y-4 px-5 py-4 sm:px-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Nama Lengkap</label>
              <Input
                value={form.full_name}
                onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
                placeholder="Nama lengkap"
                className="border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Masukkan email"
                className="border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Inisial</label>
              <Input
                value={form.initials}
                onChange={(event) => setForm((prev) => ({ ...prev, initials: event.target.value.slice(0, 3) }))}
                placeholder="Opsional, 3 huruf"
                className="border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
                maxLength={3}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isCampusDomain ? "Password tidak diperlukan" : "Minimal 8 karakter"}
                  className="border-sky-300 bg-sky-50/60 pr-10 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-70"
                  required={passwordRequired}
                  disabled={isCampusDomain}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground disabled:pointer-events-none disabled:opacity-50"
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  disabled={isCampusDomain}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {isCampusDomain ? (
                <p className="text-[11px] text-slate-500">
                  Akun akan terhubung dengan akun outlook internal.
                </p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Role</label>
              <select
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...createEmptyUserForm(event.target.value), full_name: prev.full_name, initials: prev.initials }))}
                className="h-9 w-full rounded-md border border-sky-300 bg-sky-50/60 px-3 text-sm shadow-sm outline-none focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-200"
                disabled={Boolean(normalizedRoleParam)}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value || option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {form.role === ROLE_VALUES.LECTURER ? (
              <label className="flex items-center gap-2 rounded-md border border-sky-300 bg-sky-50/60 px-3 py-2 text-sm shadow-sm">
                <input
                  type="checkbox"
                  checked={form.is_mentor}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, is_mentor: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>Jadikan sebagai dosen pembimbing</span>
              </label>
            ) : null}

            {visibleFields.idNumber ? (
              <div className="space-y-1">
                <label className="text-xs font-medium">ID Number</label>
                <Input
                  value={form.id_number}
                  onChange={(event) => setForm((prev) => ({ ...prev, id_number: event.target.value }))}
                  placeholder="Nomor identitas"
                  className="border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
                />
              </div>
            ) : null}

            {visibleFields.department ? (
              <div className="space-y-1">
                <label className="text-xs font-medium">Department</label>
                <select
                  value={form.department}
                  onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))}
                  className="h-9 w-full rounded-md border border-sky-300 bg-sky-50/60 px-3 text-sm shadow-sm outline-none focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-200"
                >
                  <option value="">Pilih department</option>
                  {DEPARTMENT_VALUES.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {visibleFields.batch ? (
              <div className="space-y-1">
                <label className="text-xs font-medium">Batch</label>
                <BatchInput
                  value={form.batch}
                  onChange={(value) => setForm((prev) => ({ ...prev, batch: value }))}
                  options={BATCH_OPTIONS}
                  placeholder="Pilih atau ketik batch"
                  className="border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
                />
              </div>
            ) : null}

            {visibleFields.institution ? (
              <div className="space-y-1">
                <label className="text-xs font-medium">Institusi</label>
                <Input
                  value={form.institution}
                  onChange={(event) => setForm((prev) => ({ ...prev, institution: event.target.value }))}
                  placeholder="Asal institusi"
                  className="border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
                />
              </div>
            ) : null}
        </div>

        {errorMessage ? <InlineErrorAlert>{errorMessage}</InlineErrorAlert> : null}

        <DialogFooter>
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            <UserPlus className="h-4 w-4" />
            {isSubmitting ? "Menyimpan..." : useDirectUserProvisioning ? "Buat Akun" : "Buat Profile"}
          </Button>
        </DialogFooter>
      </form>
    </AdminDetailDialogShell>
  );
}
