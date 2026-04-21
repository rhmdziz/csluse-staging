"use client";


import { useEffect, useState } from "react";

import {
  Check,
  Handshake,
  Loader2,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";

import { toast } from "sonner";

import { StatusConfirmDialog } from "@/components/dialogs";

import { RequestReviewCard } from "@/components/shared";

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
  Textarea,
} from "@/components/ui";

import {
  API_BOOKING_REVIEW_CHECK,
  API_BORROW_REVIEW_CHECK,
} from "@/constants/api";

import { WORKSHOP_PURPOSE } from "@/constants/request-purpose";

import { ROLE_VALUES, normalizeRoleValue } from "@/constants/roles";

import { authFetch } from "@/lib/auth";

import {
  useBookingDetail,
  type BookingRow,
} from "@/hooks/booking-rooms";

import { useUpdateBookingStatus } from "@/hooks/booking-rooms";

import { useBorrowDetail, type BorrowRow } from "@/hooks/borrow-equipment";

import { useUpdateBorrowStatus } from "@/hooks/borrow-equipment";

import { useLoadProfile } from "@/hooks/shared/profile";

import {
  useSampleTestingDetail,
  type SampleTestingRow,
} from "@/hooks/sample-testing";

import { useUpdateSampleTestingStatus } from "@/hooks/sample-testing";

import { formatDateTimeWib } from "@/lib/date";

import {
  canCurrentUserReviewPendingRequest,
  canCurrentUserFinalizeRequest,
  isWaitingForMentorApproval,
} from "@/lib/request";

export type ReviewContext =
  | { kind: "booking"; id: string }
  | { kind: "borrow"; id: string }
  | { kind: "sample-testing"; id: string }
  | null;

function normalizeStatus(value: string) {
  return value.toLowerCase();
}

function isPendingStatus(value: string) {
  return normalizeStatus(value) === "pending";
}

function isApprovedStatus(value: string) {
  return normalizeStatus(value) === "approved";
}

function canReturnStatus(value: string) {
  const normalized = normalizeStatus(value);
  return normalized === "borrowed" || normalized === "overdue";
}

function isInspectionPendingStatus(value: string) {
  const normalized = normalizeStatus(value);
  return (
    normalized === "returned pending inspection" ||
    normalized === "returned_pending_inspection"
  );
}

function isGuestRole(role?: string | null) {
  return String(role ?? "").trim().toLowerCase() === "guest";
}

function getBorrowStatusHint(
  status: string,
  reviewer: boolean,
): {
  title: string;
  message: string;
  indicators?: string[];
  className?: string;
  titleClassName?: string;
  textClassName?: string;
} | null {
  if (isApprovedStatus(status)) {
    return {
      title: "Status sudah disetujui",
      message: reviewer
        ? "Pengajuan sudah lolos review dan siap masuk proses serah terima alat."
        : "Pengajuan sudah lolos review dan sedang menunggu proses serah terima alat.",
      indicators: reviewer
        ? [
            "Gunakan aksi Serah Terima setelah alat benar-benar diserahkan ke peminjam.",
          ]
        : ["PIC akan melanjutkan ke proses serah terima alat."],
      className: "border-sky-200 bg-sky-50/80",
      titleClassName: "text-sky-800",
      textClassName: "text-sky-900",
    };
  }

  if (canReturnStatus(status)) {
    return {
      title: "Alat sedang dipinjam",
      message: reviewer
        ? "Tahap review selesai. Langkah berikutnya adalah menerima alat kembali dari peminjam."
        : "Alat sedang dipinjam dan menunggu proses pengembalian.",
      indicators: reviewer
        ? [
            "Gunakan aksi Konfirmasi Pengembalian saat alat sudah diterima kembali.",
          ]
        : [
            "Setelah alat dikembalikan, PIC akan melakukan konfirmasi pengembalian.",
          ],
      className: "border-sky-200 bg-sky-50/80",
      titleClassName: "text-sky-800",
      textClassName: "text-sky-900",
    };
  }

  if (isInspectionPendingStatus(status)) {
    return {
      title: "Menunggu inspeksi akhir",
      message: reviewer
        ? "Pengembalian sudah diterima. Lanjutkan dengan pemeriksaan kondisi alat sebelum status diselesaikan."
        : "Pengembalian sudah diterima dan sedang menunggu hasil inspeksi akhir.",
      indicators: reviewer
        ? [
            "Gunakan Finalisasi Return jika alat kembali dengan baik.",
            "Gunakan Tandai Rusak atau Tandai Hilang jika ada temuan pada inspeksi.",
          ]
        : [
            "PIC akan memfinalisasi return atau menandai hasil inspeksi bila ada kendala.",
          ],
      className: "border-emerald-200 bg-emerald-50/80",
      titleClassName: "text-emerald-800",
      textClassName: "text-emerald-900",
    };
  }

  return null;
}

function getCompleteStatusHint(
  status: string,
  reviewer: boolean,
  labels: {
    readyTitle: string;
    reviewerMessage: string;
    requesterMessage: string;
    reviewerIndicator: string;
    requesterIndicator: string;
  },
): {
  title: string;
  message: string;
  indicators?: string[];
  className?: string;
  titleClassName?: string;
  textClassName?: string;
} | null {
  if (!isApprovedStatus(status)) {
    return null;
  }

  return {
    title: labels.readyTitle,
    message: reviewer ? labels.reviewerMessage : labels.requesterMessage,
    indicators: [
      reviewer ? labels.reviewerIndicator : labels.requesterIndicator,
    ],
    className: "border-sky-200 bg-sky-50/80",
    titleClassName: "text-sky-800",
    textClassName: "text-sky-900",
  };
}

