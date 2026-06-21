"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  CalendarClock,
  CheckCircle2,
  Eye,
  Hourglass,
  Loader2,
  Package,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Truck,
  Undo2,
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

import { ROLE_VALUES, normalizeRoleValue } from "@/constants/roles";

import {
  useBorrows,
  useCreateBorrow,
  useUpdateBorrowStatus,
} from "@/hooks/borrow-equipment";

import { useLoadProfile } from "@/hooks/shared/profile";

import { toEndOfDay, toStartOfDay } from "@/lib/date";

import { formatDateTimeWib } from "@/lib/date";

import {
  canCurrentUserReviewPendingRequest,
  isWaitingForMentorApproval,
  requiresMentorApproval,
} from "@/lib/request";

import { getBorrowProgressFlow } from "@/lib/request";

import {
  getBorrowStatusDisplayLabel,
  getStatusBadgeClass,
  getStatusSummaryTone,
  normalizeStatus,
  shouldShowReviewAction,
} from "@/lib/request";

const PAGE_SIZE = 20;
const MENTOR_PAGE_SIZE = 5;
const TABLE_COLUMN_WIDTHS = [
  "10rem",
  "14rem",
  "16rem",
  "12rem",
  "8rem",
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
  tone:
    | "slate"
    | "blue"
    | "amber"
    | "emerald"
    | "sky"
    | "rose"
    | "indigo"
    | "cyan"
    | "orange"
    | "red";
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
              : tone === "indigo"
                ? {
                    card: "border-indigo-300 bg-indigo-100/90",
                    activeCard:
                      "border-indigo-600 bg-indigo-600 shadow-[0_14px_28px_rgba(79,70,229,0.32)] ring-2 ring-indigo-200/80 ring-offset-2",
                    icon: "bg-white/80 text-indigo-800",
                    activeIcon: "bg-white/20 text-white",
                    label: "text-slate-500",
                    activeLabel: "text-indigo-50",
                    value: "text-indigo-900",
                    activeValue: "text-white",
                  }
                : tone === "cyan"
                  ? {
                      card: "border-cyan-300 bg-cyan-100/90",
                      activeCard:
                        "border-cyan-600 bg-cyan-600 shadow-[0_14px_28px_rgba(8,145,178,0.3)] ring-2 ring-cyan-200/80 ring-offset-2",
                      icon: "bg-white/80 text-cyan-800",
                      activeIcon: "bg-white/20 text-white",
                      label: "text-slate-500",
                      activeLabel: "text-cyan-50",
                      value: "text-cyan-900",
                      activeValue: "text-white",
                    }
                  : tone === "orange"
                    ? {
                        card: "border-orange-300 bg-orange-100/90",
                        activeCard:
                          "border-orange-600 bg-orange-500 shadow-[0_14px_28px_rgba(234,88,12,0.32)] ring-2 ring-orange-200/80 ring-offset-2",
                        icon: "bg-white/80 text-orange-800",
                        activeIcon: "bg-white/20 text-white",
                        label: "text-slate-500",
                        activeLabel: "text-orange-50",
                        value: "text-orange-900",
                        activeValue: "text-white",
                      }
                    : tone === "red"
                      ? {
                          card: "border-red-300 bg-red-100/90",
                          activeCard:
                            "border-red-600 bg-red-600 shadow-[0_14px_28px_rgba(220,38,38,0.3)] ring-2 ring-red-200/80 ring-offset-2",
                          icon: "bg-white/80 text-red-800",
                          activeIcon: "bg-white/20 text-white",
                          label: "text-slate-500",
                          activeLabel: "text-red-50",
                          value: "text-red-900",
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

export default function BorrowEquipmentListContent({
  scope,
  emptyMessage,
}: {
  scope: "my" | "all";
  emptyMessage: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useLoadProfile();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [mentorPage, setMentorPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [reviewBorrowId, setReviewBorrowId] = useState<string | null>(null);
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
  const equipment = searchParams.get("equipment") ?? "";
  const requestedBy = searchParams.get("requested_by") ?? "";
  const createdAfter = searchParams.get("created_after") ?? "";
  const createdBefore = searchParams.get("created_before") ?? "";
  const normalizedStatus = normalizeStatus(status);
  const isActiveFilter = scope === "all" && status === "active";
  const resolvedEmptyMessage = isActiveFilter
    ? "Tidak ada pengajuan aktif peminjaman alat yang menjadi tanggung jawab Anda."
    : scope === "all"
      ? "Belum ada pengajuan peminjaman alat yang perlu Anda proses."
      : emptyMessage;

  useEffect(() => {
    setPage(1);
  }, [status, search, equipment, requestedBy, createdAfter, createdBefore]);

  useEffect(() => {
    setMentorPage(1);
  }, [status, search, equipment, requestedBy, createdAfter, createdBefore]);

  const { borrows, totalCount, aggregates, isLoading, hasLoadedOnce, error } =
    useBorrows(
      page,
      PAGE_SIZE,
      {
        q: search,
        status,
        requestedBy:
          scope === "my"
            ? String(profile.id ?? "")
            : scope === "all"
              ? requestedBy
              : "",
        equipment,
        createdAfter: createdAfter ? toStartOfDay(createdAfter) : "",
        createdBefore: createdBefore ? toEndOfDay(createdBefore) : "",
      },
      reloadKey,
      scope,
    );

  const filteredBorrows = useMemo(
    () =>
      borrows.filter((item) => {
        if (!item.equipmentName || item.equipmentName === "-") return false;
        return true;
      }),
    [borrows],
  );

  const normalizedRole = normalizeRoleValue(profile?.role);
  const showMentorApprovalSection =
    scope === "all" && normalizedRole === ROLE_VALUES.LECTURER;
  const {
    borrows: mentorBorrowRows,
    totalCount: mentorTotalCount,
    isLoading: isMentorLoading,
    hasLoadedOnce: hasLoadedMentorOnce,
  } = useBorrows(
    mentorPage,
    MENTOR_PAGE_SIZE,
    {
      q: search,
      status,
      requestedBy:
        scope === "my"
          ? String(profile.id ?? "")
          : scope === "all"
            ? requestedBy
            : "",
      reviewerScope: "mentor",
      equipment,
      createdAfter: createdAfter ? toStartOfDay(createdAfter) : "",
      createdBefore: createdBefore ? toEndOfDay(createdBefore) : "",
    },
    reloadKey,
    "all",
    {
      enabled: showMentorApprovalSection,
    },
  );
  const { deleteBorrow, isSubmitting: isDeletingBorrow } = useCreateBorrow();
  const { updateBorrowStatus, pendingAction } = useUpdateBorrowStatus();
  const canReviewBorrows =
    scope === "all" &&
    (normalizedRole === ROLE_VALUES.ADMIN ||
      normalizedRole === ROLE_VALUES.LECTURER);
  const showRequesterColumn = scope === "all";
  const currentProfileId = String(profile?.id ?? "");
  const mentorBorrows = useMemo(
    () =>
      mentorBorrowRows.filter(
        (item) =>
          requiresMentorApproval(item) &&
          item.requesterMentorProfileId === currentProfileId,
      ),
    [currentProfileId, mentorBorrowRows],
  );
  const generalBorrows = useMemo(
    () =>
      filteredBorrows.filter((item) => {
        const isMentor =
          currentProfileId !== "" &&
          item.requesterMentorProfileId === currentProfileId &&
          requiresMentorApproval(item);
        const isPic = item.roomPicIds.includes(currentProfileId);

        if (isMentor && !isPic) {
          return false;
        }

        return true;
      }),
    [currentProfileId, filteredBorrows],
  );
  const totalPages = Math.max(
    1,
    Math.ceil((totalCount || filteredBorrows.length) / PAGE_SIZE),
  );
  const mentorTotalPages = Math.max(
    1,
    Math.ceil((mentorTotalCount || mentorBorrows.length) / MENTOR_PAGE_SIZE),
  );

  const canShowReviewButton = (item: (typeof filteredBorrows)[number]) => {
    if (!canReviewBorrows || !shouldShowReviewAction("borrow", item.status)) {
      return false;
    }

    const isMentor =
      currentProfileId !== "" &&
      item.requesterMentorProfileId === currentProfileId;
    const isPic = item.roomPicIds.includes(currentProfileId);

    // Jika hanya dosen pembimbing (bukan PIC) → sembunyikan, ditangani di seksi mentor.
    // Jika mentor sekaligus PIC → tetap tampilkan tombol.
    if (isMentor && !isPic) {
      return false;
    }

    return true;
  };

  const canManageBorrow = (item: (typeof filteredBorrows)[number]) =>
    scope !== "all" && normalizeStatus(item.status) === "pending";

  const canCancelBorrow = (item: (typeof filteredBorrows)[number]) =>
    scope !== "all" && normalizeStatus(item.status) === "approved";

  const handleDeleteBorrow = async () => {
    if (!deleteTarget) return;

    const result = await deleteBorrow(deleteTarget.id);
    if (!result.ok) return;

    setDeleteTarget(null);
    setReloadKey((prev) => prev + 1);
  };

  const handleCancelBorrow = async () => {
    if (!cancelTarget) return;

    const result = await updateBorrowStatus(cancelTarget.id, "cancel");
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Pengajuan peminjaman alat berhasil dibatalkan.");
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

    router.replace(
      params.toString() ? `${pathname}?${params.toString()}` : pathname,
    );
  };

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <SummaryCard
          label="Total Pengajuan"
          value={aggregates.total}
          icon={<Package className="h-4 w-4" />}
          tone={getStatusSummaryTone("total")}
          isActive={!normalizedStatus}
          onClick={() => handleStatusCardClick("")}
        />
        <SummaryCard
          label="Menunggu"
          value={aggregates.pending}
          icon={<CalendarClock className="h-4 w-4" />}
          tone={getStatusSummaryTone("pending")}
          isActive={normalizedStatus === "pending"}
          onClick={() => handleStatusCardClick("pending")}
        />
        <SummaryCard
          label="Disetujui"
          value={aggregates.approved}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone={getStatusSummaryTone("approved")}
          isActive={normalizedStatus === "approved"}
          onClick={() => handleStatusCardClick("approved")}
        />
        <SummaryCard
          label="Dipinjam"
          value={aggregates.borrowed}
          icon={<Truck className="h-4 w-4" />}
          tone="indigo"
          isActive={normalizedStatus === "borrowed"}
          onClick={() => handleStatusCardClick("borrowed")}
        />
        <SummaryCard
          label="Menunggu Inspeksi"
          value={aggregates.returned_pending_inspection}
          icon={<ShieldCheck className="h-4 w-4" />}
          tone="cyan"
          isActive={normalizedStatus === "returned_pending_inspection"}
          onClick={() => handleStatusCardClick("returned_pending_inspection")}
        />
        <SummaryCard
          label="Dikembalikan"
          value={aggregates.returned}
          icon={<Undo2 className="h-4 w-4" />}
          tone={getStatusSummaryTone("returned")}
          isActive={normalizedStatus === "returned"}
          onClick={() => handleStatusCardClick("returned")}
        />
        <SummaryCard
          label="Ditolak"
          value={aggregates.rejected}
          icon={<RotateCcw className="h-4 w-4" />}
          tone={getStatusSummaryTone("rejected")}
          isActive={normalizedStatus === "rejected"}
          onClick={() => handleStatusCardClick("rejected")}
        />
        <SummaryCard
          label="Kedaluwarsa"
          value={aggregates.expired}
          icon={<Hourglass className="h-4 w-4" />}
          tone={getStatusSummaryTone("expired")}
          isActive={normalizedStatus === "expired"}
          onClick={() => handleStatusCardClick("expired")}
        />
        <SummaryCard
          label="Terlambat"
          value={aggregates.overdue}
          icon={<CalendarClock className="h-4 w-4" />}
          tone="orange"
          isActive={normalizedStatus === "overdue"}
          onClick={() => handleStatusCardClick("overdue")}
        />
        <SummaryCard
          label="Hilang/Rusak"
          value={aggregates.lost_damaged}
          icon={<X className="h-4 w-4" />}
          tone="red"
          isActive={normalizedStatus === "lost_damaged"}
          onClick={() => handleStatusCardClick("lost_damaged")}
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
              Pengajuan Skripsi/TA peminjaman alat yang ditujukan kepada Anda
              sebagai dosen pembimbing.
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
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                    Kode
                  </th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                    Alat
                  </th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                    Pemohon
                  </th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                    Tujuan
                  </th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                    Jumlah
                  </th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                    Waktu Mulai
                  </th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                    Waktu Selesai
                  </th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                    Status
                  </th>
                  <th className="sticky right-0 z-20 bg-slate-900 px-3 py-3 text-center font-medium whitespace-nowrap text-slate-50 shadow-[-1px_0_0_0_rgba(51,65,85,1)]">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {isMentorLoading || !hasLoadedMentorOnce ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-3 py-5 text-center text-slate-500"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat data...
                      </div>
                    </td>
                  </tr>
                ) : mentorBorrows.length ? (
                  mentorBorrows.map((item) => (
                    <tr
                      key={`mentor-${String(item.id)}`}
                      className="border-b last:border-b-0"
                    >
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap text-slate-800">
                        {item.code}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {item.equipmentName}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {item.requesterName}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {item.purpose}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                        {formatDateTimeWib(item.startTime)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                        {formatDateTimeWib(item.endTime)}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            setProgressState({
                              code: item.code,
                              steps: getBorrowProgressFlow(item),
                            })
                          }
                          className={`inline-flex cursor-pointer rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(item.status)}`}
                        >
                          {getBorrowStatusDisplayLabel(item.status)}
                        </button>
                      </td>
                      <td className="sticky right-0 z-10 bg-white px-3 py-2.5 text-center shadow-[-1px_0_0_0_rgba(226,232,240,1)]">
                        <div className="flex items-center justify-center gap-2">
                          {isWaitingForMentorApproval(item) &&
                          canCurrentUserReviewPendingRequest(
                            item,
                            profile?.id,
                            profile?.role,
                          ) ? (
                            <TableActionIconButton
                              type="button"
                              label="Review"
                              icon={<ShieldCheck className="h-3.5 w-3.5" />}
                              className="w-8 rounded-md border border-sky-200 bg-sky-50 p-0 text-sky-700 shadow-none hover:bg-sky-100"
                              onClick={() => setReviewBorrowId(String(item.id))}
                            />
                          ) : null}
                          <TableActionIconButton
                            type="button"
                            label="Lihat detail"
                            icon={<Eye className="h-3.5 w-3.5" />}
                            className="w-8 rounded-md border border-slate-200 bg-slate-50 p-0 text-slate-700 shadow-none hover:bg-slate-100"
                            onClick={() =>
                              router.push(
                                `/borrow-equipment/approval/${item.id}`,
                              )
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-3 py-5 text-center text-slate-500"
                    >
                      Belum ada pengajuan Skripsi/TA pada tabel dosen pembimbing
                      Anda.
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
                totalCount={mentorTotalCount || mentorBorrows.length}
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
          { key: "equipment", label: "Alat" },
          ...(showRequesterColumn
            ? [{ key: "requester", label: "Pemohon" }]
            : []),
          { key: "purpose", label: "Tujuan" },
          { key: "quantity", label: "Jumlah" },
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
        colSpan={showRequesterColumn ? 9 : 8}
        hasRows={generalBorrows.length > 0}
        isLoading={isLoading}
        hasLoadedOnce={hasLoadedOnce}
        emptyMessage={resolvedEmptyMessage}
        tableClassName="min-w-[1120px]"
        colGroup={
          <colgroup>
            {TABLE_COLUMN_WIDTHS.slice(0, showRequesterColumn ? 9 : 8).map(
              (width) => (
                <col key={width} style={{ width }} />
              ),
            )}
          </colgroup>
        }
      >
        {generalBorrows.map((item) => (
          <tr key={String(item.id)} className="border-b last:border-b-0">
            <td className="px-3 py-2.5 font-medium whitespace-nowrap text-slate-800">
              {item.code}
            </td>
            <td className="px-3 py-2.5 whitespace-nowrap">
              {item.equipmentName}
            </td>
            {showRequesterColumn ? (
              <td className="px-3 py-2.5 whitespace-nowrap">
                {item.requesterName}
              </td>
            ) : null}
            <td className="px-3 py-2.5 text-slate-700">{item.purpose}</td>
            <td className="px-3 py-2.5 whitespace-nowrap">{item.quantity}</td>
            <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
              {formatDateTimeWib(item.startTime)}
            </td>
            <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
              {formatDateTimeWib(item.endTime)}
            </td>
            <td className="px-3 py-2.5">
              <button
                type="button"
                onClick={() =>
                  setProgressState({
                    code: item.code,
                    steps: getBorrowProgressFlow(item),
                  })
                }
                className={`inline-flex cursor-pointer rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(item.status)}`}
              >
                {getBorrowStatusDisplayLabel(item.status)}
              </button>
            </td>
            <td className="sticky right-0 z-10 bg-white px-3 py-2.5 text-center shadow-[-1px_0_0_0_rgba(226,232,240,1)]">
              <div className="flex items-center justify-center gap-2">
                {canShowReviewButton(item) ? (
                  <TableActionIconButton
                    type="button"
                    label="Review"
                    icon={<ShieldCheck className="h-3.5 w-3.5" />}
                    className="w-8 rounded-md border border-sky-200 bg-sky-50 p-0 text-sky-700 shadow-none hover:bg-sky-100"
                    onClick={() => setReviewBorrowId(String(item.id))}
                  />
                ) : null}
                {canManageBorrow(item) ? (
                  <>
                    <TableActionIconButton
                      type="button"
                      label="Edit"
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      className="w-8 rounded-md border border-amber-200 bg-amber-50 p-0 text-amber-700 shadow-none hover:bg-amber-100"
                      onClick={() =>
                        router.push(`/borrow-equipment/${item.id}/edit`)
                      }
                    />
                    <TableActionIconButton
                      type="button"
                      label="Hapus"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      className="w-8 rounded-md border border-rose-200 bg-rose-50 p-0 text-rose-700 shadow-none hover:bg-rose-100"
                      onClick={() =>
                        setDeleteTarget({
                          id: String(item.id),
                          code: item.code,
                        })
                      }
                    />
                  </>
                ) : null}
                {canCancelBorrow(item) ? (
                  <TableActionIconButton
                    type="button"
                    label="Batalkan"
                    icon={<X className="h-3.5 w-3.5" />}
                    className="w-8 rounded-md border border-rose-200 bg-rose-50 p-0 text-rose-700 shadow-none hover:bg-rose-100"
                    onClick={() =>
                      setCancelTarget({
                        id: String(item.id),
                        code: item.code,
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
                        ? `/borrow-equipment/approval/${item.id}`
                        : `/borrow-equipment/${item.id}`,
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
        totalCount={totalCount || generalBorrows.length}
        pageSize={PAGE_SIZE}
        itemLabel="peminjaman alat"
        isLoading={isLoading}
        onPageChange={setPage}
      />
      <DashboardDetailReviewDialog
        open={Boolean(reviewBorrowId)}
        onOpenChange={(open) => {
          if (!open) setReviewBorrowId(null);
        }}
        onActionComplete={() => {
          setReloadKey((prev) => prev + 1);
          setReviewBorrowId(null);
        }}
        context={reviewBorrowId ? { kind: "borrow", id: reviewBorrowId } : null}
        borrowActionMode="approval-only"
      />
      <DeleteRequestConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => void handleDeleteBorrow()}
        isSubmitting={isDeletingBorrow}
        title="Hapus Pengajuan Peminjaman Alat"
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
        onConfirm={() => void handleCancelBorrow()}
        isSubmitting={pendingAction.borrowId === cancelTarget?.id}
        title="Batalkan pengajuan peminjaman alat ini?"
        description="Status pengajuan akan diubah menjadi dibatalkan dan proses peminjaman dihentikan."
        confirmLabel="Ya, Batalkan"
      />
      <RequestProgressDialog
        open={Boolean(progressState)}
        onOpenChange={(open) => {
          if (!open) setProgressState(null);
        }}
        title="Progress Peminjaman Alat"
        code={progressState?.code ?? ""}
        steps={progressState?.steps ?? []}
      />
    </section>
  );
}
