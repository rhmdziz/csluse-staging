"use client";


import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  CalendarClock,
  CheckCircle2,
  Eye,
  Loader2,
  Package,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import { useRouter, useSearchParams } from "next/navigation";

import { DashboardDetailReviewDialog } from "@/components/dashboard/layout";
import { DeleteRequestConfirmDialog } from "@/components/dialogs";

import {
  DataPagination,
  RequestProgressDialog,
  type ProgressStepItem,
  TableActionIconButton,
} from "@/components/shared";

import { ROLE_VALUES, normalizeRoleValue } from "@/constants/roles";

import { useLoadProfile } from "@/hooks/shared/profile";

import { useCreateUse, useUses } from "@/hooks/use-equipment";

import { formatDateTimeWib } from "@/lib/date";

import {
  canCurrentUserReviewPendingRequest,
  isWaitingForMentorApproval,
} from "@/lib/request";

import { getUseProgressFlow } from "@/lib/request";

import {
  getRequestStatusDisplayLabel,
  getStatusBadgeClass,
  getStatusSummaryTone,
  normalizeStatus,
  shouldShowReviewAction,
} from "@/lib/request";

import {
  toEndOfDay,
  toStartOfDay,
} from "@/lib/date";

const PAGE_SIZE = 10;
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
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: "slate" | "blue" | "amber" | "emerald" | "sky" | "rose";
}) {
  const toneClass =
    tone === "blue"
      ? {
          card: "border-blue-300 bg-blue-100/90",
          icon: "bg-white/80 text-blue-800",
          value: "text-blue-900",
        }
      : tone === "amber"
        ? {
            card: "border-amber-300 bg-amber-100/90",
            icon: "bg-white/80 text-amber-800",
            value: "text-amber-900",
          }
        : tone === "emerald"
          ? {
            card: "border-emerald-300 bg-emerald-100/90",
            icon: "bg-white/80 text-emerald-800",
            value: "text-emerald-900",
          }
          : tone === "sky"
            ? {
                card: "border-sky-300 bg-sky-100/90",
                icon: "bg-white/80 text-sky-800",
                value: "text-sky-900",
              }
            : tone === "rose"
              ? {
                  card: "border-rose-300 bg-rose-100/90",
                  icon: "bg-white/80 text-rose-800",
                  value: "text-rose-900",
                }
              : {
                  card: "border-slate-300 bg-slate-100/90",
                  icon: "bg-white/80 text-slate-800",
                  value: "text-slate-900",
                };

  return (
    <div
      className={`rounded-xl border p-3 shadow-[0_4px_14px_rgba(15,23,42,0.08)] ${toneClass.card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-h-14 flex-col justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className={`text-2xl font-semibold leading-none ${toneClass.value}`}>
            {value}
          </p>
        </div>
        <div className={`rounded-lg p-2 ${toneClass.icon}`}>{icon}</div>
      </div>
    </div>
  );
}

export default function UseEquipmentListContent({
  scope,
  emptyMessage,
}: {
  scope: "my" | "all";
  emptyMessage: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useLoadProfile();
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [reviewUseId, setReviewUseId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
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
  const room = searchParams.get("room") ?? "";
  const requestedBy = searchParams.get("requested_by") ?? "";
  const createdAfter = searchParams.get("created_after") ?? "";
  const createdBefore = searchParams.get("created_before") ?? "";
  const isActiveFilter = scope === "all" && status === "active";
  const resolvedEmptyMessage = isActiveFilter
    ? "Tidak ada pengajuan aktif penggunaan alat yang menjadi tanggung jawab Anda."
    : scope === "all"
      ? "Belum ada pengajuan penggunaan alat yang perlu Anda proses."
      : emptyMessage;

  useEffect(() => {
    setPage(1);
  }, [status, search, equipment, room, requestedBy, createdAfter, createdBefore]);

  const { uses, totalCount, aggregates, isLoading, hasLoadedOnce, error } = useUses(
    page,
    PAGE_SIZE,
    {
      q: search,
      status,
      requestedBy:
        scope === "my"
          ? String(profile?.id ?? "")
          : scope === "all"
            ? requestedBy
            : "",
      equipment,
      room,
      createdAfter: createdAfter ? toStartOfDay(createdAfter) : "",
      createdBefore: createdBefore ? toEndOfDay(createdBefore) : "",
    },
    reloadKey,
    scope,
  );

  const filteredUses = useMemo(
    () =>
      uses.filter(
        (item) => item.equipmentName && item.equipmentName !== "-",
      ),
    [uses],
  );

  const normalizedRole = normalizeRoleValue(profile?.role);
  const { deleteUse, isSubmitting: isDeletingUse } = useCreateUse();
  const canReviewUses =
    scope === "all" &&
    (normalizedRole === ROLE_VALUES.ADMIN ||
      normalizedRole === ROLE_VALUES.LECTURER);
  const showRequesterColumn = scope === "all";
  const currentProfileId = String(profile?.id ?? "");
  const mentorUses = useMemo(
    () =>
      filteredUses.filter(
        (item) =>
          isWaitingForMentorApproval(item) &&
          item.requesterMentorProfileId === currentProfileId,
      ),
    [currentProfileId, filteredUses],
  );
  const showMentorApprovalSection =
    scope === "all" && normalizedRole === ROLE_VALUES.LECTURER;

  const totalPages = Math.max(
    1,
    Math.ceil((totalCount || filteredUses.length) / PAGE_SIZE),
  );
  const pendingCount = aggregates.pending;
  const approvedCount = aggregates.approved;
  const completedCount = aggregates.completed;
  const rejectedCount = aggregates.rejected;
  const expiredCount = aggregates.expired;

  const canShowReviewButton = (item: (typeof filteredUses)[number]) => {
    if (!canReviewUses || !shouldShowReviewAction("use", item.status)) {
      return false;
    }

    const isMentor = currentProfileId !== "" && item.requesterMentorProfileId === currentProfileId;
    const isPic = item.roomPicIds.includes(currentProfileId);

    // Jika hanya dosen pembimbing (bukan PIC) → sembunyikan, ditangani di seksi mentor.
    // Jika mentor sekaligus PIC → tetap tampilkan tombol.
    if (isMentor && !isPic) {
      return false;
    }

    return true;
  };

  const canManageUse = (item: (typeof filteredUses)[number]) =>
    scope !== "all" && normalizeStatus(item.status) === "pending";

  const handleDeleteUse = async () => {
    if (!deleteTarget) return;

    const result = await deleteUse(deleteTarget.id);
    if (!result.ok) return;

    setDeleteTarget(null);
    setReloadKey((prev) => prev + 1);
  };

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <SummaryCard
          label="Total Pengajuan"
          value={aggregates.total}
          icon={<Package className="h-4 w-4" />}
          tone={getStatusSummaryTone("total")}
        />
        <SummaryCard
          label="Menunggu"
          value={pendingCount}
          icon={<CalendarClock className="h-4 w-4" />}
          tone={getStatusSummaryTone("pending")}
        />
        <SummaryCard
          label="Disetujui"
          value={approvedCount}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone={getStatusSummaryTone("approved")}
        />
        <SummaryCard
          label="Selesai"
          value={completedCount}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone={getStatusSummaryTone("completed")}
        />
        <SummaryCard
          label="Ditolak"
          value={rejectedCount}
          icon={<RotateCcw className="h-4 w-4" />}
          tone={getStatusSummaryTone("rejected")}
        />
        <SummaryCard
          label="Kedaluwarsa"
          value={expiredCount}
          icon={<X className="h-4 w-4" />}
          tone={getStatusSummaryTone("expired")}
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
              Pengajuan Skripsi/TA penggunaan alat yang menunggu persetujuan Anda.
            </p>
          </div>
          <div className="w-full max-w-full overflow-x-auto rounded-xl border border-amber-200 bg-white">
            <table className="w-full min-w-[1120px]">
              <colgroup>
                {TABLE_COLUMN_WIDTHS.map((width) => (
                  <col key={width} style={{ width }} />
                ))}
              </colgroup>
              <thead className="border-b border-amber-300 bg-amber-100">
                <tr className="text-left text-sm">
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-900">Kode</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-900">Alat</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-900">Pemohon</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-900">Waktu Mulai</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-900">Waktu Selesai</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-900">Tujuan</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-900">Status</th>
                  <th className="sticky right-0 z-20 bg-amber-100 px-3 py-3 text-center font-medium whitespace-nowrap text-slate-900 shadow-[-1px_0_0_0_rgba(251,191,36,0.5)]">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {isLoading || !hasLoadedOnce ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-5 text-center text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat data...
                      </div>
                    </td>
                  </tr>
                ) : mentorUses.length ? (
                  mentorUses.map((item) => (
                    <tr key={`mentor-${String(item.id)}`} className="border-b last:border-b-0">
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap text-slate-800">
                        {item.code}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{item.equipmentName}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{item.requesterName}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                        {formatDateTimeWib(item.startTime)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                        {formatDateTimeWib(item.endTime)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{item.purpose}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(item.status)}`}
                        >
                          {getRequestStatusDisplayLabel(item.status)}
                        </span>
                      </td>
                      <td className="sticky right-0 z-10 bg-white px-3 py-2.5 text-center shadow-[-1px_0_0_0_rgba(254,243,199,1)]">
                        <div className="flex items-center justify-center gap-2">
                          {canCurrentUserReviewPendingRequest(
                            item,
                            profile?.id,
                            profile?.role,
                          ) ? (
                            <TableActionIconButton
                              type="button"
                              label="Review"
                              icon={<ShieldCheck className="h-3.5 w-3.5" />}
                              className="w-8 rounded-md border border-sky-200 bg-sky-50 p-0 text-sky-700 shadow-none hover:bg-sky-100"
                              onClick={() => setReviewUseId(String(item.id))}
                            />
                          ) : null}
                          <TableActionIconButton
                            type="button"
                            label="Lihat detail"
                            icon={<Eye className="h-3.5 w-3.5" />}
                            className="w-8 rounded-md border border-slate-200 bg-slate-50 p-0 text-slate-700 shadow-none hover:bg-slate-100"
                            onClick={() => router.push(`/use-equipment/approval/${item.id}`)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-3 py-5 text-center text-slate-500">
                      Belum ada pengajuan yang menunggu persetujuan dosen pembimbing Anda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="w-full max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1120px]">
          <colgroup>
            {TABLE_COLUMN_WIDTHS.slice(0, showRequesterColumn ? 8 : 7).map((width) => (
              <col key={width} style={{ width }} />
            ))}
          </colgroup>
          <thead className="border-b border-slate-800 bg-slate-900">
            <tr className="text-left text-sm">
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">Kode</th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">Alat</th>
              {showRequesterColumn ? (
                <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">Pemohon</th>
              ) : null}
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">Waktu Mulai</th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">Waktu Selesai</th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">Tujuan</th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">Status</th>
              <th className="sticky right-0 z-20 bg-slate-900 px-3 py-3 text-center font-medium whitespace-nowrap text-slate-50 shadow-[-1px_0_0_0_rgba(51,65,85,1)]">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {isLoading || !hasLoadedOnce ? (
              <tr>
                <td colSpan={showRequesterColumn ? 8 : 7} className="px-3 py-5 text-center text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat data...
                  </div>
                </td>
              </tr>
            ) : filteredUses.length ? (
              filteredUses.map((item) => (
                <tr key={String(item.id)} className="border-b last:border-b-0">
                  <td className="px-3 py-2.5 font-medium whitespace-nowrap text-slate-800">
                    {item.code}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{item.equipmentName}</td>
                  {showRequesterColumn ? (
                    <td className="px-3 py-2.5 whitespace-nowrap">{item.requesterName}</td>
                  ) : null}
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                    {formatDateTimeWib(item.startTime)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                    {formatDateTimeWib(item.endTime)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">{item.purpose}</td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setProgressState({
                          code: item.code,
                          steps: getUseProgressFlow(item),
                        })
                      }
                      className={`inline-flex cursor-pointer rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(item.status)}`}
                    >
                      {getRequestStatusDisplayLabel(item.status)}
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
                          onClick={() => setReviewUseId(String(item.id))}
                        />
                      ) : null}
                      {canManageUse(item) ? (
                        <>
                          <TableActionIconButton
                            type="button"
                            label="Edit"
                            icon={<Pencil className="h-3.5 w-3.5" />}
                            className="w-8 rounded-md border border-amber-200 bg-amber-50 p-0 text-amber-700 shadow-none hover:bg-amber-100"
                            onClick={() => router.push(`/use-equipment/${item.id}/edit`)}
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
                      <TableActionIconButton
                        type="button"
                        label="Lihat detail"
                        icon={<Eye className="h-3.5 w-3.5" />}
                        className="w-8 rounded-md border border-slate-200 bg-slate-50 p-0 text-slate-700 shadow-none hover:bg-slate-100"
                        onClick={() =>
                          router.push(
                            scope === "all"
                              ? `/use-equipment/approval/${item.id}`
                              : `/use-equipment/${item.id}`,
                          )
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={showRequesterColumn ? 8 : 7} className="px-3 py-5 text-center text-slate-500">
                  {resolvedEmptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <DataPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount || filteredUses.length}
        pageSize={PAGE_SIZE}
        itemLabel="penggunaan alat"
        isLoading={isLoading}
        onPageChange={setPage}
      />
      <DashboardDetailReviewDialog
        open={Boolean(reviewUseId)}
        onOpenChange={(open) => {
          if (!open) setReviewUseId(null);
        }}
        onActionComplete={() => {
          setReloadKey((prev) => prev + 1);
          setReviewUseId(null);
        }}
        context={
          reviewUseId
            ? { kind: "use", id: reviewUseId }
            : null
        }
      />
      <DeleteRequestConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => void handleDeleteUse()}
        isSubmitting={isDeletingUse}
        title="Hapus Pengajuan Penggunaan Alat"
        description={
          deleteTarget
            ? `Pengajuan ${deleteTarget.code} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`
            : "Pengajuan ini akan dihapus permanen."
        }
      />
      <RequestProgressDialog
        open={Boolean(progressState)}
        onOpenChange={(open) => {
          if (!open) setProgressState(null);
        }}
        title="Progress Penggunaan Alat"
        code={progressState?.code ?? ""}
        steps={progressState?.steps ?? []}
      />
    </section>
  );
}
