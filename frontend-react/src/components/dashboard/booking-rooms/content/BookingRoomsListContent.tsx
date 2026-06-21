"use client";


import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Eye,
  Loader2,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DashboardDetailReviewDialog } from "@/components/dashboard/layout";
import { DashboardListTable } from "@/components/dashboard/shared";
import { DeleteRequestConfirmDialog } from "@/components/dialogs";

import {
  DataPagination,
  RequestProgressDialog,
  type ProgressStepItem,
  TableActionIconButton,
} from "@/components/shared";

import {
  useCreateBookingRoom,
  useBookings,
  useUpdateBookingStatus,
  type BookingListScope,
} from "@/hooks/booking-rooms";

import { useLoadProfile } from "@/hooks/shared/profile";

import { ROLE_VALUES, normalizeRoleValue } from "@/constants/roles";

import {
  toEndOfDay,
  toStartOfDay,
} from "@/lib/date";

import { formatDateTimeWib } from "@/lib/date";

import {
  canCurrentUserReviewPendingRequest,
  isWaitingForMentorApproval,
  requiresMentorApproval,
} from "@/lib/request";

import { getBookingProgressFlow } from "@/lib/request";

import {
  getRequestStatusDisplayLabel,
  getStatusBadgeClass,
  getStatusSummaryTone,
  normalizeStatus,
  shouldShowReviewAction,
} from "@/lib/request";

const PAGE_SIZE = 20;
const MENTOR_PAGE_SIZE = 5;
const TABLE_COLUMN_WIDTHS = [
  "10rem",
  "16rem",
  "12rem",
  "12rem",
  "12rem",
  "12rem",
  "10rem",
  "8rem",
] as const;

