"use client";


import { useEffect, useMemo, useState } from "react";

import { Loader2 } from "lucide-react";

import { useParams, useRouter, useSearchParams } from "next/navigation";

import { toast } from "sonner";

import {
  SubmissionConfirmDialog,
  SubmissionSummaryItem,
} from "@/components/dialogs";

import {
  DashboardComboboxField,
  DashboardDateTimePickerField,
  combineDateTime,
  getMinSelectableTime,
  isSameCalendarDay,
  startOfToday,
  type SelectOption,
} from "@/components/shared";

import { Button, Input } from "@/components/ui";
import { ROLE_VALUES, normalizeRoleValue } from "@/constants/roles";

import { useEquipmentOptions } from "@/hooks/shared/resources/equipments";

import { useLoadProfile } from "@/hooks/shared/profile";

import { useMentorOptions } from "@/hooks/shared/resources/users";

import { useCreateUse, useUseDetail } from "@/hooks/use-equipment";

import {
  canAccessPracticumPurpose,
  canAccessThesisPurpose,
  getRequestPurposeOptions,
  THESIS_PURPOSE,
} from "@/constants/request-purpose";

import {
  formatLocalDateTimeAsWib,
  toWibIsoString,
  toWibLocalDateTimeParts,
} from "@/lib/date";

type FormData = {
  equipmentId: string;
  quantity: string;
  purpose: string;
  startTime: string;
  endTime: string;
  note: string;
  requesterPhone: string;
  requesterMentor: string;
  requesterMentorProfileId: string;
  institution: string;
  institutionAddress: string;
};

const initialFormData: FormData = {
  equipmentId: "",
  quantity: "1",
  purpose: "Penelitian",
  startTime: "",
  endTime: "",
  note: "",
  requesterPhone: "",
  requesterMentor: "",
  requesterMentorProfileId: "",
  institution: "",
  institutionAddress: "",
};

type UseFormParams = {
  id?: string;
};

function sanitizeFormValue(value?: string | null) {
  const normalized = String(value ?? "").trim();
  return normalized === "-" ? "" : normalized;
}