function getBorrowStatusActionClass(status: string) {
  if (isApprovedStatus(status)) {
    return "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700";
  }

  if (normalizeStatus(status) === "borrowed") {
    return "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700";
  }

  if (normalizeStatus(status) === "overdue") {
    return "border-orange-600 bg-orange-600 text-white hover:bg-orange-700";
  }

  if (isInspectionPendingStatus(status)) {
    return "border-cyan-600 bg-cyan-600 text-white hover:bg-cyan-700";
  }

  return "border-slate-600 bg-slate-600 text-white hover:bg-slate-700";
}

function getPengujianStatusHint(
  status: string,
  reviewer: boolean,
): {
  title: string;
  message: string;
  indicators?: string[];
  className?: string;
  titleClassName?: string;
  textClassName?: string;
} | null {
  const normalized = normalizeStatus(status);

  if (normalized === "approved") {
    return {
      title: "Pengujian sudah disetujui",
      message: reviewer
        ? "Lanjutkan proses dengan mengunggah surat perjanjian pengujian pada section dokumen."
        : "Pengajuan sudah disetujui dan menunggu dokumen lanjutan dari approver.",
      indicators: reviewer
        ? ["Upload surat perjanjian pengujian untuk memindahkan status ke Diproses."]
        : ["Pantau dokumen lanjutan pada section dokumen pengujian."],
      className: "border-sky-200 bg-sky-50/80",
      titleClassName: "text-sky-800",
      textClassName: "text-sky-900",
    };
  }

  if (normalized === "diproses") {
    return {
      title: "Pengujian sedang diproses",
      message: reviewer
        ? "Lengkapi dokumen proses pengujian sampai kuitansi dan surat hasil uji tersedia."
        : "Lengkapi dokumen requester yang dibutuhkan selama proses pengujian berjalan.",
      indicators: reviewer
        ? ["Upload kuitansi dan surat hasil uji, atau tandai selesai secara manual bila proses sudah berakhir."]
        : ["Upload surat perjanjian yang sudah ditandatangani atau bukti bayar bila diminta."],
      className: "border-blue-200 bg-blue-50/80",
      titleClassName: "text-blue-800",
      textClassName: "text-blue-900",
    };
  }

  return null;
}

function isReviewerRole(role: string | null | undefined) {
  const normalizedRole = normalizeRoleValue(role);
  return (
    normalizedRole === ROLE_VALUES.ADMIN ||
    normalizedRole === ROLE_VALUES.LECTURER
  );
}

function isSampleTestingApproverRole(role: string | null | undefined) {
  return normalizeRoleValue(role) === ROLE_VALUES.ADMIN;
}

function getMentorApprovalHint(
  waitingForMentorApproval: boolean,
  isAssignedMentor: boolean,
) {
  if (!waitingForMentorApproval) return null;

  if (isAssignedMentor) {
    return {
      title: "Menunggu review dosen pembimbing",
      message:
        "Pengajuan ini membutuhkan persetujuan Anda sebagai dosen pembimbing sebelum dapat diproses PIC ruangan.",
      indicators: [
        "Gunakan Setujui atau Tolak untuk menentukan apakah pengajuan boleh lanjut ke PIC.",
      ],
      className: "border-amber-200 bg-amber-50/80",
      titleClassName: "text-amber-800",
      textClassName: "text-amber-900",
    };
  }

  return {
    title: "Menunggu persetujuan dosen pembimbing",
    message:
      "PIC ruangan atau admin belum dapat memproses pengajuan ini sampai dosen pembimbing yang dipilih memberikan persetujuan.",
    className: "border-amber-200 bg-amber-50/80",
    titleClassName: "text-amber-800",
    textClassName: "text-amber-900",
  };
}

type ReviewIssue = {
  label: string;
  value: string;
};

type OverlapInfo = {
  shared_booking_count: number;
  existing_attendees: number;
  current_attendees: number;
  total_attendees: number;
  room_capacity: number;
};

type ReviewCheckResponse = {
  issues?: ReviewIssue[];
  passed_indicators?: string[];
  overlap_info?: OverlapInfo;
};