function SummaryCard({
  label,
  value,
  icon,
  tone,
  isActive = false,
  onClick,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: "slate" | "blue" | "amber" | "emerald" | "sky" | "rose";
  isActive?: boolean;
  onClick?: () => void;
}) {
  const toneClass =
    tone === "blue"
      ? {
          card: "border-blue-300 bg-blue-100/90",
          activeCard:
            "border-blue-600 bg-blue-600 shadow-[0_14px_28px_rgba(37,99,235,0.32)] ring-2 ring-blue-200/80 ring-offset-2",
          icon: "bg-white/80 text-blue-800",
          activeIcon: "bg-white/20 text-white",
          label: "text-slate-500",
          activeLabel: "text-blue-50",
          value: "text-blue-900",
          activeValue: "text-white",
        }
      : tone === "amber"
        ? {
            card: "border-amber-300 bg-amber-100/90",
            activeCard:
              "border-amber-500 bg-amber-400 shadow-[0_14px_28px_rgba(245,158,11,0.32)] ring-2 ring-amber-200/90 ring-offset-2",
            icon: "bg-white/80 text-amber-800",
            activeIcon: "bg-white/25 text-slate-950",
            label: "text-slate-500",
            activeLabel: "text-amber-950/80",
            value: "text-amber-900",
            activeValue: "text-slate-950",
          }
        : tone === "emerald"
          ? {
              card: "border-emerald-300 bg-emerald-100/90",
              activeCard:
                "border-emerald-600 bg-emerald-600 shadow-[0_14px_28px_rgba(5,150,105,0.32)] ring-2 ring-emerald-200/80 ring-offset-2",
              icon: "bg-white/80 text-emerald-800",
              activeIcon: "bg-white/20 text-white",
              label: "text-slate-500",
              activeLabel: "text-emerald-50",
              value: "text-emerald-900",
              activeValue: "text-white",
            }
          : tone === "sky"
            ? {
                card: "border-sky-300 bg-sky-100/90",
                activeCard:
                  "border-sky-600 bg-sky-600 shadow-[0_14px_28px_rgba(2,132,199,0.3)] ring-2 ring-sky-200/80 ring-offset-2",
                icon: "bg-white/80 text-sky-800",
                activeIcon: "bg-white/20 text-white",
                label: "text-slate-500",
                activeLabel: "text-sky-50",
                value: "text-sky-900",
                activeValue: "text-white",
              }
            : tone === "rose"
              ? {
                  card: "border-rose-300 bg-rose-100/90",
                  activeCard:
                    "border-rose-600 bg-rose-600 shadow-[0_14px_28px_rgba(225,29,72,0.3)] ring-2 ring-rose-200/80 ring-offset-2",
                  icon: "bg-white/80 text-rose-800",
                  activeIcon: "bg-white/20 text-white",
                  label: "text-slate-500",
                  activeLabel: "text-rose-50",
                  value: "text-rose-900",
                  activeValue: "text-white",
                }
              : {
                  card: "border-slate-300 bg-slate-100/90",
                  activeCard:
                    "border-slate-700 bg-slate-700 shadow-[0_14px_28px_rgba(51,65,85,0.28)] ring-2 ring-slate-200/80 ring-offset-2",
                  icon: "bg-white/80 text-slate-800",
                  activeIcon: "bg-white/15 text-white",
                  label: "text-slate-500",
                  activeLabel: "text-slate-100",
                  value: "text-slate-900",
                  activeValue: "text-white",
                };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`w-full cursor-pointer rounded-xl border p-3 text-left shadow-[0_4px_14px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.14)] ${
        isActive ? toneClass.activeCard : toneClass.card
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-h-14 flex-col justify-between">
          <p
            className={`text-xs font-medium uppercase tracking-wide ${
              isActive ? toneClass.activeLabel : toneClass.label
            }`}
          >
            {label}
          </p>
          <p
            className={`text-2xl font-semibold leading-none ${
              isActive ? toneClass.activeValue : toneClass.value
            }`}
          >
            {value}
          </p>
        </div>
        <div
          className={`rounded-lg p-2 ${
            isActive ? toneClass.activeIcon : toneClass.icon
          }`}
        >
          {icon}
        </div>
      </div>
    </button>
  );
}

type BookingRoomsListContentProps = {
  scope: BookingListScope;
  emptyMessage: string;
};

export default function BookingRoomsListContent({
  scope,
  emptyMessage,
}: BookingRoomsListContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useLoadProfile();
  const [page, setPage] = useState(1);
  const [mentorPage, setMentorPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    code: string;
  } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{
    id: string;
    code: string;
  } | null>(null);
  const [progressState, setProgressState] = useState<{
    code: string;
    steps: ProgressStepItem[];
  } | null>(null);
  const status = searchParams.get("status") ?? "";
  const search = searchParams.get("q") ?? "";
  const room = searchParams.get("room") ?? "";
  const requestedBy = searchParams.get("requested_by") ?? "";
  const createdAfter = searchParams.get("created_after") ?? "";
  const createdBefore = searchParams.get("created_before") ?? "";
  const normalizedStatus = normalizeStatus(status);
  const isActiveFilter = scope === "all" && status === "active";
  const resolvedEmptyMessage = isActiveFilter
    ? "Tidak ada pengajuan aktif peminjaman lab yang menjadi tanggung jawab Anda."
    : scope === "all"
      ? "Belum ada pengajuan peminjaman lab yang perlu Anda proses."
      : emptyMessage;

  useEffect(() => {
    setPage(1);
  }, [status, search, room, requestedBy, createdAfter, createdBefore]);

  useEffect(() => {
    setMentorPage(1);
  }, [status, search, room, requestedBy, createdAfter, createdBefore]);

  const { bookings, totalCount, aggregates, isLoading, hasLoadedOnce, error } = useBookings(
    page,
    PAGE_SIZE,
    {
      q: search,
      status,
      room,
      requestedBy: scope === "all" ? requestedBy : "",
      createdAfter: createdAfter ? toStartOfDay(createdAfter) : "",
      createdBefore: createdBefore ? toEndOfDay(createdBefore) : "",
    },
    reloadKey,
    scope,
  );

  const normalizedRole = normalizeRoleValue(profile?.role);
  const showMentorApprovalSection =
    scope === "all" && normalizedRole === ROLE_VALUES.LECTURER;
  const {
    bookings: mentorBookingRows,
    totalCount: mentorTotalCount,
    isLoading: isMentorLoading,
    hasLoadedOnce: hasLoadedMentorOnce,
  } = useBookings(
    mentorPage,
    MENTOR_PAGE_SIZE,
    {
      q: search,
      status,
      room,
      requestedBy: scope === "all" ? requestedBy : "",
      reviewerScope: "mentor",
      createdAfter: createdAfter ? toStartOfDay(createdAfter) : "",
      createdBefore: createdBefore ? toEndOfDay(createdBefore) : "",
    },
    reloadKey,
    "all",
    {
      enabled: showMentorApprovalSection,
    },
  );
  const { deleteBookingRoom, isSubmitting: isDeletingBooking } =
    useCreateBookingRoom();
  const { updateBookingStatus, pendingAction } = useUpdateBookingStatus();
  const canReviewBookings =
    scope === "all" &&
    (normalizedRole === ROLE_VALUES.ADMIN ||
      normalizedRole === ROLE_VALUES.LECTURER);
  const showRequesterColumn = scope === "all";
  const currentProfileId = String(profile?.id ?? "");

  const filteredBookings = useMemo(
    () =>
      bookings.filter(
        (booking) => booking.roomName && booking.roomName !== "-",
      ),
    [bookings],
  );
  const mentorBookings = useMemo(
    () =>
      mentorBookingRows.filter(
        (booking) =>
          requiresMentorApproval(booking) &&
          booking.requesterMentorProfileId === currentProfileId,
      ),
    [currentProfileId, mentorBookingRows],
  );
  const generalBookings = useMemo(
    () =>
      filteredBookings.filter((booking) => {
        const isMentor =
          currentProfileId !== "" &&
          booking.requesterMentorProfileId === currentProfileId &&
          requiresMentorApproval(booking);
        const isPic = booking.roomPicIds.includes(currentProfileId);

        if (isMentor && !isPic) {
          return false;
        }

        return true;
      }),
    [currentProfileId, filteredBookings],
  );
  const totalPages = Math.max(
    1,
    Math.ceil((totalCount || filteredBookings.length) / PAGE_SIZE),
  );
  const mentorTotalPages = Math.max(
    1,
    Math.ceil((mentorTotalCount || mentorBookings.length) / MENTOR_PAGE_SIZE),
  );
  const pendingCount = aggregates.pending;
  const approvedCount = aggregates.approved;
  const completedCount = aggregates.completed;
  const rejectedCount = aggregates.rejected;
  const expiredCount = aggregates.expired;

  const canShowReviewButton = (booking: (typeof filteredBookings)[number]) => {
    if (!canReviewBookings || !shouldShowReviewAction("booking", booking.status)) {
      return false;
    }

    const isMentor = currentProfileId !== "" && booking.requesterMentorProfileId === currentProfileId;
    const isPic = booking.roomPicIds.includes(currentProfileId);

    // Jika user adalah dosen pembimbing tapi JUGA PIC ruangan → tetap tampilkan tombol.
    // Jika hanya dosen pembimbing (bukan PIC) → sembunyikan, sudah ditangani di seksi mentor.
    if (isMentor && !isPic) {
      return false;
    }

    return true;
  };

  const canManageBooking = (booking: (typeof filteredBookings)[number]) =>
    scope !== "all" && normalizeStatus(booking.status) === "pending";

  const canCancelBooking = (booking: (typeof filteredBookings)[number]) =>
    scope !== "all" && normalizeStatus(booking.status) === "approved";

  const handleDeleteBooking = async () => {
    if (!deleteTarget) return;

    const result = await deleteBookingRoom(deleteTarget.id);
    if (!result.ok) return;

    setDeleteTarget(null);
    setReloadKey((prev) => prev + 1);
  };

  const handleCancelBooking = async () => {
    if (!cancelTarget) return;

    const result = await updateBookingStatus(cancelTarget.id, "cancel");
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Pengajuan peminjaman lab berhasil dibatalkan.");
    setCancelTarget(null);
    setReloadKey((prev) => prev + 1);
  };

  const handleStatusCardClick = (nextStatus: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const normalizedNextStatus = normalizeStatus(nextStatus);

    if (!normalizedNextStatus || normalizedNextStatus === normalizedStatus) {
      params.delete("status");
    } else {
      params.set("status", nextStatus);
    }

    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  };

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <SummaryCard
          label="Total Pengajuan"
          value={aggregates.total}
          icon={<Building2 className="h-4 w-4" />}
          tone={getStatusSummaryTone("total")}
          isActive={!normalizedStatus}
          onClick={() => handleStatusCardClick("")}
        />
        <SummaryCard
          label="Menunggu"
          value={pendingCount}
          icon={<CalendarClock className="h-4 w-4" />}
          tone={getStatusSummaryTone("pending")}
          isActive={normalizedStatus === "pending"}
          onClick={() => handleStatusCardClick("pending")}
        />
        <SummaryCard
          label="Disetujui"
          value={approvedCount}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone={getStatusSummaryTone("approved")}
          isActive={normalizedStatus === "approved"}
          onClick={() => handleStatusCardClick("approved")}
        />
        <SummaryCard
          label="Selesai"
          value={completedCount}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone={getStatusSummaryTone("completed")}
          isActive={normalizedStatus === "completed"}
          onClick={() => handleStatusCardClick("completed")}
        />
        <SummaryCard
          label="Ditolak"
          value={rejectedCount}
          icon={<RotateCcw className="h-4 w-4" />}
          tone={getStatusSummaryTone("rejected")}
          isActive={normalizedStatus === "rejected"}
          onClick={() => handleStatusCardClick("rejected")}
        />
        <SummaryCard
          label="Kedaluwarsa"
          value={expiredCount}
          icon={<X className="h-4 w-4" />}
          tone={getStatusSummaryTone("expired")}
          isActive={normalizedStatus === "expired"}
          onClick={() => handleStatusCardClick("expired")}
        />
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {showMentorApprovalSection ? (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Approval Dosen Pembimbing
            </h2>
            <p className="text-xs text-slate-600">
              Pengajuan Skripsi/TA yang ditujukan kepada Anda sebagai dosen pembimbing.
            </p>
          </div>
          <div className="max-h-[28rem] w-full max-w-full overflow-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1120px]">
              <colgroup>
                {TABLE_COLUMN_WIDTHS.map((width) => (
                  <col key={width} style={{ width }} />
                ))}
              </colgroup>
              <thead className="border-b border-slate-800 bg-slate-900">
                <tr className="text-left text-sm">
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">Kode</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">Ruangan</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">Pemohon</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">Tujuan</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">Waktu Mulai</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">Waktu Selesai</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">Status</th>
                  <th className="sticky right-0 z-20 bg-slate-900 px-3 py-3 text-center font-medium whitespace-nowrap text-slate-50 shadow-[-1px_0_0_0_rgba(51,65,85,1)]">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {isMentorLoading || !hasLoadedMentorOnce ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-5 text-center text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat data...
                      </div>
                    </td>
                  </tr>
                ) : mentorBookings.length ? (
                  mentorBookings.map((booking) => (
                    <tr key={`mentor-${String(booking.id)}`} className="border-b last:border-b-0">
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap text-slate-800">
                        {booking.code}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{booking.roomName}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{booking.requesterName}</td>
                      <td className="px-3 py-2.5 text-slate-700">{booking.purpose}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                        {formatDateTimeWib(booking.startTime)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                        {formatDateTimeWib(booking.endTime)}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            setProgressState({
                              code: booking.code,
                              steps: getBookingProgressFlow(booking),
                            })
                          }
                          className={`inline-flex cursor-pointer rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(booking.status)}`}
                        >
                          {getRequestStatusDisplayLabel(booking.status)}
                        </button>
                      </td>
                      <td className="sticky right-0 z-10 bg-white px-3 py-2.5 text-center shadow-[-1px_0_0_0_rgba(226,232,240,1)]">
                        <div className="flex items-center justify-center gap-2">
                          {isWaitingForMentorApproval(booking) &&
                          canCurrentUserReviewPendingRequest(
                            booking,
                            profile?.id,
                            profile?.role,
                          ) ? (
                            <TableActionIconButton
                              type="button"
                              label="Review"
                              icon={<ShieldCheck className="h-3.5 w-3.5" />}
                              className="w-8 rounded-md border border-sky-200 bg-sky-50 p-0 text-sky-700 shadow-none hover:bg-sky-100"
                              onClick={() => setReviewBookingId(String(booking.id))}
                            />
                          ) : null}
                          <TableActionIconButton
                            type="button"
                            label="Lihat detail"
                            icon={<Eye className="h-3.5 w-3.5" />}
                            className="w-8 rounded-md border border-slate-200 bg-slate-50 p-0 text-slate-700 shadow-none hover:bg-slate-100"
                            onClick={() => router.push(`/booking-rooms/approval/${booking.id}`)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-3 py-5 text-center text-slate-500">
                      Belum ada pengajuan Skripsi/TA pada tabel dosen pembimbing Anda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {mentorTotalPages > 1 ? (
            <div className="w-full">
              <DataPagination
                page={mentorPage}
                totalPages={mentorTotalPages}
                totalCount={mentorTotalCount || mentorBookings.length}
                pageSize={MENTOR_PAGE_SIZE}
                itemLabel="approval dosen pembimbing"
                isLoading={isMentorLoading}
                onPageChange={setMentorPage}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <DashboardListTable
        columns={[
          { key: "code", label: "Kode" },
          { key: "room", label: "Ruangan" },
          ...(showRequesterColumn
            ? [{ key: "requester", label: "Pemohon" }]
            : []),
          { key: "purpose", label: "Tujuan" },
          { key: "start", label: "Waktu Mulai" },
          { key: "end", label: "Waktu Selesai" },
          { key: "status", label: "Status" },
          {
            key: "actions",
            label: "Aksi",
            className:
              "sticky right-0 z-20 bg-slate-900 text-center shadow-[-1px_0_0_0_rgba(51,65,85,1)]",
          },
        ]}
        colSpan={showRequesterColumn ? 8 : 7}
        hasRows={generalBookings.length > 0}
        isLoading={isLoading}
        hasLoadedOnce={hasLoadedOnce}
        emptyMessage={resolvedEmptyMessage}
        tableClassName="min-w-[1120px]"
        colGroup={
          <colgroup>
            {TABLE_COLUMN_WIDTHS.slice(0, showRequesterColumn ? 8 : 7).map((width) => (
              <col key={width} style={{ width }} />
            ))}
          </colgroup>
        }
      >
        {generalBookings.map((booking) => (
          <tr key={String(booking.id)} className="border-b last:border-b-0">
            <td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">
              {booking.code}
            </td>
            <td className="px-3 py-2.5 whitespace-nowrap">{booking.roomName}</td>
            {showRequesterColumn ? (
              <td className="px-3 py-2.5 whitespace-nowrap">{booking.requesterName}</td>
            ) : null}
            <td className="px-3 py-2.5 text-slate-700">{booking.purpose}</td>
            <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
              {formatDateTimeWib(booking.startTime)}
            </td>
            <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
              {formatDateTimeWib(booking.endTime)}
            </td>
            <td className="px-3 py-2.5">
              <button
                type="button"
                onClick={() =>
                  setProgressState({
                    code: booking.code,
                    steps: getBookingProgressFlow(booking),
                  })
                }
                className={`inline-flex cursor-pointer rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(booking.status)}`}
              >
                {getRequestStatusDisplayLabel(booking.status)}
              </button>
            </td>
            <td className="sticky right-0 z-10 bg-white px-3 py-2.5 text-center shadow-[-1px_0_0_0_rgba(226,232,240,1)]">
              <div className="flex items-center justify-center gap-2">
                {canShowReviewButton(booking) ? (
                  <TableActionIconButton
                    type="button"
                    label="Review"
                    icon={<ShieldCheck className="h-3.5 w-3.5" />}
                    className="w-8 rounded-md border border-sky-200 bg-sky-50 p-0 text-sky-700 shadow-none hover:bg-sky-100"
                    onClick={() => setReviewBookingId(String(booking.id))}
                  />
                ) : null}
                {canManageBooking(booking) ? (
                  <>
                    <TableActionIconButton
                      type="button"
                      label="Edit"
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      className="w-8 rounded-md border border-amber-200 bg-amber-50 p-0 text-amber-700 shadow-none hover:bg-amber-100"
                      onClick={() => router.push(`/booking-rooms/${booking.id}/edit`)}
                    />
                    <TableActionIconButton
                      type="button"
                      label="Hapus"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      className="w-8 rounded-md border border-rose-200 bg-rose-50 p-0 text-rose-700 shadow-none hover:bg-rose-100"
                      onClick={() =>
                        setDeleteTarget({
                          id: String(booking.id),
                          code: booking.code,
                        })
                      }
                    />
                  </>
                ) : null}
                {canCancelBooking(booking) ? (
                  <TableActionIconButton
                    type="button"
                    label="Batalkan"
                    icon={<X className="h-3.5 w-3.5" />}
                    className="w-8 rounded-md border border-rose-200 bg-rose-50 p-0 text-rose-700 shadow-none hover:bg-rose-100"
                    onClick={() =>
                      setCancelTarget({
                        id: String(booking.id),
                        code: booking.code,
                      })
                    }
                  />
                ) : null}
                <TableActionIconButton
                  type="button"
                  label="Lihat detail"
                  icon={<Eye className="h-3.5 w-3.5" />}
                  className="w-8 rounded-md border border-slate-200 bg-slate-50 p-0 text-slate-700 shadow-none hover:bg-slate-100"
                  onClick={() =>
                    router.push(
                      scope === "all"
                        ? `/booking-rooms/approval/${booking.id}`
                        : `/booking-rooms/${booking.id}`,
                    )
                  }
                />
              </div>
            </td>
          </tr>
        ))}
      </DashboardListTable>

      <DataPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount || generalBookings.length}
        pageSize={PAGE_SIZE}
        itemLabel="peminjaman lab"
        isLoading={isLoading}
        onPageChange={setPage}
      />
      <DashboardDetailReviewDialog
        open={Boolean(reviewBookingId)}
        onOpenChange={(open) => {
          if (!open) setReviewBookingId(null);
        }}
        onActionComplete={() => {
          setReloadKey((prev) => prev + 1);
          setReviewBookingId(null);
        }}
        context={
          reviewBookingId
            ? { kind: "booking", id: reviewBookingId }
            : null
        }
      />
      <DeleteRequestConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => void handleDeleteBooking()}
        isSubmitting={isDeletingBooking}
        title="Hapus Pengajuan Booking"
        description={
          deleteTarget
            ? `Pengajuan ${deleteTarget.code} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`
            : "Pengajuan ini akan dihapus permanen."
        }
      />
      <DeleteRequestConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        onConfirm={() => void handleCancelBooking()}
        isSubmitting={pendingAction.bookingId === cancelTarget?.id}
        title="Batalkan pengajuan peminjaman lab ini?"
        description="Status pengajuan akan diubah menjadi dibatalkan dan tidak dapat diproses lanjut."
        confirmLabel="Ya, Batalkan"
      />
      <RequestProgressDialog
        open={Boolean(progressState)}
        onOpenChange={(open) => {
          if (!open) setProgressState(null);
        }}
        title="Progress Peminjaman Lab"
        code={progressState?.code ?? ""}
        steps={progressState?.steps ?? []}
      />
    </section>
  );
}
