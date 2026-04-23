"use client";


import { useState } from "react";

import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  Hourglass,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { useParams, usePathname, useRouter } from "next/navigation";

import { DeleteRequestConfirmDialog } from "@/components/dialogs";
import { Button, Skeleton } from "@/components/ui";

import { DashboardDetailReviewPanel } from "@/components/dashboard/layout";

import { ProgressSteps, RequestInformationCard, RequestProgressDialog } from "@/components/shared";

import { useBorrowDetail, useUpdateBorrowStatus } from "@/hooks/borrow-equipment";

import { formatDateTimeWib } from "@/lib/date";

import { getBorrowProgressFlow } from "@/lib/request";

import {
  getMentorApprovalStageLabel,
  hasMentorApprovalTrace,
} from "@/lib/request";

import {
  getBorrowStatusDisplayLabel,
  getStatusBadgeClass,
  normalizeStatus as normalizeRequestStatus,
} from "@/lib/request";

function hasDisplayValue(value?: string | null) {
  if (!value) return false;
  const normalized = value.trim();
  return normalized !== "" && normalized !== "-";
}

function normalizeStatus(value: string) {
  return value.toLowerCase();
}

function BorrowFlow({ steps }: { steps: ReturnType<typeof getBorrowProgressFlow> }) {
  return (
    <ProgressSteps steps={steps} minWidthClassName="min-w-[760px]" />
  );
}

function DetailCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {subtitle}
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2">{children}</div>
    </section>
  );
}

function DetailMetaItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  if (!hasDisplayValue(value)) return null;

  return (
    <div className="grid gap-1 rounded-md border border-slate-200 bg-slate-50/80 px-4 py-3 md:grid-cols-[150px_minmax(0,1fr)] md:items-start md:gap-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xs leading-5 text-slate-800 break-words">{value}</p>
    </div>
  );
}