export default function UseEquipmentFormPage() {
  const { id } = useParams<UseFormParams>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const useId = typeof id === "string" ? id : "";
  const isEditMode = useId.length > 0;
  const today = useMemo(() => startOfToday(), []);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const { profile } = useLoadProfile();
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [endTime, setEndTime] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const normalizedRole = normalizeRoleValue(profile.role);
  const isGuestUser = normalizedRole === ROLE_VALUES.GUEST;
  const canSelectPracticumPurpose = canAccessPracticumPurpose(profile.role);
  const canSelectThesisPurpose = canAccessThesisPurpose(profile.role);
  const isThesisPurpose = formData.purpose === THESIS_PURPOSE;
  const {
    equipments,
    isLoading: isLoadingEquipments,
    error: equipmentError,
  } = useEquipmentOptions(isEditMode ? "" : "Available", "", true, undefined, "", undefined, true);
  const {
    mentors,
    isLoading: isLoadingMentors,
    error: mentorError,
  } = useMentorOptions(!isGuestUser && isThesisPurpose);
  const {
    useItem,
    isLoading: isLoadingUseDetail,
    error: useDetailError,
  } = useUseDetail(useId, 0, { enabled: isEditMode });
  const {
    createUse,
    updateUse,
    isSubmitting,
    errorMessage,
    setErrorMessage,
  } = useCreateUse();
  const preselectedEquipmentId = searchParams.get("equipment") ?? "";
  const availablePurposeOptions = useMemo(
    () =>
      getRequestPurposeOptions({
        includePracticum: canSelectPracticumPurpose,
        includeWorkshop: false,
        includeThesis: canSelectThesisPurpose,
      }),
    [canSelectPracticumPurpose, canSelectThesisPurpose],
  );

  const minEndDate = startDate ? new Date(startDate) : new Date(today);
  if (minEndDate) {
    minEndDate.setHours(0, 0, 0, 0);
  }
  const minEndTime =
    startDate && endDate && isSameCalendarDay(startDate, endDate)
      ? startTime || undefined
      : undefined;
  const minStartTime = getMinSelectableTime(startDate, today);

  const selectedEquipmentLabel = useMemo(
    () => equipments.find((equipment) => equipment.id === formData.equipmentId)?.label ?? "-",
    [equipments, formData.equipmentId],
  );
  const equipmentOptions = useMemo<SelectOption[]>(
    () =>
      equipments.map((equipment) => ({
        value: equipment.id,
        label: equipment.label,
      })),
    [equipments],
  );
  const mentorOptions = useMemo<SelectOption[]>(
    () => mentors.map((mentor) => ({ value: mentor.id, label: mentor.label })),
    [mentors],
  );

  useEffect(() => {
    if (!preselectedEquipmentId || formData.equipmentId) return;
    if (isEditMode) return;
    if (!equipments.some((equipment) => equipment.id === preselectedEquipmentId)) return;
    setFormData((prev) => ({ ...prev, equipmentId: preselectedEquipmentId }));
  }, [equipments, formData.equipmentId, isEditMode, preselectedEquipmentId]);

  useEffect(() => {
    if (!isEditMode || !useItem) return;

    const start = toWibLocalDateTimeParts(useItem.startTime);
    const end = toWibLocalDateTimeParts(useItem.endTime);

    setFormData({
      equipmentId: sanitizeFormValue(useItem.equipmentId),
      quantity: sanitizeFormValue(useItem.quantity) || "1",
      purpose: sanitizeFormValue(useItem.purpose) || "Penelitian",
      startTime: start.value,
      endTime: end.value,
      note: sanitizeFormValue(useItem.note),
      requesterPhone: sanitizeFormValue(useItem.requesterPhone),
      requesterMentor: sanitizeFormValue(useItem.requesterMentor),
      requesterMentorProfileId: sanitizeFormValue(useItem.requesterMentorProfileId),
      institution: sanitizeFormValue(useItem.institution),
      institutionAddress: sanitizeFormValue(useItem.institutionAddress),
    });
    setStartDate(start.date);
    setStartTime(start.time);
    setEndDate(end.date);
    setEndTime(end.time);
  }, [isEditMode, useItem]);

  useEffect(() => {
    if (availablePurposeOptions.some((option) => option.value === formData.purpose)) return;
    setFormData((prev) => ({
      ...prev,
      purpose: "Penelitian",
      requesterMentor: "",
      requesterMentorProfileId: "",
    }));
  }, [availablePurposeOptions, formData.purpose]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setValidationMessage("");
    setErrorMessage("");
  };

  const handleStartDateChange = (date: Date | undefined) => {
    setStartDate(date);
    setFormData((prev) => ({
      ...prev,
      startTime: combineDateTime(date, startTime),
    }));
    setValidationMessage("");
    setErrorMessage("");
  };

  const handleStartTimeChange = (time: string) => {
    setStartTime(time);
    setFormData((prev) => ({
      ...prev,
      startTime: combineDateTime(startDate, time),
    }));
    setValidationMessage("");
    setErrorMessage("");
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setEndDate(date);
    setFormData((prev) => ({
      ...prev,
      endTime: combineDateTime(date, endTime),
    }));
    setValidationMessage("");
    setErrorMessage("");
  };

  const handleEndTimeChange = (time: string) => {
    setEndTime(time);
    setFormData((prev) => ({
      ...prev,
      endTime: combineDateTime(endDate, time),
    }));
    setValidationMessage("");
    setErrorMessage("");
  };

  const handleSelectChange = (name: "equipmentId" | "purpose", value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "purpose" && value !== THESIS_PURPOSE
        ? {
            requesterMentor: "",
            requesterMentorProfileId: "",
          }
        : {}),
    }));
    setValidationMessage("");
    setErrorMessage("");
  };

  const validateForm = () => {
    setValidationMessage("");
    setErrorMessage("");

    if (!formData.equipmentId) {
      setValidationMessage("Alat wajib dipilih.");
      return false;
    }
    if (!formData.purpose.trim()) {
      setValidationMessage("Tujuan penggunaan alat wajib diisi.");
      return false;
    }
    if (!availablePurposeOptions.some((option) => option.value === formData.purpose)) {
      setValidationMessage("Pilihan tujuan tidak valid.");
      return false;
    }
    if (!isGuestUser && isThesisPurpose && !formData.requesterMentorProfileId) {
      setValidationMessage("Dosen pembimbing wajib dipilih untuk tujuan Skripsi/TA.");
      return false;
    }
    if (!formData.startTime) {
      setValidationMessage("Waktu mulai wajib diisi.");
      return false;
    }

    const quantity = Number(formData.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setValidationMessage("Jumlah alat harus berupa angka bulat lebih dari 0.");
      return false;
    }

    const start = new Date(toWibIsoString(formData.startTime));
    if (Number.isNaN(start.getTime())) {
      setValidationMessage("Waktu mulai tidak valid.");
      return false;
    }

    if (formData.endTime) {
      const end = new Date(toWibIsoString(formData.endTime));
      if (Number.isNaN(end.getTime()) || start >= end) {
        setValidationMessage(
          "Rentang waktu tidak valid. Pastikan selesai lebih besar dari mulai.",
        );
        return false;
      }
    }

    return true;
  };

  const handleOpenConfirmation = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) return;
    setIsConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    const payload = {
      equipmentId: formData.equipmentId,
      quantity: Number(formData.quantity),
      purpose: formData.purpose,
      startTime: toWibIsoString(formData.startTime),
      endTime: formData.endTime ? toWibIsoString(formData.endTime) : undefined,
      note: formData.note,
      requesterPhone: formData.requesterPhone,
      requesterMentor: formData.requesterMentor,
      requesterMentorProfileId: formData.requesterMentorProfileId,
      institution: formData.institution,
      institutionAddress: formData.institutionAddress,
    };
    const result = isEditMode
      ? await updateUse(useId, payload)
      : await createUse(payload);

    if (result.ok) {
      toast.success(
        isEditMode
          ? "Pengajuan penggunaan alat berhasil diperbarui."
          : "Pengajuan penggunaan alat berhasil dikirim.",
      );
      setFormData(initialFormData);
      setStartDate(undefined);
      setStartTime("");
      setEndDate(undefined);
      setEndTime("");
      setIsConfirmOpen(false);
      router.push("/use-equipment");
    } else if (result.message) {
      toast.error(result.message);
    }
  };

  if (isEditMode && isLoadingUseDetail && !useItem) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat data penggunaan alat...
        </div>
      </section>
    );
  }

  if (isEditMode && useDetailError && !useItem) {
    return (
      <section className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
        {useDetailError}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <form
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_6px_18px_rgba(15,23,42,0.05)]"
        onSubmit={handleOpenConfirmation}
      >
        <div className="border-b border-slate-200 pb-4">
          <p className="text-base font-semibold text-slate-900">
            {isEditMode ? "Edit Penggunaan Alat" : "Form Penggunaan Alat"}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <DashboardComboboxField
            label="Alat"
            value={formData.equipmentId}
            options={equipmentOptions}
            placeholder="Pilih alat"
            emptyText="Alat tidak ditemukan."
            disabled={isLoadingEquipments || isSubmitting}
            required
            onChange={(value) => handleSelectChange("equipmentId", value)}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">
              Jumlah <span className="text-rose-600">*</span>
            </label>
            <Input
              type="number"
              min={1}
              step={1}
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              placeholder="Contoh: 1"
              className="h-11 border-slate-300 bg-white px-3 focus-visible:border-slate-500 focus-visible:ring-slate-200"
              disabled={isSubmitting}
            />
          </div>

          <DashboardComboboxField
            label="Tujuan"
            value={formData.purpose}
            options={availablePurposeOptions}
            placeholder="Pilih tujuan"
            emptyText="Tujuan tidak ditemukan."
            disabled={isSubmitting}
            required
            onChange={(value) => handleSelectChange("purpose", value)}
          />

          {!isGuestUser && isThesisPurpose ? (
            <div className="space-y-1.5">
              <DashboardComboboxField
                label="Dosen Pembimbing"
                value={formData.requesterMentorProfileId}
                options={mentorOptions}
                placeholder="Pilih dosen pembimbing"
                emptyText="Dosen pembimbing tidak ditemukan."
                disabled={isSubmitting || isLoadingMentors}
                required
                onChange={(value) => {
                  const selectedMentor = mentors.find((mentor) => mentor.id === value);
                  setFormData((prev) => ({
                    ...prev,
                    requesterMentorProfileId: value,
                    requesterMentor: selectedMentor?.label ?? "",
                  }));
                  setValidationMessage("");
                  setErrorMessage("");
                }}
              />
              {mentorError ? (
                <p className="text-xs text-rose-600">{mentorError}</p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <DashboardDateTimePickerField
              id="start-time"
              label="Waktu Mulai (WIB)"
              date={startDate}
              time={startTime}
              minDate={today}
              minTime={minStartTime}
              onDateChange={handleStartDateChange}
              onTimeChange={handleStartTimeChange}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <DashboardDateTimePickerField
              id="end-time"
              label="Waktu Selesai (WIB)"
              date={endDate}
              time={endTime}
              minDate={minEndDate}
              minTime={minEndTime}
              onDateChange={handleEndDateChange}
              onTimeChange={handleEndTimeChange}
              disabled={isSubmitting}
              required={false}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">
              Nomor Telepon Pemohon
            </label>
            <Input
              type="text"
              name="requesterPhone"
              value={formData.requesterPhone}
              onChange={handleChange}
              placeholder="Contoh: 08123456789"
              className="h-11 border-slate-300 bg-white px-3 focus-visible:border-slate-500 focus-visible:ring-slate-200"
              disabled={isSubmitting}
            />
          </div>

          {isGuestUser ? (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">
                  Institusi
                </label>
                <Input
                  type="text"
                  name="institution"
                  value={formData.institution}
                  onChange={handleChange}
                  placeholder="Nama institusi"
                  className="h-11 border-slate-300 bg-white px-3 focus-visible:border-slate-500 focus-visible:ring-slate-200"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">
                  Alamat Institusi
                </label>
                <Input
                  type="text"
                  name="institutionAddress"
                  value={formData.institutionAddress}
                  onChange={handleChange}
                  placeholder="Alamat institusi"
                  className="h-11 border-slate-300 bg-white px-3 focus-visible:border-slate-500 focus-visible:ring-slate-200"
                  disabled={isSubmitting}
                />
              </div>
            </>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Catatan</label>
          <textarea
            name="note"
            value={formData.note}
            onChange={handleChange}
            rows={4}
            maxLength={2000}
            placeholder="Tambahkan catatan jika diperlukan"
            className="min-h-[120px] w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm outline-none shadow-xs focus-visible:border-slate-500 focus-visible:ring-[3px] focus-visible:ring-slate-200"
            disabled={isSubmitting}
          />
          <p className="text-[11px] text-slate-500">Maksimal 2000 karakter.</p>
        </div>

        {validationMessage ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {validationMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex justify-end border-t border-slate-200 pt-3">
          <Button
            type="submit"
            className="min-w-[180px] gap-2"
            disabled={isSubmitting || isLoadingEquipments || isLoadingUseDetail}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              (isEditMode ? "Simpan Perubahan" : "Ajukan Penggunaan")
            )}
          </Button>
        </div>
      </form>

      {equipmentError ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {equipmentError}
        </div>
      ) : null}

      <SubmissionConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title={isEditMode ? "Konfirmasi Perubahan" : "Konfirmasi Pengajuan"}
        description={
          isEditMode
            ? "Periksa kembali perubahan data penggunaan alat sebelum disimpan."
            : "Periksa kembali data penggunaan alat sebelum pengajuan dikirim."
        }
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
        onConfirm={() => void handleConfirmSubmit()}
      >
        <SubmissionSummaryItem label="Alat" value={selectedEquipmentLabel} />
        <SubmissionSummaryItem label="Jumlah" value={formData.quantity} />
        <SubmissionSummaryItem
          label="Tujuan"
          value={
            availablePurposeOptions.find((option) => option.value === formData.purpose)
              ?.label ?? formData.purpose
          }
        />
        <SubmissionSummaryItem
          label="Waktu Mulai (WIB)"
          value={formatLocalDateTimeAsWib(formData.startTime)}
        />
        <SubmissionSummaryItem
          label="Waktu Selesai (WIB)"
          value={formatLocalDateTimeAsWib(formData.endTime)}
        />
        <SubmissionSummaryItem
          label="Nomor Telepon Pemohon"
          value={formData.requesterPhone}
        />
        {!isGuestUser && isThesisPurpose ? (
          <SubmissionSummaryItem
            label="Dosen Pembimbing"
            value={formData.requesterMentor}
          />
        ) : null}
        {isGuestUser ? (
          <>
            <SubmissionSummaryItem label="Institusi" value={formData.institution} />
            <SubmissionSummaryItem
              label="Alamat Institusi"
              value={formData.institutionAddress}
            />
          </>
        ) : null}
        <SubmissionSummaryItem label="Catatan" value={formData.note} />
      </SubmissionConfirmDialog>
    </section>
  );
}
