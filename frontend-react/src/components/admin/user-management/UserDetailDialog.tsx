"use client";

import { useEffect, useState } from "react";

import { CheckCircle2, UserRound, XCircle } from "lucide-react";

import { toast } from "sonner";

import { AdminDetailActions, AdminDetailDialogShell } from "@/components/shared";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
} from "@/components/ui";

import { BATCH_VALUES } from "@/constants/batches";

import { DEPARTMENT_VALUES } from "@/constants/departments";

import { ROLE_OPTIONS, normalizeRoleValue } from "@/constants/roles";

import { USER_TYPE_LABELS } from "@/constants/user-types";

import { useUpdateUserProfile } from "@/hooks/shared/resources/users";

import { getUserInitials, type UserRow } from "@/hooks/shared/resources/users";
import { usersService } from "@/services/shared/resources";

import {
  applyUpdatedUser,
  createEmptyUserForm,
  getVisibleUserFields,
  mapUserToForm,
  toUpdateUserPayload,
  type UserDetailMode,
  USER_MODAL_WIDTH_CLASS,
} from "@/components/admin/user-management";

function getUserStatusPresentation(user: UserRow) {
  const isGuest = String(user.role).trim().toLowerCase() === "guest";

  if (isGuest && !user.isVerified) {
    return {
      label: "Belum dikonfirmasi",
      className: "bg-amber-500/10 text-amber-700",
      icon: <XCircle className="h-4 w-4" />,
    };
  }

  if (user.lastLogin) {
    return {
      label: "Sudah Login",
      className: "bg-emerald-500/10 text-emerald-700",
      icon: <CheckCircle2 className="h-4 w-4" />,
    };
  }

  return {
    label: "Belum Login",
    className: "bg-slate-500/10 text-slate-700",
    icon: <XCircle className="h-4 w-4" />,
  };
}

type UserDetailDialogProps = {
  open: boolean;
  user: UserRow | null;
  error?: string;
  mode: UserDetailMode;
  canManageUsers: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteRequest: (user: UserRow) => void;
  onUserUpdated: (user: UserRow) => void;
};