function BorrowDetailSkeleton() {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-44 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
        <Skeleton className="h-5 w-32" />
        <div className="mt-4">
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.85fr)]">
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-md" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-md" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-md" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function BorrowEquipmentDetailPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { id } = useParams();
  const borrowId = Array.isArray(id) ? id[0] : id;
  const [reloadKey, setReloadKey] = useState(0);
  const [progressOpen, setProgressOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const { updateBorrowStatus, pendingAction } = useUpdateBorrowStatus();
  const { borrow: item, isLoading, error } = useBorrowDetail(borrowId, reloadKey);

  const isAllPage = pathname.startsWith("/borrow-equipment/approval/");
  const backHref = isAllPage ? "/borrow-equipment/approval" : "/borrow-equipment";
  const backLabel = isAllPage
    ? "Kembali ke Daftar Pengajuan"
    : "Kembali ke Pengajuan Saya";

  if (isLoading) {
    return <BorrowDetailSkeleton />;
  }

  if (error) {
    return (
      <section className="space-y-3">
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
        <Button type="button" variant="outline" onClick={() => router.push(backHref)}>
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Button>
      </section>
    );
  }

  if (!item) {
    return (
      <section className="space-y-3">
        <p className="text-sm text-slate-600">Data pengajuan peminjaman alat tidak ditemukan.</p>
        <Button type="button" variant="outline" onClick={() => router.push(backHref)}>
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Button>
      </section>
    );
  }

  const flowSteps = getBorrowProgressFlow(item);
  const canCancelBorrow =
    !isAllPage && normalizeRequestStatus(item.status) === "approved";

  const handleCancelBorrow = async () => {
    const result = await updateBorrowStatus(item.id, "cancel");
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Pengajuan peminjaman alat berhasil dibatalkan.");
    setCancelOpen(false);
    setReloadKey((prev) => prev + 1);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div>
          <p className="text-xs text-slate-300">Detail Pengajuan</p>
          <h2 className="mt-1 text-xl font-bold text-slate-50">{item.code}</h2>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setProgressOpen(true)}
              className={`inline-flex cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(item.status)}`}
            >
              {getBorrowStatusDisplayLabel(item.status)}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => router.push(backHref)}>
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-1 flex items-center gap-2">
          {normalizeStatus(item.status) === "expired" ? (
            <Hourglass className="h-4 w-4 text-slate-600" />
          ) : (
            <ClipboardList className="h-4 w-4 text-slate-600" />
          )}
          <h3 className="text-sm font-semibold text-slate-900">Progress Pengajuan</h3>
        </div>
        <BorrowFlow steps={flowSteps} />
      </div>

      <div
        className={
          isAllPage
            ? "grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.85fr)]"
            : "space-y-4"
        }
      >
        {isAllPage ? (
          <>
            <div className="space-y-4">
              <DetailCard
                title="Detail Peminjaman Alat"
                subtitle="Ringkasan data peminjaman alat yang diajukan oleh pemohon."
                icon={<Wrench className="h-4 w-4" />}
              >
                <DetailMetaItem label="Alat" value={item.equipmentName} />
                <DetailMetaItem label="Jumlah" value={item.quantity} />
                <DetailMetaItem
                  label="Waktu Mulai"
                  value={formatDateTimeWib(item.startTime)}
                />
                <DetailMetaItem
                  label="Waktu Selesai"
                  value={formatDateTimeWib(item.endTime)}
                />
                <DetailMetaItem label="Tujuan" value={item.purpose} />
                <DetailMetaItem
                  label="Nomor Telepon Pemohon"
                  value={item.requesterPhone}
                />
                <DetailMetaItem
                  label="Dosen Pembimbing"
                  value={item.requesterMentor}
                />
                <DetailMetaItem label="Institusi" value={item.institution} />
                <DetailMetaItem
                  label="Alamat Institusi"
                  value={item.institutionAddress}
                />
                <DetailMetaItem label="Catatan Pemohon" value={item.note || "-"} />
              </DetailCard>

              <RequestInformationCard
                icon={<CalendarClock className="h-4 w-4" />}
                requesterName={item.requesterName}
                requesterDepartment={item.requesterDepartment}
                status={item.status}
                onStatusClick={() => setProgressOpen(true)}
                approvedByName={item.approvedByName}
                rejectionNote={item.rejectionNote}
                itemGridClassName="md:grid-cols-[150px_minmax(0,1fr)]"
              >
                {hasMentorApprovalTrace(item) ? (
                  <>
                    <DetailMetaItem
                      label="Tahap Dosen Pembimbing"
                      value={getMentorApprovalStageLabel(item)}
                    />
                    <DetailMetaItem
                      label="Waktu Persetujuan Dosen Pembimbing"
                      value={formatDateTimeWib(item.mentorApprovedAt)}
                    />
                  </>
                ) : null}
                <DetailMetaItem
                  label="Pengembalian Aktual"
                  value={formatDateTimeWib(item.endTimeActual)}
                />
              </RequestInformationCard>
            </div>

            <div className="space-y-4">
              {borrowId ? (
                <DashboardDetailReviewPanel
                  context={{ kind: "borrow", id: borrowId }}
                  initialBorrow={item}
                  onActionComplete={() => setReloadKey((prev) => prev + 1)}
                />
              ) : null}

              {hasDisplayValue(item.inspectionNote) ||
              item.status === "Lost/Damaged" ? (
                <section className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <TriangleAlert className="h-4 w-4 text-slate-600" />
                    <h3 className="text-sm font-semibold text-slate-900">Hasil Inspeksi</h3>
                  </div>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-xs font-medium text-slate-500">Status Akhir</dt>
                      <dd className="mt-1 text-sm text-slate-800">
                        {item.status === "Lost/Damaged"
                          ? "Hilang/Rusak"
                          : getBorrowStatusDisplayLabel(item.status)}
                      </dd>
                    </div>
                    {hasDisplayValue(item.inspectionNote) ? (
                      <div>
                        <dt className="text-xs font-medium text-slate-500">Catatan Inspeksi</dt>
                        <dd className="mt-1 text-sm text-slate-800">
                          {item.inspectionNote}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </section>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.22fr)_minmax(340px,0.92fr)]">
              <div className="space-y-4">
                <DetailCard
                  title="Detail Peminjaman Alat"
                  subtitle="Ringkasan data peminjaman alat yang diajukan oleh pemohon."
                  icon={<Wrench className="h-4 w-4" />}
                >
                  <DetailMetaItem label="Alat" value={item.equipmentName} />
                  <DetailMetaItem label="Jumlah" value={item.quantity} />
                  <DetailMetaItem
                    label="Waktu Mulai"
                    value={formatDateTimeWib(item.startTime)}
                  />
                  <DetailMetaItem
                    label="Waktu Selesai"
                    value={formatDateTimeWib(item.endTime)}
                  />
                  <DetailMetaItem label="Tujuan" value={item.purpose} />
                  <DetailMetaItem
                    label="Nomor Telepon Pemohon"
                    value={item.requesterPhone}
                  />
                  <DetailMetaItem
                    label="Dosen Pembimbing"
                    value={item.requesterMentor}
                  />
                  <DetailMetaItem label="Institusi" value={item.institution} />
                  <DetailMetaItem
                    label="Alamat Institusi"
                    value={item.institutionAddress}
                  />
                  <DetailMetaItem label="Catatan Pemohon" value={item.note || "-"} />
                </DetailCard>
              </div>

              <div className="space-y-4">
                <RequestInformationCard
                  icon={<CalendarClock className="h-4 w-4" />}
                  requesterName={item.requesterName}
                  requesterDepartment={item.requesterDepartment}
                  status={item.status}
                  onStatusClick={() => setProgressOpen(true)}
                  approvedByName={item.approvedByName}
                  rejectionNote={item.rejectionNote}
                  itemGridClassName="md:grid-cols-[150px_minmax(0,1fr)]"
                >
                  {hasMentorApprovalTrace(item) ? (
                    <>
                      <DetailMetaItem
                        label="Tahap Dosen Pembimbing"
                        value={getMentorApprovalStageLabel(item)}
                      />
                      <DetailMetaItem
                        label="Waktu Persetujuan Dosen Pembimbing"
                        value={formatDateTimeWib(item.mentorApprovedAt)}
                      />
                    </>
                  ) : null}
                  <DetailMetaItem
                    label="Pengembalian Aktual"
                    value={formatDateTimeWib(item.endTimeActual)}
                  />
                </RequestInformationCard>

                {hasDisplayValue(item.inspectionNote) ||
                item.status === "Lost/Damaged" ? (
                  <section className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <TriangleAlert className="h-4 w-4 text-slate-600" />
                      <h3 className="text-sm font-semibold text-slate-900">Hasil Inspeksi</h3>
                    </div>
                    <dl className="space-y-4">
                      <div>
                        <dt className="text-xs font-medium text-slate-500">Status Akhir</dt>
                        <dd className="mt-1 text-sm text-slate-800">
                          {item.status === "Lost/Damaged"
                            ? "Hilang/Rusak"
                            : getBorrowStatusDisplayLabel(item.status)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-slate-500">Catatan Inspeksi</dt>
                        <dd className="mt-1 text-sm text-slate-800">
                          {item.inspectionNote || "-"}
                        </dd>
                      </div>
                    </dl>
                  </section>
                ) : null}

                {canCancelBorrow ? (
                  <section className="rounded-xl border border-rose-200 bg-rose-50/70 p-5">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Batalkan Pengajuan
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Pengajuan yang sudah disetujui masih dapat dibatalkan selama alat belum diserahterimakan.
                    </p>
                    <Button
                      type="button"
                      variant="destructive"
                      className="mt-4"
                      onClick={() => setCancelOpen(true)}
                      disabled={pendingAction.borrowId === item.id}
                    >
                      Batalkan Pengajuan
                    </Button>
                  </section>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
      <DeleteRequestConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onConfirm={() => void handleCancelBorrow()}
        isSubmitting={pendingAction.borrowId === item.id}
        title="Batalkan pengajuan peminjaman alat ini?"
        description="Status pengajuan akan diubah menjadi dibatalkan dan proses peminjaman dihentikan."
        confirmLabel="Ya, Batalkan"
      />
      <RequestProgressDialog
        open={progressOpen}
        onOpenChange={setProgressOpen}
        title="Progress Peminjaman Alat"
        code={item.code}
        steps={getBorrowProgressFlow(item)}
      />
    </section>
  );
}
