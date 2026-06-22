"use client";


import { useEffect, useState, type ReactNode } from "react";

import { usePathname, useRouter } from "next/navigation";

import { BatchInput } from "@/components/shared";

import { Button, Input } from "@/components/ui";

import { DEPARTMENT_VALUES } from "@/constants/departments";

import { useLoadProfile } from "@/hooks/shared/profile";

import { useUpdateMyProfile } from "@/hooks/shared/profile";

import { formatDateTimeIdWithZone } from "@/lib/date";

import { formatRoleLabel, getInitialsFromNameOrEmail } from "@/lib/text";

type ProfileFormData = {
  full_name: string;
  initials: string;
  department: string;
  batch: string;
  id_number: string;
  institution: string;
};

function getVisibleProfileFields(role: string | null | undefined) {
  const normalizedRole = (role || "").toLowerCase();

  if (normalizedRole === "student") {
    return { department: true, batch: true, idNumber: true };
  }
  if (normalizedRole === "lecturer") {
    return { department: true, batch: false, idNumber: true };
  }
  if (normalizedRole === "staff" || normalizedRole === "staf") {
    return { department: false, batch: false, idNumber: true };
  }
  if (normalizedRole === "admin") {
    return { department: false, batch: false, idNumber: false };
  }
  if (normalizedRole === "guest") {
    return { department: false, batch: false, idNumber: false };
  }

  return { department: true, batch: true, idNumber: true };
}

export default function MyProfilePage() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useLoadProfile();
  const { updateMyProfile, isSubmitting, message, setMessage } =
    useUpdateMyProfile();

  const isEditing = pathname === "/my-profile/edit";
  const [formData, setFormData] = useState<ProfileFormData>({
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
    setMessage("");
    setFormData({
      full_name: profile.name || "",
      initials: profile.initials || "",
      department: profile.department || "",
      batch: profile.batch ? String(profile.batch) : "",
      id_number: profile.id_number || "",
      institution: profile.institution || "",
    });
    router.push("/my-profile");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.full_name.trim()) {
      setMessage("Nama wajib diisi.");
      return;
    }

    if (!profile.id) {
      setMessage("ID profile tidak ditemukan.");
      return;
    }

    const success = await updateMyProfile(profile.id, {
      full_name: formData.full_name.trim(),
      initials: formData.initials.trim(),
      department: formData.department || null,
      batch: formData.batch || null,
      id_number: formData.id_number || null,
      institution: formData.institution || null,
    });

    if (success) router.push("/my-profile");
  };

  const displayProfile = {
    name: isEditing ? formData.full_name : profile.name,
    initials: isEditing ? formData.initials : profile.initials,
    department: isEditing ? formData.department : profile.department,
    batch: isEditing ? formData.batch : profile.batch,
    id_number: isEditing ? formData.id_number : profile.id_number,
    institution: isEditing ? formData.institution : profile.institution,
  };
  const visibleFields = getVisibleProfileFields(profile.role);

  const initials =
    displayProfile.initials ||
    getInitialsFromNameOrEmail(displayProfile.name, profile.email);

  return (
    <section className="w-full min-w-0 overflow-x-hidden">
      <div className="w-full">
        <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="h-1 w-full bg-gradient-to-r from-[#0048B4] via-[#2B74E8] to-[#8DB8FF]" />
          <div className="flex items-center gap-3 p-4 md:p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-base font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-slate-900">
                {displayProfile.name || "-"}
              </p>
              <p className="truncate text-sm text-slate-500">{profile.email || "-"}</p>
            </div>
            <span className="ml-auto inline-flex rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {formatRoleLabel(profile.role)}
            </span>
          </div>
        </div>

        <form
          className="space-y-4 rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/70 to-white p-4 md:p-5"
          onSubmit={handleSubmit}
        >
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

            {visibleFields.department &&
              (isEditing ? (
                <EditRow label="Department">
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus-visible:border-slate-500 focus-visible:ring-[3px] focus-visible:ring-slate-200"
                  >
                    <option value="">Pilih department</option>
                    {DEPARTMENT_VALUES.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </EditRow>
              ) : (
                <ProfileRow
                  label="Department"
                  value={displayProfile.department || "-"}
                />
              ))}

            {visibleFields.batch &&
              (isEditing ? (
                <EditRow label="Batch">
                  <BatchInput
                    name="batch"
                    value={formData.batch}
                    onChange={(value) => setFormData((prev) => ({ ...prev, batch: value }))}
                    placeholder="Pilih atau ketik batch"
                    className="border-slate-300 bg-white focus-visible:border-slate-500 focus-visible:ring-slate-200"
                  />
                </EditRow>
              ) : (
                <ProfileRow
                  label="Batch"
                  value={displayProfile.batch ? String(displayProfile.batch) : "-"}
                />
              ))}

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

            {visibleFields.idNumber &&
              (isEditing ? (
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
                <ProfileRow
                  label="ID Number"
                  value={displayProfile.id_number || "-"}
                />
              ))}

            <ProfileRow label="Role" value={formatRoleLabel(profile.role)} />
            <div className="md:col-span-2">
              <ProfileRow
                label="Last Login"
                value={formatDateTimeIdWithZone(profile.last_login)}
              />
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
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1.5 break-words text-sm font-medium text-slate-800">
        {value}
      </p>
    </div>
  );
}

function EditRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      {children}
    </div>
  );
}
