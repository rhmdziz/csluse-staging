"use client";


import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { addDays, addMonths } from "date-fns";
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
  InlineErrorAlert,
  combineDateTime,
  getMinSelectableTime,
  isSameCalendarDay,
  startOfToday,
  type SelectOption,
} from "@/components/shared";

import { Button, Input, Textarea } from "@/components/ui";
import { ROLE_VALUES, normalizeRoleValue } from "@/constants/roles";

import { useBorrowDetail, useCreateBorrow } from "@/hooks/borrow-equipment";

import { useEquipmentOptions } from "@/hooks/shared/resources/equipments";

import { useLoadProfile } from "@/hooks/shared/profile";

import { useMentorOptions } from "@/hooks/shared/resources/users";

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
  startTime: string;
  endTime: string;
  purpose: string;
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
  startTime: "",
  endTime: "",
  purpose: "Penelitian",
  note: "",
  requesterPhone: "",
  requesterMentor: "",
  requesterMentorProfileId: "",
  institution: "",
  institutionAddress: "",
};

const GLASSWARE_BORROW_REQUEST_LIMIT = 5;

type BorrowFormParams = {
  id?: string;
};

function sanitizeFormValue(value?: string | null) {
  const normalized = String(value ?? "").trim();
  return normalized === "-" ? "" : normalized;
}