async function loadReviewIssues(url: string) {
  const response = await authFetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Gagal memuat review check (${response.status})`);
  }
  const payload = (await response.json()) as ReviewCheckResponse;
  return {
    issues: Array.isArray(payload.issues) ? payload.issues : [],
    passedIndicators: Array.isArray(payload.passed_indicators)
      ? payload.passed_indicators
      : [],
    overlapInfo: payload.overlap_info ?? null,
  };
}

function PanelLoadingState() {
  return (
    <div className="rounded-lg border border-[#D2DDED] bg-white px-4 py-6 text-sm text-slate-500">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat review pengajuan...
      </div>
    </div>
  );
}

function PanelErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}

function BookingReviewPanel({
  id,
  onActionComplete,
  initialBooking,
}: {
  id: string;
  onActionComplete?: () => void;
  initialBooking?: BookingRow | null;
}) {
  const { profile } = useLoadProfile();
  const { booking, setBooking, isLoading, error } = useBookingDetail(id, 0, {
    enabled: !initialBooking,
    initialBooking,
  });
  const { updateBookingStatus, pendingAction } = useUpdateBookingStatus();
  const [reviewIssues, setReviewIssues] = useState<ReviewIssue[]>([]);
  const [passedIndicators, setPassedIndicators] = useState<string[]>([]);
  const [overlapInfo, setOverlapInfo] = useState<OverlapInfo | null>(null);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [confirmType, setConfirmType] = useState<
    "approve" | "reject" | "complete" | null
  >(null);
  const shouldShowBookingReviewCheck = isPendingStatus(booking?.status ?? "");

  useEffect(() => {
    let isMounted = true;

    const loadIssues = async () => {
      if (!booking) {
        if (isMounted) {
          setReviewIssues([]);
          setPassedIndicators([]);
          setOverlapInfo(null);
          setIssuesLoading(false);
        }
        return;
      }

      if (!shouldShowBookingReviewCheck) {
        if (isMounted) {
          setReviewIssues([]);
          setPassedIndicators([]);
          setOverlapInfo(null);
          setIssuesLoading(false);
        }
        return;
      }

      setIssuesLoading(true);

      try {
        const result = await loadReviewIssues(
          API_BOOKING_REVIEW_CHECK(booking.id),
        );
        if (isMounted) {
          setReviewIssues(result.issues);
          setPassedIndicators(result.passedIndicators);
          setOverlapInfo(result.overlapInfo);
          setIssuesLoading(false);
        }
      } catch {
        if (isMounted) {
          setReviewIssues([
            {
              label: "Review check belum tersedia",
              value:
                "Sistem tidak berhasil memeriksa catatan review saat ini. Cek ulang data sebelum approve.",
            },
          ]);
          setPassedIndicators([]);
          setOverlapInfo(null);
          setIssuesLoading(false);
        }
      }
    };

    void loadIssues();
    return () => {
      isMounted = false;
    };
  }, [booking?.id, shouldShowBookingReviewCheck]);

  if (isLoading) return <PanelLoadingState />;
  if (error || !booking) {
    return (
      <PanelErrorState message={error || "Data booking tidak ditemukan."} />
    );
  }

  const waitingForMentorApproval = isWaitingForMentorApproval(booking);
  const showBookingReviewCheck =
    shouldShowBookingReviewCheck && !waitingForMentorApproval;
  const reviewer = isReviewerRole(profile?.role);
  const canReviewBooking = canCurrentUserReviewPendingRequest(
    booking,
    profile?.id,
    profile?.role,
  );
  const canCompleteBooking =
    isApprovedStatus(booking.status) &&
    canCurrentUserFinalizeRequest(booking, profile?.id, profile?.role);
  const mentorHint = getMentorApprovalHint(
    waitingForMentorApproval,
    String(profile?.id ?? "") === booking.requesterMentorProfileId,
  );
  const isGuestRequester = isGuestRole(booking.requesterRole);
  const isWorkshopPurpose = booking.purpose === WORKSHOP_PURPOSE;
  const bookingStatusHint = getCompleteStatusHint(booking.status, reviewer, {
    readyTitle: "Booking siap diselesaikan",
    reviewerMessage:
      "Pengajuan sudah disetujui. Tandai sebagai selesai setelah waktu booking benar-benar berakhir.",
    requesterMessage:
      "Pengajuan sudah disetujui dan akan ditandai selesai oleh petugas setelah waktu booking berakhir.",
    reviewerIndicator:
      "Gunakan aksi Tandai Selesai setelah sesi peminjaman lab selesai.",
    requesterIndicator:
      "Status akan diperbarui menjadi selesai oleh petugas setelah sesi peminjaman lab berakhir.",
  });

  const handleBookingAction = async (rejectionNote?: string) => {
    if (!confirmType) return;

    const type = confirmType;
    const result = await updateBookingStatus(
      booking.id,
      type,
      type === "reject" ? { rejectionNote } : undefined,
    );
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    const now = new Date().toISOString();
    setBooking((current) =>
      current
        ? {
            ...current,
            status:
              type === "approve"
                ? "Approved"
                : type === "reject"
                  ? "Rejected"
                  : "Completed",
            updatedAt: now,
            rejectionNote:
              type === "reject"
                ? String(rejectionNote ?? current.rejectionNote ?? "")
                : current.rejectionNote,
            approvedById:
              type === "approve"
                ? String(profile?.id ?? current.approvedById)
                : current.approvedById,
            approvedByName:
              type === "approve"
                ? profile?.name || current.approvedByName
                : current.approvedByName,
            approvedByEmail:
              type === "approve"
                ? profile?.email || current.approvedByEmail
                : current.approvedByEmail,
            approvedAt: type === "approve" ? now : current.approvedAt,
            rejectedAt: type === "reject" ? now : current.rejectedAt,
            completedAt: type === "complete" ? now : current.completedAt,
          }
        : current,
    );
    setConfirmType(null);

    toast.success(
      type === "approve"
        ? "Pengajuan booking berhasil disetujui."
        : type === "reject"
          ? "Pengajuan booking berhasil ditolak."
          : "Pengajuan booking berhasil ditandai selesai.",
    );
    onActionComplete?.();
  };

  return (
    <>
      <RequestReviewCard
        status={booking.status}
        code={booking.code}
        meta={[
          { label: "Ruangan", value: booking.roomName || "-" },
          ...(booking.equipmentName && booking.equipmentName !== "-"
            ? [{ label: "Peralatan", value: booking.equipmentName }]
            : []),
          { label: "Pemohon", value: booking.requesterName },
          { label: "Ditujukan ke PIC", value: booking.roomPicName || "-" },
          {
            label: "Mulai booking",
            value: formatDateTimeWib(booking.startTime),
          },
          { label: "Tujuan", value: booking.purpose || "-" },
          { label: "Jumlah Peserta", value: booking.attendeeCount || "-" },
          ...(isGuestRequester
            ? [
                { label: "Institusi", value: booking.institution || "-" },
                {
                  label: "Alamat Institusi",
                  value: booking.institutionAddress || "-",
                },
              ]
            : []),
          ...(isWorkshopPurpose
            ? [
                {
                  label: "Judul Workshop",
                  value: booking.workshopTitle || "-",
                },
                { label: "PIC Workshop", value: booking.workshopPic || "-" },
                {
                  label: "Institusi Workshop",
                  value: booking.workshopInstitution || "-",
                },
              ]
            : []),
          ...(booking.status === "Rejected"
            ? [
                {
                  label: "Waktu Ditolak",
                  value: formatDateTimeWib(booking.rejectedAt),
                },
                {
                  label: "Alasan Penolakan",
                  value: booking.rejectionNote || "-",
                },
              ]
            : []),
          ...(booking.status === "Expired"
            ? [
                {
                  label: "Waktu Kedaluwarsa",
                  value: formatDateTimeWib(booking.expiredAt),
                },
              ]
            : []),
          ...(booking.status === "Completed"
            ? [
                {
                  label: "Waktu Selesai",
                  value: formatDateTimeWib(booking.completedAt),
                },
              ]
            : []),
        ]}
        reviewInfoItems={
          showBookingReviewCheck && overlapInfo
            ? [
                {
                  label: "Total Peserta Booking Aktif",
                  value: `${overlapInfo.total_attendees}/${overlapInfo.room_capacity}${overlapInfo.shared_booking_count > 0 ? ` (${overlapInfo.existing_attendees} peserta lain + ${overlapInfo.current_attendees} pengajuan ini)` : ""}`,
                  variant: overlapInfo.total_attendees > overlapInfo.room_capacity ? "danger" : "success",
                },
              ]
            : []
        }
        checklist={showBookingReviewCheck ? reviewIssues : []}
        checklistLoading={showBookingReviewCheck ? issuesLoading : false}
        showChecklistSection={showBookingReviewCheck}
        checklistEmptyMessage={
          showBookingReviewCheck
            ? "Tidak ada catatan review. Pengajuan ini siap diproses."
            : undefined
        }
        checklistPassedIndicators={
          showBookingReviewCheck ? passedIndicators : []
        }
        statusHintTitle={mentorHint?.title ?? bookingStatusHint?.title}
        statusHintMessage={mentorHint?.message ?? bookingStatusHint?.message}
        statusHintIndicators={mentorHint?.indicators ?? bookingStatusHint?.indicators}
        statusHintClassName={mentorHint?.className ?? bookingStatusHint?.className}
        statusHintTitleClassName={mentorHint?.titleClassName ?? bookingStatusHint?.titleClassName}
        statusHintTextClassName={mentorHint?.textClassName ?? bookingStatusHint?.textClassName}
      >
        {canReviewBooking ? (
          <>
            <Button
              type="button"
              className="h-10 rounded-md border border-emerald-600 bg-emerald-600 px-4 text-white shadow-sm hover:bg-emerald-700"
              onClick={() => setConfirmType("approve")}
              disabled={pendingAction.bookingId === booking.id}
            >
              <Check className="h-4 w-4" />
              Setujui
            </Button>
            <Button
              type="button"
              className="h-10 rounded-md border border-rose-600 bg-rose-600 px-4 text-white shadow-sm hover:bg-rose-700"
              onClick={() => setConfirmType("reject")}
              disabled={pendingAction.bookingId === booking.id}
            >
              <X className="h-4 w-4" />
              Tolak
            </Button>
          </>
        ) : null}
        {canCompleteBooking ? (
          <Button
            type="button"
            className="h-10 rounded-md border border-sky-600 bg-sky-600 px-4 text-white shadow-sm hover:bg-sky-700"
            onClick={() => setConfirmType("complete")}
            disabled={pendingAction.bookingId === booking.id}
          >
            <Check className="h-4 w-4" />
            Tandai Selesai
          </Button>
        ) : null}
      </RequestReviewCard>

      <StatusConfirmDialog
        open={Boolean(confirmType)}
        actionType={
          confirmType === "reject" ? "reject" : confirmType ? "approve" : null
        }
        onOpenChange={(open) => {
          if (!open) setConfirmType(null);
        }}
        onConfirm={handleBookingAction}
        isSubmitting={pendingAction.bookingId === booking.id}
        subjectLabel={
          confirmType === "complete"
            ? "pengajuan peminjaman lab ini sebagai selesai"
            : "pengajuan peminjaman lab ini"
        }
        requireReasonOnReject={confirmType === "reject"}
      />
    </>
  );
}


function BorrowReviewPanel({
  id,
  onActionComplete,
  initialBorrow,
}: {
  id: string;
  onActionComplete?: () => void;
  initialBorrow?: BorrowRow | null;
}) {
  const { profile } = useLoadProfile();
  const { borrow, setBorrow, isLoading, error } = useBorrowDetail(id, 0, {
    enabled: !initialBorrow,
    initialBorrow,
  });
  const { updateBorrowStatus, pendingAction } = useUpdateBorrowStatus();
  const [reviewIssues, setReviewIssues] = useState<ReviewIssue[]>([]);
  const [passedIndicators, setPassedIndicators] = useState<string[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [confirmType, setConfirmType] = useState<
    "approve" | "reject" | "handover" | "finalize_return" | null
  >(null);
  const [isReturnConfirmOpen, setIsReturnConfirmOpen] = useState(false);
  const [inspectionAction, setInspectionAction] = useState<
    "mark_damaged" | "mark_lost" | null
  >(null);
  const [inspectionNote, setInspectionNote] = useState("");
  const shouldShowBorrowReviewCheck = isPendingStatus(borrow?.status ?? "");

  useEffect(() => {
    let isMounted = true;

    const loadIssues = async () => {
      if (!borrow) {
        if (isMounted) {
          setReviewIssues([]);
          setPassedIndicators([]);
          setIssuesLoading(false);
        }
        return;
      }

      if (!shouldShowBorrowReviewCheck) {
        if (isMounted) {
          setReviewIssues([]);
          setPassedIndicators([]);
          setIssuesLoading(false);
        }
        return;
      }

      setIssuesLoading(true);
      try {
        const result = await loadReviewIssues(
          API_BORROW_REVIEW_CHECK(borrow.id),
        );
        if (isMounted) {
          setReviewIssues(result.issues);
          setPassedIndicators(result.passedIndicators);
          setIssuesLoading(false);
        }
      } catch {
        if (isMounted) {
          setReviewIssues([
            {
              label: "Review check belum tersedia",
              value:
                "Sistem tidak berhasil memeriksa catatan review saat ini. Cek ulang data sebelum approve.",
            },
          ]);
          setPassedIndicators([]);
          setIssuesLoading(false);
        }
      }
    };

    void loadIssues();
    return () => {
      isMounted = false;
    };
  }, [borrow?.id, shouldShowBorrowReviewCheck]);

  if (isLoading) return <PanelLoadingState />;
  if (error || !borrow) {
    return (
      <PanelErrorState
        message={error || "Data peminjaman alat tidak ditemukan."}
      />
    );
  }

  const waitingForMentorApproval = isWaitingForMentorApproval(borrow);
  const showBorrowReviewCheck =
    shouldShowBorrowReviewCheck && !waitingForMentorApproval;
  const reviewer = isReviewerRole(profile?.role);
  const canReviewBorrow = canCurrentUserReviewPendingRequest(
    borrow,
    profile?.id,
    profile?.role,
  );
  const canFinalizeBorrow = canCurrentUserFinalizeRequest(
    borrow,
    profile?.id,
    profile?.role,
  );
  const canHandoverBorrow = canFinalizeBorrow && isApprovedStatus(borrow.status);
  const canConfirmReturn = canFinalizeBorrow && canReturnStatus(borrow.status);
  const canFinalizeInspection =
    canFinalizeBorrow && isInspectionPendingStatus(borrow.status);
  const mentorHint = getMentorApprovalHint(
    waitingForMentorApproval,
    String(profile?.id ?? "") === borrow.requesterMentorProfileId,
  );
  const isGuestRequester = isGuestRole(borrow.requesterRole);
  const borrowStatusHint = getBorrowStatusHint(borrow.status, reviewer);
  const borrowStatusActionClass = getBorrowStatusActionClass(borrow.status);

  const handleBorrowAction = async (rejectionNote?: string) => {
    if (!confirmType) return;

    const type = confirmType;
    const result = await updateBorrowStatus(
      borrow.id,
      type,
      type === "reject" ? { rejectionNote } : undefined,
    );
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    const now = new Date().toISOString();
    setBorrow((current) =>
      current
        ? {
            ...current,
            status:
              type === "approve"
                ? "Approved"
                : type === "reject"
                  ? "Rejected"
                  : type === "handover"
                    ? "Borrowed"
                    : "Returned",
            updatedAt: now,
            rejectionNote:
              type === "reject"
                ? String(rejectionNote ?? current.rejectionNote ?? "")
                : current.rejectionNote,
            approvedById:
              type === "approve"
                ? String(profile?.id ?? current.approvedById)
                : current.approvedById,
            approvedByName:
              type === "approve"
                ? profile?.name || current.approvedByName
                : current.approvedByName,
          }
        : current,
    );
    setConfirmType(null);

    toast.success(
      type === "approve"
        ? "Pengajuan peminjaman alat berhasil disetujui."
        : type === "reject"
          ? "Pengajuan peminjaman alat berhasil ditolak."
          : type === "handover"
            ? "Serah-terima alat berhasil dikonfirmasi."
            : "Pengembalian alat berhasil difinalisasi.",
    );
    onActionComplete?.();
  };

  const handleReturnSubmit = async () => {
    const now = new Date().toISOString();
    const result = await updateBorrowStatus(borrow.id, "receive_return", {
      endTimeActual: now,
    });

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setBorrow((current) =>
      current
        ? {
            ...current,
            status: "Returned Pending Inspection",
            updatedAt: now,
            endTimeActual: now,
          }
        : current,
    );
    setIsReturnConfirmOpen(false);
    toast.success("Pengembalian alat diterima dan menunggu inspeksi.");
    onActionComplete?.();
  };

  const handleInspectionSubmit = async () => {
    if (!inspectionAction || !inspectionNote.trim()) {
      toast.error("Catatan inspeksi wajib diisi.");
      return;
    }

    const result = await updateBorrowStatus(borrow.id, inspectionAction, {
      inspectionNote,
    });

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    const now = new Date().toISOString();
    setBorrow((current) =>
      current
        ? {
            ...current,
            status: "Lost/Damaged",
            updatedAt: now,
            inspectionNote: inspectionNote.trim(),
          }
        : current,
    );
    setInspectionAction(null);
    setInspectionNote("");
    toast.success(
      inspectionAction === "mark_damaged"
        ? "Borrow ditandai sebagai rusak."
        : "Borrow ditandai sebagai hilang.",
    );
    onActionComplete?.();
  };

  const reviewMeta = [
    { label: "Alat", value: borrow.equipmentName || "-" },
    { label: "Ruangan", value: borrow.roomName || "-" },
    { label: "Pemohon", value: borrow.requesterName },
    { label: "Ditujukan ke PIC", value: borrow.roomPicName || "-" },
    {
      label: "Mulai peminjaman",
      value: formatDateTimeWib(borrow.startTime),
    },
    { label: "Jumlah", value: borrow.quantity || "-" },
    { label: "Tujuan", value: borrow.purpose || "-" },
    ...(isGuestRequester
      ? [
          { label: "Institusi", value: borrow.institution || "-" },
          {
            label: "Alamat Institusi",
            value: borrow.institutionAddress || "-",
          },
        ]
      : []),
    ...(borrow.status === "Rejected"
      ? [
          {
            label: "Waktu Ditolak",
            value: formatDateTimeWib(borrow.rejectedAt),
          },
          {
            label: "Alasan Penolakan",
            value: borrow.rejectionNote || "-",
          },
        ]
      : []),
    ...(borrow.status === "Expired"
      ? [
          {
            label: "Waktu Kedaluwarsa",
            value: formatDateTimeWib(borrow.expiredAt),
          },
        ]
      : []),
  ];

  return (
    <>
      <RequestReviewCard
        status={borrow.status}
        code={borrow.code}
        meta={reviewMeta}
        checklist={showBorrowReviewCheck ? reviewIssues : []}
        checklistLoading={showBorrowReviewCheck ? issuesLoading : false}
        showChecklistSection={showBorrowReviewCheck}
        checklistEmptyMessage={
          showBorrowReviewCheck
            ? "Tidak ada catatan review. Pengajuan ini siap diproses."
            : undefined
        }
        checklistPassedIndicators={
          showBorrowReviewCheck ? passedIndicators : []
        }
        statusHintTitle={mentorHint?.title ?? borrowStatusHint?.title}
        statusHintMessage={mentorHint?.message ?? borrowStatusHint?.message}
        statusHintIndicators={mentorHint?.indicators ?? borrowStatusHint?.indicators}
        statusHintClassName={mentorHint?.className ?? borrowStatusHint?.className}
        statusHintTitleClassName={mentorHint?.titleClassName ?? borrowStatusHint?.titleClassName}
        statusHintTextClassName={mentorHint?.textClassName ?? borrowStatusHint?.textClassName}
      >
        {canReviewBorrow ? (
          <>
            <Button
              type="button"
              className="h-10 rounded-md border border-emerald-600 bg-emerald-600 px-4 text-white shadow-sm hover:bg-emerald-700"
              onClick={() => setConfirmType("approve")}
              disabled={pendingAction.borrowId === borrow.id}
            >
              <Check className="h-4 w-4" />
              Setujui
            </Button>
            <Button
              type="button"
              className="h-10 rounded-md border border-rose-600 bg-rose-600 px-4 text-white shadow-sm hover:bg-rose-700"
              onClick={() => setConfirmType("reject")}
              disabled={pendingAction.borrowId === borrow.id}
            >
              <X className="h-4 w-4" />
              Tolak
            </Button>
          </>
        ) : null}
        {canHandoverBorrow ? (
          <Button
            type="button"
            className={`h-10 rounded-md border px-4 shadow-sm ${borrowStatusActionClass}`}
            onClick={() => setConfirmType("handover")}
            disabled={pendingAction.borrowId === borrow.id}
          >
            <Handshake className="h-4 w-4" />
            Serah Terima
          </Button>
        ) : null}
        {canConfirmReturn ? (
          <Button
            type="button"
            className={`h-10 rounded-md border px-4 shadow-sm ${borrowStatusActionClass}`}
            onClick={() => setIsReturnConfirmOpen(true)}
            disabled={pendingAction.borrowId === borrow.id}
          >
            <RotateCcw className="h-4 w-4" />
            Konfirmasi Pengembalian
          </Button>
        ) : null}
        {canFinalizeInspection ? (
          <>
            <Button
              type="button"
              className={`h-10 rounded-md border px-4 shadow-sm ${borrowStatusActionClass}`}
              onClick={() => setConfirmType("finalize_return")}
              disabled={pendingAction.borrowId === borrow.id}
            >
              <ShieldCheck className="h-4 w-4" />
              Finalisasi Return
            </Button>
            <Button
              type="button"
              className="h-10 rounded-md border border-amber-600 bg-amber-600 px-4 text-white shadow-sm hover:bg-amber-700"
              onClick={() => setInspectionAction("mark_damaged")}
              disabled={pendingAction.borrowId === borrow.id}
            >
              <TriangleAlert className="h-4 w-4" />
              Tandai Rusak
            </Button>
            <Button
              type="button"
              className="h-10 rounded-md border border-rose-600 bg-rose-600 px-4 text-white shadow-sm hover:bg-rose-700"
              onClick={() => setInspectionAction("mark_lost")}
              disabled={pendingAction.borrowId === borrow.id}
            >
              <X className="h-4 w-4" />
              Tandai Hilang
            </Button>
          </>
        ) : null}
      </RequestReviewCard>

      <StatusConfirmDialog
        open={Boolean(confirmType)}
        actionType={
          confirmType === "reject" ? "reject" : confirmType ? "approve" : null
        }
        onOpenChange={(open) => {
          if (!open) setConfirmType(null);
        }}
        onConfirm={handleBorrowAction}
        isSubmitting={pendingAction.borrowId === borrow.id}
        subjectLabel={
          confirmType === "handover"
            ? "serah-terima alat ini"
            : confirmType === "finalize_return"
              ? "finalisasi pengembalian alat ini"
              : "pengajuan peminjaman alat ini"
        }
        requireReasonOnReject={confirmType === "reject"}
      />

      <StatusConfirmDialog
        open={isReturnConfirmOpen}
        actionType="approve"
        onOpenChange={setIsReturnConfirmOpen}
        onConfirm={handleReturnSubmit}
        isSubmitting={
          pendingAction.borrowId === borrow.id &&
          pendingAction.type === "receive_return"
        }
        subjectLabel="pengembalian alat ini"
      />

      <AlertDialog
        open={Boolean(inspectionAction)}
        onOpenChange={(open) => {
          if (!open) {
            setInspectionAction(null);
            setInspectionNote("");
          }
        }}
      >
        <AlertDialogContent className="max-w-lg border-slate-200 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
          <AlertDialogHeader className="place-items-start text-left">
            <AlertDialogTitle>
              {inspectionAction === "mark_damaged"
                ? "Tandai Alat Rusak"
                : "Tandai Alat Hilang"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Isi catatan inspeksi sebelum menyimpan hasil pemeriksaan alat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">
              Catatan inspeksi
            </p>
            <Textarea
              value={inspectionNote}
              onChange={(event) => setInspectionNote(event.target.value)}
              rows={4}
              placeholder="Tuliskan detail hasil inspeksi..."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingAction.borrowId === borrow.id}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleInspectionSubmit}
              disabled={pendingAction.borrowId === borrow.id}
              className={
                inspectionAction === "mark_damaged"
                  ? "rounded-md bg-amber-600 text-white hover:bg-amber-700"
                  : "rounded-md bg-rose-600 text-white hover:bg-rose-700"
              }
            >
              {pendingAction.borrowId === borrow.id ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : inspectionAction === "mark_damaged" ? (
                "Ya, Tandai Rusak"
              ) : (
                "Ya, Tandai Hilang"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PengujianReviewPanel({
  id,
  onActionComplete,
  initialSampleTesting,
}: {
  id: string;
  onActionComplete?: () => void;
  initialSampleTesting?: SampleTestingRow | null;
}) {
  const { profile } = useLoadProfile();
  const { sampleTesting, setSampleTesting, isLoading, error } = useSampleTestingDetail(id, {
    enabled: !initialSampleTesting,
    initialSampleTesting,
  });
  const { updateSampleTestingStatus, pendingAction } = useUpdateSampleTestingStatus();
  const [confirmType, setConfirmType] = useState<"approve" | "reject" | "complete" | null>(
    null,
  );

  if (isLoading) return <PanelLoadingState />;
  if (error || !sampleTesting) {
    return (
      <PanelErrorState
        message={error || "Data pengujian sampel tidak ditemukan."}
      />
    );
  }

  const canReviewSampleTesting =
    isSampleTestingApproverRole(profile?.role) && isPendingStatus(sampleTesting.status);
  const canCompleteSampleTesting =
    isSampleTestingApproverRole(profile?.role) &&
    ["approved", "diproses"].includes(normalizeStatus(sampleTesting.status));
  const isGuestRequester = isGuestRole(sampleTesting.requesterRole);
  const sampleTestingStatusHint = getPengujianStatusHint(
    sampleTesting.status,
    isSampleTestingApproverRole(profile?.role),
  );

  const handlePengujianAction = async () => {
    if (!confirmType) return;

    const type = confirmType;
    const result = await updateSampleTestingStatus(sampleTesting.id, type);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    const now = new Date().toISOString();
    setSampleTesting((current) =>
      current
        ? {
            ...current,
            status:
              type === "approve"
                ? "Approved"
                : type === "complete"
                  ? "Completed"
                  : "Rejected",
            updatedAt: now,
            approvedById:
              type === "approve"
                ? String(profile?.id ?? current.approvedById)
                : current.approvedById,
            approvedByName:
              type === "approve"
                ? profile?.name || current.approvedByName
                : current.approvedByName,
            approvedAt: type === "approve" ? now : current.approvedAt,
            rejectedAt: type === "reject" ? now : current.rejectedAt,
            completedAt: type === "complete" ? now : current.completedAt,
          }
        : current,
    );
    setConfirmType(null);

    toast.success(
      type === "approve"
        ? "Pengajuan pengujian sampel berhasil disetujui."
        : type === "complete"
          ? "Pengajuan pengujian sampel berhasil ditandai selesai."
          : "Pengajuan pengujian sampel berhasil ditolak.",
    );
    onActionComplete?.();
  };

  return (
    <>
      <RequestReviewCard
        status={sampleTesting.status}
        code={sampleTesting.code}
        itemGridClassName="md:grid-cols-[124px_minmax(0,1fr)]"
        meta={[
          { label: "Sampel", value: sampleTesting.sampleName || "-" },
          { label: "Jenis Sampel", value: sampleTesting.sampleType || "-" },
          {
            label: "Jenis Pengujian",
            value: sampleTesting.sampleTestingType || "-",
          },
          { label: "Pemohon", value: sampleTesting.name || "-" },
          ...(isGuestRequester
            ? [{ label: "Institusi", value: sampleTesting.institution || "-" }]
            : []),

          ...(!isGuestRequester
            ? [
                {
                  label: "Prodi Pemohon",
                  value: sampleTesting.requesterDepartment || "-",
                },
              ]
            : []),
          ...(isGuestRequester
            ? [
                {
                  label: "Alamat Institusi",
                  value: sampleTesting.institutionAddress || "-",
                },
              ]
            : []),
          ...(sampleTesting.status === "Rejected"
            ? [
                {
                  label: "Waktu Ditolak",
                  value: formatDateTimeWib(sampleTesting.rejectedAt),
                },
              ]
            : []),
          ...(sampleTesting.status === "Completed"
            ? [
                {
                  label: "Waktu Selesai",
                  value: formatDateTimeWib(sampleTesting.completedAt),
                },
              ]
            : []),
        ]}
        statusHintTitle={sampleTestingStatusHint?.title}
        statusHintMessage={sampleTestingStatusHint?.message}
        statusHintIndicators={sampleTestingStatusHint?.indicators}
        statusHintClassName={sampleTestingStatusHint?.className}
        statusHintTitleClassName={sampleTestingStatusHint?.titleClassName}
        statusHintTextClassName={sampleTestingStatusHint?.textClassName}
      >
        {canReviewSampleTesting ? (
          <>
            <Button
              type="button"
              className="h-10 rounded-md border border-emerald-600 bg-emerald-600 px-4 text-white shadow-sm hover:bg-emerald-700"
              onClick={() => setConfirmType("approve")}
              disabled={pendingAction.sampleTestingId === sampleTesting.id}
            >
              <Check className="h-4 w-4" />
              Setujui
            </Button>
            <Button
              type="button"
              className="h-10 rounded-md border border-rose-600 bg-rose-600 px-4 text-white shadow-sm hover:bg-rose-700"
              onClick={() => setConfirmType("reject")}
              disabled={pendingAction.sampleTestingId === sampleTesting.id}
            >
              <X className="h-4 w-4" />
              Tolak
            </Button>
          </>
        ) : null}
        {canCompleteSampleTesting ? (
          <Button
            type="button"
            className="h-10 rounded-md border border-sky-600 bg-sky-600 px-4 text-white shadow-sm hover:bg-sky-700"
            onClick={() => setConfirmType("complete")}
            disabled={pendingAction.sampleTestingId === sampleTesting.id}
          >
            <Check className="h-4 w-4" />
            Tandai Selesai
          </Button>
        ) : null}
      </RequestReviewCard>

      <StatusConfirmDialog
        open={Boolean(confirmType)}
        actionType={confirmType}
        onOpenChange={(open) => {
          if (!open) setConfirmType(null);
        }}
        onConfirm={handlePengujianAction}
        isSubmitting={pendingAction.sampleTestingId === sampleTesting.id}
        subjectLabel={
          confirmType === "complete"
            ? "pengajuan pengujian sampel ini sebagai selesai"
            : "pengajuan pengujian sampel ini"
        }
      />
    </>
  );
}

export function parseReviewContext(pathname: string): ReviewContext {
  const parts = pathname.split("/").filter(Boolean);

  if (parts[0] === "booking-rooms" && parts[1] === "approval" && parts[2]) {
    return { kind: "booking", id: parts[2] };
  }
  if (parts[0] === "borrow-equipment" && parts[1] === "approval" && parts[2]) {
    return { kind: "borrow", id: parts[2] };
  }
  if (parts[0] === "sample-testing" && parts[1] === "approval" && parts[2]) {
    return { kind: "sample-testing", id: parts[2] };
  }

  return null;
}

export function DashboardDetailReviewPanel({
  context,
  onActionComplete,
  initialBooking,
  initialBorrow,
  initialSampleTesting,
}: {
  context: Exclude<ReviewContext, null>;
  onActionComplete?: () => void;
  initialBooking?: BookingRow | null;
  initialBorrow?: BorrowRow | null;
  initialSampleTesting?: SampleTestingRow | null;
}) {
  if (context.kind === "booking") {
    return (
      <BookingReviewPanel
        id={context.id}
        onActionComplete={onActionComplete}
        initialBooking={initialBooking}
      />
    );
  }

  if (context.kind === "sample-testing") {
    return (
      <PengujianReviewPanel
        id={context.id}
        onActionComplete={onActionComplete}
        initialSampleTesting={initialSampleTesting}
      />
    );
  }

  return (
    <BorrowReviewPanel
      id={context.id}
      onActionComplete={onActionComplete}
      initialBorrow={initialBorrow}
    />
  );
}
