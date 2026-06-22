"use client";


import { useEffect, useState } from "react";

import { Eye, EyeOff, ShieldCheck, UserCircle2 } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/shared";
import { BatchInput } from "@/components/shared";

import { Button, Input } from "@/components/ui";

import { API_AUTH_USER_PROFILE_DETAIL } from "@/constants/api";

import { useChangePassword } from "@/hooks/auth";

import {
  persistProfileCache,
  useLoadProfile,
} from "@/hooks/shared/profile";
import { useDepartmentOptions } from "@/hooks/shared/resources/departments";

import { authFetch } from "@/lib/auth";

import { formatDateTimeIdWithZone } from "@/lib/date";

import { formatRoleLabel, getInitialsFromNameOrEmail } from "@/lib/text";

import { toast } from "sonner";

export default function AdminMyProfilePage() {
  const { profile } = useLoadProfile();
  const { departments } = useDepartmentOptions();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const {
    formData: passwordFormData,
    status: passwordStatus,
    message: passwordMessage,
    handleChange: handlePasswordChange,
    handleSubmit: handlePasswordSubmit,
  } = useChangePassword();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [formData, setFormData] = useState({
    full_name: "",
    initials: "",
    department: "",
    batch: "",
    id_number: "",
    institution: "",
  });

  useEffect(() => {
    if (isEditing) return;
    setFormData({
      full_name: profile.name || "",
      initials: profile.initials || "",
      department: profile.department || "",
      batch: profile.batch ? String(profile.batch) : "",
      id_number: profile.id_number || "",
      institution: profile.institution || "",
    });
  }, [profile, isEditing]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCancel = () => {
    setIsEditing(false);
    setMessage("");
    setFormData({
      full_name: profile.name || "",
      initials: profile.initials || "",
      department: profile.department || "",
      batch: profile.batch ? String(profile.batch) : "",
      id_number: profile.id_number || "",
      institution: profile.institution || "",
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (!formData.full_name.trim()) {
      setMessage("Nama wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (!profile.id) {
        setMessage("ID profile tidak ditemukan.");
        setIsSubmitting(false);
        return;
      }

      const response = await authFetch(API_AUTH_USER_PROFILE_DETAIL(profile.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: formData.full_name.trim(),
          initials: formData.initials.trim(),
          department: formData.department || null,
          batch: formData.batch || null,
          id_number: formData.id_number || null,
          institution: formData.institution || null,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as
        | Record<string, unknown>
        | null;

      if (!response.ok) {
        const errorMessage =
          (typeof data?.detail === "string" && data.detail) ||
          "Gagal memperbarui profil.";
        setMessage(errorMessage);
        return;
      }

      persistProfileCache({
        ...profile,
        name: formData.full_name.trim(),
        initials: formData.initials.trim() || null,
        department: formData.department || null,
        batch: formData.batch || null,
        id_number: formData.id_number || null,
        institution: formData.institution || null,
      });

      setMessage("Profil berhasil diperbarui.");
      setIsEditing(false);
      toast.success("Profil berhasil diperbarui.");
    } catch {
      setMessage("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayProfile = {
    name: isEditing ? formData.full_name : profile.name,
    initials: isEditing ? formData.initials : profile.initials,
    department: isEditing ? formData.department : profile.department,
    batch: isEditing ? formData.batch : profile.batch,
    id_number: isEditing ? formData.id_number : profile.id_number,
    institution: isEditing ? formData.institution : profile.institution,
  };
  const initials =
    displayProfile.initials ||
    getInitialsFromNameOrEmail(displayProfile.name, profile.email);
  const roleLabel = formatRoleLabel(profile.role);
  const canChangePassword =
    String(profile.user_type || "").trim().toLowerCase() !== "internal";

  useEffect(() => {
    if (!canChangePassword) {
      setShowPasswordForm(false);
    }
  }, [canChangePassword]);

  return (
    <section className="w-full min-w-0 space-y-4 overflow-x-hidden px-4 pb-6">
      <AdminPageHeader
        title="Profil Saya"
        description="Kelola informasi akun dan keamanan Anda."
        icon={<UserCircle2 className="h-5 w-5 text-sky-200" />}
      />

      <div
        className={
          canChangePassword
            ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"
            : "grid gap-4"
        }
      >
        <div className="min-w-0 rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-xs">
          <div className="mb-3 flex items-center gap-2">
            <UserCircle2 className="h-4 w-4 text-slate-600" />
            <p className="text-sm font-semibold text-slate-900">Informasi Profil</p>
          </div>
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {displayProfile.name || "-"}
                </p>
                <p className="truncate text-xs text-slate-500">{profile.email || "-"}</p>
              </div>
              <span className="ml-auto inline-flex rounded-full border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                {roleLabel}
              </span>
            </div>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {isEditing ? (
                <EditRow label="Nama">
                  <Input
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    className="border-slate-300 focus-visible:border-slate-500 focus-visible:ring-slate-200"
                    placeholder="Masukkan nama lengkap"
                  />
                </EditRow>
              ) : (
                <ProfileRow label="Nama" value={displayProfile.name || "-"} />
              )}
              {isEditing ? (
                <EditRow label="Inisial">
                  <Input
                    name="initials"
                    value={formData.initials}
                    onChange={handleChange}
                    maxLength={3}
                    className="border-slate-300 focus-visible:border-slate-500 focus-visible:ring-slate-200"
                    placeholder="3 huruf"
                  />
                </EditRow>
              ) : (
                <ProfileRow label="Inisial" value={displayProfile.initials || "-"} />
              )}
              {/* <ProfileRow label="Email" value={profile.email || "-"} /> */}
              {isEditing ? (
                <EditRow label="Department">
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none shadow-xs focus-visible:border-slate-500 focus-visible:ring-[3px] focus-visible:ring-slate-200"
                  >
                    <option value="">Pilih department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.value}>
                        {department.label}
                      </option>
                    ))}
                  </select>
                </EditRow>
              ) : (
                <ProfileRow label="Department" value={displayProfile.department || "-"} />
              )}
              {isEditing ? (
                <EditRow label="Batch">
                  <BatchInput
                    name="batch"
                    value={formData.batch}
                    onChange={(value) => setFormData((prev) => ({ ...prev, batch: value }))}
                    placeholder="Pilih atau ketik batch"
                    className="border-slate-300 bg-white shadow-xs focus-visible:border-slate-500 focus-visible:ring-slate-200"
                  />
                </EditRow>
              ) : (
                <ProfileRow label="Batch" value={displayProfile.batch ? String(displayProfile.batch) : "-"} />
              )}
              {isEditing ? (
                <EditRow label="ID Number">
                  <Input
                    name="id_number"
                    value={formData.id_number}
                    onChange={handleChange}
                    className="border-slate-300 focus-visible:border-slate-500 focus-visible:ring-slate-200"
                    placeholder="Masukkan ID Number"
                  />
                </EditRow>
              ) : (
                <ProfileRow label="ID Number" value={displayProfile.id_number || "-"} />
              )}
              {String(profile.role || "").toLowerCase() === "guest" &&
                (isEditing ? (
                  <EditRow label="Institusi">
                    <Input
                      name="institution"
                      value={formData.institution}
                      onChange={handleChange}
                      className="border-slate-300 focus-visible:border-slate-500 focus-visible:ring-slate-200"
                      placeholder="Asal institusi"
                    />
                  </EditRow>
                ) : (
                  <ProfileRow label="Institusi" value={displayProfile.institution || "-"} />
                ))}
              <ProfileRow label="Role" value={formatRoleLabel(profile.role)} />

              <div className="md:col-span-2">
                <ProfileRow label="Last Login" value={formatDateTimeIdWithZone(profile.last_login)} />
              </div>
            </div>

            {message ? (
              <div
                className={`rounded-md border px-3 py-2 text-sm ${
                  message.includes("berhasil")
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-destructive/20 bg-destructive/5 text-destructive"
                }`}
              >
                {message}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {isEditing ? (
                <>
                  <Button type="button" variant="outline" onClick={handleCancel}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Menyimpan..." : "Simpan Profil"}
                  </Button>
                </>
              ) : (
                <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>
                  Edit Profile
                </Button>
              )}
            </div>
          </form>
        </div>

        {canChangePassword ? (
          <aside className="h-fit rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 shadow-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-600" />
              <h2 className="text-sm font-semibold text-slate-900">Keamanan Akun</h2>
            </div>
            {!showPasswordForm ? (
              <div className="mt-3 space-y-3">
                <p className="rounded-md bg-white text-sm text-slate-600">
                  Ubah password akun Anda secara berkala untuk menjaga keamanan.
                </p>
                <Button type="button" className="w-full" onClick={() => setShowPasswordForm(true)}>
                  Ganti Password
                </Button>
              </div>
            ) : (
              <form className="mt-3 space-y-3 rounded-md bg-white" onSubmit={handlePasswordSubmit}>
                <div className="space-y-1">
                  <label htmlFor="currentPassword" className="text-xs font-medium text-slate-600">
                    Password Lama
                  </label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      name="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={passwordFormData.currentPassword}
                      onChange={handlePasswordChange}
                      className="border-slate-300 pr-10 focus-visible:border-slate-500 focus-visible:ring-slate-200"
                    />
                    <button
                      type="button"
                      aria-label={
                        showCurrentPassword
                          ? "Sembunyikan password lama"
                          : "Lihat password lama"
                      }
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
                      onClick={() => setShowCurrentPassword((prev) => !prev)}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="newPassword" className="text-xs font-medium text-slate-600">
                    Password Baru
                  </label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      name="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={passwordFormData.newPassword}
                      onChange={handlePasswordChange}
                      className="border-slate-300 pr-10 focus-visible:border-slate-500 focus-visible:ring-slate-200"
                    />
                    <button
                      type="button"
                      aria-label={
                        showNewPassword
                          ? "Sembunyikan password baru"
                          : "Lihat password baru"
                      }
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="confirmPassword" className="text-xs font-medium text-slate-600">
                    Konfirmasi Password Baru
                  </label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={passwordFormData.confirmPassword}
                      onChange={handlePasswordChange}
                      className="border-slate-300 pr-10 focus-visible:border-slate-500 focus-visible:ring-slate-200"
                    />
                    <button
                      type="button"
                      aria-label={
                        showConfirmPassword
                          ? "Sembunyikan konfirmasi password"
                          : "Lihat konfirmasi password"
                      }
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {passwordMessage ? (
                  <div
                    className={`rounded-md border px-3 py-2 text-xs ${
                      passwordStatus === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-destructive/20 bg-destructive/5 text-destructive"
                    }`}
                  >
                    {passwordMessage}
                  </div>
                ) : null}

                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowPasswordForm(false)}>
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={passwordStatus === "submitting"}
                  >
                    {passwordStatus === "submitting"
                      ? "Menyimpan..."
                      : "Simpan"}
                  </Button>
                </div>
              </form>
            )}
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-900">{value}</p>
    </div>
  );
}

function EditRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {children}
    </div>
  );
}