export default function BorrowEquipmentFormPage() {
  const { id } = useParams<BorrowFormParams>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const borrowId = typeof id === "string" ? id : "";
  const isEditMode = borrowId.length > 0;
  const today = useMemo(() => startOfToday(), []);
  const earliestStartDate = useMemo(() => addDays(today, 2), [today]);
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
  } = useEquipmentOptions(isEditMode ? "" : "Available", "", true, true, "", true);
  const {
    mentors,
    isLoading: isLoadingMentors,
    error: mentorError,
  } = useMentorOptions(!isGuestUser && isThesisPurpose);
  const {
    borrow,
    isLoading: isLoadingBorrowDetail,
    error: borrowDetailError,
  } = useBorrowDetail(borrowId, 0, { enabled: isEditMode });
  const {
    createBorrow,
    updateBorrow,
    isSubmitting,
    errorMessage,
    setErrorMessage,
  } = useCreateBorrow();
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

  const equipmentOptions = useMemo<SelectOption[]>(
    () =>
      equipments.map((equipment) => ({
        value: equipment.id,
        label: `${equipment.label} (stok: ${equipment.quantity})`,
      })),
    [equipments],
  );
  const selectedEquipment = useMemo(
    () =>
      equipments.find((equipment) => equipment.id === formData.equipmentId) ??
      null,
    [equipments, formData.equipmentId],
  );
  const maxQuantityPerRequest = useMemo(() => {
    if (!selectedEquipment) return undefined;
    if (selectedEquipment.category.trim() !== "Glassware") {
      return selectedEquipment.quantity;
    }

    return Math.min(
      selectedEquipment.quantity,
      GLASSWARE_BORROW_REQUEST_LIMIT,
    );
  }, [selectedEquipment]);
  const selectedPurposeLabel = useMemo(
    () =>
      availablePurposeOptions.find((option) => option.value === formData.purpose)?.label ?? "-",
    [availablePurposeOptions, formData.purpose],
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
    if (!isEditMode || !borrow) return;

    const start = toWibLocalDateTimeParts(borrow.startTime);
    const end = toWibLocalDateTimeParts(borrow.endTime);

    setFormData({
      equipmentId: sanitizeFormValue(borrow.equipmentId),
      quantity: sanitizeFormValue(borrow.quantity) || "1",
      startTime: start.value,
      endTime: end.value,
      purpose: sanitizeFormValue(borrow.purpose) || "Penelitian",
      note: sanitizeFormValue(borrow.note),
      requesterPhone: sanitizeFormValue(borrow.requesterPhone),
      requesterMentor: sanitizeFormValue(borrow.requesterMentor),
      requesterMentorProfileId: sanitizeFormValue(borrow.requesterMentorProfileId),
      institution: sanitizeFormValue(borrow.institution),
      institutionAddress: sanitizeFormValue(borrow.institutionAddress),
    });
    setStartDate(start.date);
    setStartTime(start.time);
    setEndDate(end.date);
    setEndTime(end.time);
  }, [borrow, isEditMode]);

  useEffect(() => {
    if (availablePurposeOptions.some((option) => option.value === formData.purpose)) return;
    setFormData((prev) => ({
      ...prev,
      purpose: "Penelitian",
      requesterMentor: "",
      requesterMentorProfileId: "",
    }));
  }, [availablePurposeOptions, formData.purpose]);
  const maxEndDate = useMemo(
    () => (startDate ? addMonths(startDate, 3) : undefined),
    [startDate],
  );
  const earliestStartDateLabel = useMemo(
    () =>
      earliestStartDate.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [earliestStartDate],
  );
  const minEndDate = startDate ? new Date(startDate) : new Date(earliestStartDate);
  if (minEndDate) {
    minEndDate.setHours(0, 0, 0, 0);
  }
  const minEndTime =
    startDate &&
    endDate &&
    isSameCalendarDay(startDate, endDate)
      ? startTime || undefined
      : undefined;
  const minStartTime = getMinSelectableTime(startDate, today);

  useEffect(() => {
    if (!startDate || !endDate || !maxEndDate) return;
    if (endDate.getTime() <= maxEndDate.getTime()) return;

    setEndDate(undefined);
    setEndTime("");
    setFormData((prev) => ({
      ...prev,
      endTime: "",
    }));
  }, [endDate, maxEndDate, startDate]);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setValidationMessage("");
    setErrorMessage("");
  };

  const handleSelectEquipment = (value: string) => {
    setFormData((prev) => ({ ...prev, equipmentId: value }));
    setValidationMessage("");
    setErrorMessage("");
  };

  const handleSelectPurpose = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      purpose: value,
      ...(value !== THESIS_PURPOSE
        ? {
            requesterMentor: "",
            requesterMentorProfileId: "",
          }
        : {}),
    }));
    setValidationMessage("");
    setErrorMessage("");
  };

  const handleStartDateChange = (date: Date | undefined) => {
    const nextMaxEndDate = date ? addMonths(date, 3) : undefined;
    const shouldResetEndDate =
      endDate !== undefined &&
      nextMaxEndDate !== undefined &&
      endDate.getTime() > nextMaxEndDate.getTime();

    setStartDate(date);
    if (shouldResetEndDate) {
      setEndDate(undefined);
      setEndTime("");
    }
    setFormData((prev) => ({
      ...prev,
      startTime: combineDateTime(date, startTime),
      ...(shouldResetEndDate ? { endTime: "" } : {}),
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

  const validateForm = () => {
    if (!formData.equipmentId) return "Pilih alat yang ingin dipinjam.";

    const quantityValue = Number(formData.quantity);
    if (!Number.isInteger(quantityValue) || quantityValue < 1) {
      return "Jumlah alat minimal 1.";
    }

    if (
      selectedEquipment?.category === "Glassware" &&
      quantityValue > GLASSWARE_BORROW_REQUEST_LIMIT
    ) {
      return `Peralatan kategori Glassware hanya boleh dipinjam maksimal ${GLASSWARE_BORROW_REQUEST_LIMIT} unit dalam 1 request.`;
    }

    if (selectedEquipment && quantityValue > selectedEquipment.quantity) {
      return `Jumlah melebihi stok tersedia (${selectedEquipment.quantity}).`;
    }

    if (!formData.startTime) return "Pilih waktu mulai peminjaman.";
    if (!formData.endTime) return "Pilih waktu selesai peminjaman.";
    if (new Date(formData.endTime) <= new Date(formData.startTime)) {
      return "Waktu selesai harus setelah waktu mulai.";
    }
    const start = new Date(toWibIsoString(formData.startTime));
    const end = new Date(toWibIsoString(formData.endTime));
    const earliestStart = new Date(earliestStartDate);
    earliestStart.setHours(0, 0, 0, 0);
    if (start < earliestStart) {
      return `Waktu mulai borrow minimal H+2 dari tanggal pengajuan (ajukan H-2). Pilih tanggal mulai paling cepat ${earliestStartDateLabel}.`;
    }
    const maxAllowedEnd = addMonths(start, 3);
    if (end > maxAllowedEnd) {
      return "Rentang borrow maksimal 3 bulan dari waktu mulai.";
    }
    if (!formData.purpose.trim()) return "Pilih tujuan peminjaman.";
    if (!availablePurposeOptions.some((option) => option.value === formData.purpose)) {
      return "Tujuan peminjaman tidak valid.";
    }
    if (!isGuestUser && isThesisPurpose && !formData.requesterMentorProfileId) {
      return "Dosen pembimbing wajib dipilih untuk tujuan Skripsi/TA.";
    }

    return "";
  };

  const handleOpenConfirmation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationMessage("");
    setErrorMessage("");

    const message = validateForm();
    if (message) {
      setValidationMessage(message);
      return;
    }

    setIsConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    const payload = {
      equipmentId: formData.equipmentId,
      quantity: Number(formData.quantity),
      startTime: toWibIsoString(formData.startTime),
      endTime: toWibIsoString(formData.endTime),
      purpose: formData.purpose,
      note: formData.note,
      requesterPhone: formData.requesterPhone,
      requesterMentor: formData.requesterMentor,
      requesterMentorProfileId: formData.requesterMentorProfileId,
      institution: formData.institution,
      institutionAddress: formData.institutionAddress,
    };
    const result = isEditMode
      ? await updateBorrow(borrowId, payload)
      : await createBorrow(payload);

    if (!result.ok) return;

    toast.success(
      isEditMode
        ? "Pengajuan peminjaman alat berhasil diperbarui."
        : "Pengajuan peminjaman alat berhasil dibuat.",
    );
    setIsConfirmOpen(false);
    router.push("/borrow-equipment");
  };

  if (isEditMode && isLoadingBorrowDetail && !borrow) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat data peminjaman alat...
        </div>
      </section>
    );
  }

  if (isEditMode && borrowDetailError && !borrow) {
    return (
      <section className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
        {borrowDetailError}
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
            {isEditMode ? "Edit Peminjaman Alat" : "Form Peminjaman Alat"}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900 md:col-span-2">
            Pengajuan peminjaman alat harus diajukan minimal H-2, sehingga tanggal mulai paling cepat {earliestStartDateLabel}.
          </div>

          <div>
            <DashboardComboboxField
              label="Pilih Alat"
              value={formData.equipmentId}
              options={equipmentOptions}
              placeholder={
                isLoadingEquipments ? "Memuat alat..." : "Cari dan pilih alat"
              }
              emptyText={
                isLoadingEquipments
                  ? "Memuat..."
                  : "Tidak ada alat yang tersedia"
              }
              disabled={isLoadingEquipments || isSubmitting}
              required
              onChange={handleSelectEquipment}
            />
            {equipmentError ? (
              <p className="mt-2 text-xs text-rose-600">{equipmentError}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="quantity"
              className="text-xs font-medium text-slate-600"
            >
              Jumlah <span className="text-rose-600">*</span>
            </label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min="1"
              max={maxQuantityPerRequest}
              value={formData.quantity}
              onChange={handleChange}
              disabled={isSubmitting}
              className="h-11 border-slate-300 bg-white"
            />
            {selectedEquipment?.category === "Glassware" ? (
              <p className="text-xs text-slate-500">
                Glassware hanya dapat dipinjam maksimal {GLASSWARE_BORROW_REQUEST_LIMIT} unit per request.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <DashboardComboboxField
              label="Tujuan Peminjaman"
              value={formData.purpose}
              options={availablePurposeOptions}
              placeholder="Pilih tujuan"
              emptyText="Pilihan tujuan tidak tersedia"
              disabled={isSubmitting}
              required
              onChange={handleSelectPurpose}
            />
          </div>

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

          <DashboardDateTimePickerField
            id="start-time"
            label="Waktu Mulai (WIB)"
            date={startDate}
            time={startTime}
            disabled={isSubmitting}
            minDate={earliestStartDate}
            minTime={minStartTime}
            onDateChange={handleStartDateChange}
            onTimeChange={handleStartTimeChange}
          />

          <DashboardDateTimePickerField
            id="end-time"
            label="Waktu Selesai (WIB)"
            date={endDate}
            time={endTime}
            disabled={isSubmitting}
            minDate={minEndDate}
            maxDate={maxEndDate}
            minTime={minEndTime}
            onDateChange={handleEndDateChange}
            onTimeChange={handleEndTimeChange}
          />

          <div className="space-y-1.5">
            <label
              htmlFor="requesterPhone"
              className="text-xs font-medium text-slate-600"
            >
              Nomor Telepon Pemohon
            </label>
            <Input
              id="requesterPhone"
              name="requesterPhone"
              type="text"
              value={formData.requesterPhone}
              onChange={handleChange}
              disabled={isSubmitting}
              className="h-11 border-slate-300 bg-white"
            />
          </div>

          {isGuestUser ? (
            <>
              <div className="space-y-1.5">
                <label
                  htmlFor="institution"
                  className="text-xs font-medium text-slate-600"
                >
                  Institusi
                </label>
                <Input
                  id="institution"
                  name="institution"
                  type="text"
                  value={formData.institution}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className="h-11 border-slate-300 bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="institutionAddress"
                  className="text-xs font-medium text-slate-600"
                >
                  Alamat Institusi
                </label>
                <Input
                  id="institutionAddress"
                  name="institutionAddress"
                  type="text"
                  value={formData.institutionAddress}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className="h-11 border-slate-300 bg-white"
                />
              </div>
            </>
          ) : null}

          <div className="space-y-1.5 md:col-span-2">
            <label
              htmlFor="note"
              className="text-xs font-medium text-slate-600"
            >
              Catatan
            </label>
            <Textarea
              id="note"
              name="note"
              value={formData.note}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="Tambahkan detail tambahan bila perlu"
              className="min-h-28 border-slate-300 bg-white"
            />
          </div>
        </div>

        {validationMessage ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {validationMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <InlineErrorAlert className="mt-4">{errorMessage}</InlineErrorAlert>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="submit"
            disabled={isSubmitting || isLoadingEquipments || isLoadingBorrowDetail}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              (isEditMode ? "Simpan Perubahan" : "Ajukan Peminjaman")
            )}
          </Button>
        </div>
      </form>

      <SubmissionConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title={isEditMode ? "Konfirmasi Perubahan" : "Konfirmasi Pengajuan"}
        description={
          isEditMode
            ? "Periksa kembali perubahan data peminjaman alat sebelum disimpan."
            : "Periksa kembali data peminjaman alat sebelum pengajuan dikirim."
        }
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
        onConfirm={() => void handleConfirmSubmit()}
      >
        <SubmissionSummaryItem
          label="Alat"
          value={selectedEquipment?.label ?? "-"}
        />
        <SubmissionSummaryItem label="Jumlah" value={formData.quantity} />
        <SubmissionSummaryItem
          label="Waktu Mulai (WIB)"
          value={formatLocalDateTimeAsWib(formData.startTime)}
        />
        <SubmissionSummaryItem
          label="Waktu Selesai (WIB)"
          value={formatLocalDateTimeAsWib(formData.endTime)}
        />
        <SubmissionSummaryItem label="Tujuan" value={selectedPurposeLabel} />
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