export default function UserDetailDialog({
  open,
  user,
  error = "",
  mode,
  canManageUsers,
  onOpenChange,
  onDeleteRequest,
  onUserUpdated,
}: UserDetailDialogProps) {
  const { updateUserProfile, isSubmitting, message, setMessage } = useUpdateUserProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingUser, setIsConfirmingUser] = useState(false);
  const [confirmUserOpen, setConfirmUserOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [form, setForm] = useState(createEmptyUserForm());

  useEffect(() => {
    if (!user) return;
    setForm(mapUserToForm(user));
    setIsEditing(mode === "edit" && canManageUsers);
    setErrorMessage("");
    setMessage("");
  }, [canManageUsers, mode, setMessage, user]);

  const visibleFields = getVisibleUserFields(form.role || user?.role || "");
  const openedInEditMode = mode === "edit";
  const showDeleteAction = canManageUsers && !openedInEditMode && !isEditing;
  const status = user ? getUserStatusPresentation(user) : null;
  const showConfirmUserAction =
    canManageUsers && !openedInEditMode && !isEditing && Boolean(user?.hasUser && !user.isVerified);

  const handleSave = async () => {
    if (!user?.profileId) {
      setErrorMessage("Profile ID tidak ditemukan.");
      return;
    }

    try {
      const updated = await updateUserProfile(user.profileId, toUpdateUserPayload(form));
      onUserUpdated(applyUpdatedUser(user, form, updated));
      setIsEditing(false);
      setErrorMessage("");
      toast.success("User berhasil diperbarui.");
    } catch (saveError) {
      setErrorMessage(
        saveError instanceof Error ? saveError.message : "Gagal update user.",
      );
    }
  };

  const handleConfirmUser = async () => {
    if (!user?.profileId) {
      setErrorMessage("Profile ID tidak ditemukan.");
      return;
    }

    setIsConfirmingUser(true);
    setErrorMessage("");

    try {
      const result = await usersService.confirmUser(user.profileId);
      if (!result.ok) {
        const detail =
          typeof (result.data as { detail?: unknown } | undefined)?.detail === "string"
            ? String((result.data as { detail?: string }).detail)
            : `Gagal mengonfirmasi user (${result.status})`;
        throw new Error(detail);
      }

      onUserUpdated({ ...user, isVerified: true });
      setConfirmUserOpen(false);
      toast.success("User berhasil dikonfirmasi.");
    } catch (confirmError) {
      setErrorMessage(
        confirmError instanceof Error ? confirmError.message : "Gagal mengonfirmasi user.",
      );
    } finally {
      setIsConfirmingUser(false);
    }
  };

  return (
    <AdminDetailDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseReset={() => {
        setIsEditing(false);
        setErrorMessage("");
        setMessage("");
      }}
      title="Detail User"
      description="Tinjau informasi user dan lakukan perubahan bila diperlukan."
      icon={<UserRound className="h-5 w-5" />}
      contentClassName={`${USER_MODAL_WIDTH_CLASS} gap-0 p-0 [--primary:#0048B4] [--primary-foreground:#FFFFFF] [--ring:#3B82F6]`}
    >
        <div className="space-y-4 px-5 py-4 sm:px-6">
          {error ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {open && !user && !error ? <UserDetailSkeleton /> : null}

          {user ? (
            <div className="space-y-4">
            <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-lg font-semibold uppercase">
                  {getUserInitials(user)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-slate-900">{user.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>

              <span
                className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-sm ${status?.className ?? "bg-slate-500/10 text-slate-700"}`}
              >
                {status?.icon}
                {status?.label ?? "-"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DetailField
                label="Nama"
                value={form.full_name}
                editable={isEditing && canManageUsers}
                onChange={(value) => setForm((prev) => ({ ...prev, full_name: value }))}
              />
              <DetailField label="Email" value={user.email} editable={false} onChange={() => undefined} />
              <DetailField
                label="Status"
                value={status?.label ?? "-"}
                editable={false}
                onChange={() => undefined}
              />
              <DetailField
                label="Inisial"
                value={form.initials}
                editable={isEditing && canManageUsers}
                onChange={(value) => setForm((prev) => ({ ...prev, initials: value.slice(0, 3) }))}
              />
              <DetailSelect
                label="Role"
                value={form.role}
                editable={isEditing && canManageUsers}
                options={ROLE_OPTIONS.filter((opt) => opt.value).map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...createEmptyUserForm(value),
                    full_name: prev.full_name,
                    initials: prev.initials,
                  }))
                }
              />
              {normalizeRoleValue(form.role) === "Lecturer" ? (
                <DetailCheckbox
                  label="Dosen Pembimbing"
                  checked={form.is_mentor}
                  editable={isEditing && canManageUsers}
                  onChange={(checked) =>
                    setForm((prev) => ({ ...prev, is_mentor: checked }))
                  }
                />
              ) : null}
              <DetailField
                label="User Type"
                value={USER_TYPE_LABELS[user.userType as keyof typeof USER_TYPE_LABELS] ?? user.userType}
                editable={false}
                onChange={() => undefined}
              />
              {visibleFields.department ? (
                <DetailSelect
                  label="Department"
                  value={form.department}
                  editable={isEditing && canManageUsers}
                  options={DEPARTMENT_VALUES.map((value) => ({ value, label: value }))}
                  onChange={(value) => setForm((prev) => ({ ...prev, department: value }))}
                />
              ) : null}
              {visibleFields.batch ? (
                <DetailSelect
                  label="Batch"
                  value={form.batch}
                  editable={isEditing && canManageUsers}
                  options={BATCH_VALUES.map((value) => ({ value, label: value }))}
                  onChange={(value) => setForm((prev) => ({ ...prev, batch: value }))}
                />
              ) : null}
              {visibleFields.idNumber ? (
                <DetailField
                  label="ID Number"
                  value={form.id_number}
                  editable={isEditing && canManageUsers}
                  onChange={(value) => setForm((prev) => ({ ...prev, id_number: value }))}
                />
              ) : null}
              {visibleFields.institution ? (
                <DetailField
                  label="Institusi"
                  value={form.institution}
                  editable={isEditing && canManageUsers}
                  onChange={(value) => setForm((prev) => ({ ...prev, institution: value }))}
                />
              ) : null}
            </div>

            {errorMessage ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}
            {message ? (
              <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                {message}
              </div>
            ) : null}

            {canManageUsers ? (
              <AdminDetailActions
                isEditing={isEditing}
                isSubmitting={isSubmitting || isConfirmingUser}
                showDeleteAction={showDeleteAction}
                deleteLabel="Hapus User"
                extraActions={
                  showConfirmUserAction ? (
                    <Button
                      type="button"
                      onClick={() => setConfirmUserOpen(true)}
                      disabled={isSubmitting || isConfirmingUser}
                    >
                      Konfirmasi User
                    </Button>
                  ) : null
                }
                onEdit={() => setIsEditing(true)}
                onCancelEdit={() => {
                  setIsEditing(false);
                  setErrorMessage("");
                  if (openedInEditMode) onOpenChange(false);
                }}
                onSave={() => void handleSave()}
                onDelete={() => onDeleteRequest(user)}
              />
            ) : null}
            </div>
          ) : null}
        </div>
      <AlertDialog open={confirmUserOpen} onOpenChange={setConfirmUserOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi user ini?</AlertDialogTitle>
            <AlertDialogDescription>
              {user
                ? `Email untuk ${user.name || user.email} akan ditandai sebagai sudah terkonfirmasi.`
                : "Email user akan ditandai sebagai sudah terkonfirmasi."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirmingUser}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmUser()}
              disabled={isConfirmingUser}
            >
              {isConfirmingUser ? "Mengonfirmasi..." : "Konfirmasi User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminDetailDialogShell>
  );
}

function DetailField({
  label,
  value,
  editable,
  onChange,
}: {
  label: string;
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-700">{label}</label>
      {editable ? (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
        />
      ) : (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {value || "-"}
        </div>
      )}
    </div>
  );
}

function DetailSelect({
  label,
  value,
  editable,
  options,
  onChange,
}: {
  label: string;
  value: string;
  editable: boolean;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-700">{label}</label>
      {editable ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-full rounded-md border border-sky-300 bg-sky-50/60 px-3 text-sm shadow-sm outline-none focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-200"
        >
          <option value="">Pilih {label.toLowerCase()}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {value || "-"}
        </div>
      )}
    </div>
  );
}

function DetailCheckbox({
  label,
  checked,
  editable,
  onChange,
}: {
  label: string;
  checked: boolean;
  editable: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-700">{label}</p>
      {editable ? (
        <label className="flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 text-sm">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <span>{checked ? "Aktif" : "Tidak aktif"}</span>
        </label>
      ) : (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {checked ? "Aktif" : "Tidak aktif"}
        </div>
      )}
    </div>
  );
}

function UserDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 animate-pulse rounded-full bg-slate-200" />
          <div className="space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-52 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
        <div className="h-8 w-28 animate-pulse rounded-full bg-slate-100" />
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
  );
}
