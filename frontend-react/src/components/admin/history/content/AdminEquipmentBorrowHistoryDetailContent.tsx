"use client";

import {
  CalendarClock,
  ClipboardList,
  NotebookPen,
  Wrench,
} from "lucide-react";

import {
  AdminRecordDetailGrid,
  AdminRecordDetailItem,
  AdminRecordDetailSection,
  AdminRecordDetailShell,
} from "@/components/admin/history";
import { Skeleton } from "@/components/ui";
import type { BorrowRow } from "@/hooks/borrow-equipment";
import { formatDateTimeWib } from "@/lib/date";
import {
  getMentorApprovalStageLabel,
  hasMentorApprovalTrace,
} from "@/lib/request";

type AdminEquipmentBorrowRecordDetailContentProps = {
  item: BorrowRow | null;
  isLoading: boolean;
  error: string;
  onBack: () => void;
  backLabel?: string;
  onOpenEquipmentDetail?: (equipmentId: string | number) => void;
  onOpenUserDetail?: (userId: string | number) => void;
};

function hasValue(value?: string | null) {
  return Boolean(value && value.trim() && value !== "-");
}

export default function AdminEquipmentBorrowRecordDetailContent({
  item,
  isLoading,
  error,
  onBack,
  backLabel = "Kembali",
  onOpenEquipmentDetail,
  onOpenUserDetail,
}: AdminEquipmentBorrowRecordDetailContentProps) {
  const isGuestRequester = item ? !hasValue(item.requesterDepartment) : false;

  return (
    <>
      {error ? (
        <div className="w-full rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="w-full space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-9 w-20" />
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="mb-3 flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-4 w-36" />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`main-${index}`} className="space-y-1 px-0 py-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-full max-w-44" />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="mb-3 flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`time-${index}`} className="space-y-1 px-0 py-1.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-4 w-full max-w-52" />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="mb-3 flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="space-y-2.5">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`note-${index}`} className="space-y-1 px-0 py-1.5">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : !item ? (
        <div className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-8 text-sm text-muted-foreground">
          Data record peminjaman alat tidak ditemukan.
        </div>
      ) : (
        <AdminRecordDetailShell
          title="Detail Peminjaman Alat"
          code={item.code}
          icon={<ClipboardList className="h-5 w-5" />}
          status={item.status}
          compact
          backLabel={backLabel}
          onBack={onBack}
        >
          <AdminRecordDetailSection
            title="Informasi Utama"
            icon={<Wrench className="h-5 w-5" />}
            compact
          >
            <AdminRecordDetailGrid compact>
              <AdminRecordDetailItem
                label="Alat"
                value={item.equipmentName}
                compact
                borderless
                hrefIcon={Boolean(item.equipmentId)}
                onClick={
                  item.equipmentId && onOpenEquipmentDetail
                    ? () => onOpenEquipmentDetail(item.equipmentId)
                    : undefined
                }
              />
              <AdminRecordDetailItem label="Ruangan" value={item.roomName} compact borderless />
              <AdminRecordDetailItem label="Jumlah" value={item.quantity} compact borderless />
              <AdminRecordDetailItem
                label="Peminjam"
                value={item.requesterName}
                compact
                borderless
                hrefIcon={Boolean(item.requesterId)}
                onClick={
                  item.requesterId && onOpenUserDetail
                    ? () => onOpenUserDetail(item.requesterId)
                    : undefined
                }
              />
              <AdminRecordDetailItem
                label="Status"
                value={item.status}
                status
                compact
                borderless
              />
              <AdminRecordDetailItem
                label="PIC Lab"
                value={item.roomPicName}
                compact
                borderless
              />
            </AdminRecordDetailGrid>
          </AdminRecordDetailSection>

          <AdminRecordDetailSection
            title="Informasi Pemohon"
            icon={<ClipboardList className="h-5 w-5" />}
            compact
          >
            <AdminRecordDetailGrid compact>
              {!isGuestRequester ? (
                <AdminRecordDetailItem
                  label="Prodi Pemohon"
                  value={item.requesterDepartment}
                  compact
                  borderless
                />
              ) : null}
              <AdminRecordDetailItem
                label="No. Telepon"
                value={item.requesterPhone}
                compact
                borderless
              />
              {!isGuestRequester ? (
                <AdminRecordDetailItem
                  label="Dosen/Pembimbing"
                  value={item.requesterMentor}
                  compact
                  borderless
                />
              ) : null}
              {isGuestRequester ? (
                <>
                  <AdminRecordDetailItem
                    label="Institusi"
                    value={item.institution}
                    compact
                    borderless
                  />
                  <AdminRecordDetailItem
                    label="Alamat Institusi"
                    value={item.institutionAddress}
                    compact
                    borderless
                  />
                </>
              ) : null}
            </AdminRecordDetailGrid>
          </AdminRecordDetailSection>

          <AdminRecordDetailSection
            title="Waktu Peminjaman"
            icon={<CalendarClock className="h-5 w-5" />}
            compact
          >
            <AdminRecordDetailGrid compact>
              {hasMentorApprovalTrace(item) ? (
                <>
                  <AdminRecordDetailItem
                    label="Tahap Dosen Pembimbing"
                    value={getMentorApprovalStageLabel(item)}
                    compact
                    borderless
                  />
                  <AdminRecordDetailItem
                    label="Waktu Persetujuan Dosen Pembimbing"
                    value={formatDateTimeWib(item.mentorApprovedAt)}
                    compact
                    borderless
                  />
                </>
              ) : null}
              <AdminRecordDetailItem
                label="Waktu Mulai"
                value={formatDateTimeWib(item.startTime)}
                compact
                borderless
              />
              <AdminRecordDetailItem
                label="Waktu Selesai"
                value={formatDateTimeWib(item.endTime)}
                compact
                borderless
              />
              <AdminRecordDetailItem
                label="Pengembalian Aktual"
                value={formatDateTimeWib(item.endTimeActual)}
                compact
                borderless
              />
              <AdminRecordDetailItem
                label="Disetujui Oleh"
                value={item.approvedByName}
                compact
                borderless
                hrefIcon={Boolean(item.approvedById)}
                onClick={
                  item.approvedById && onOpenUserDetail
                    ? () => onOpenUserDetail(item.approvedById)
                    : undefined
                }
              />
              <AdminRecordDetailItem
                label="Waktu Disetujui"
                value={formatDateTimeWib(item.approvedAt)}
                compact
                borderless
              />
              {item.status === "Rejected" ? (
                <AdminRecordDetailItem
                  label="Waktu Ditolak"
                  value={formatDateTimeWib(item.rejectedAt)}
                  compact
                  borderless
                />
              ) : null}
              {item.status === "Expired" ? (
                <AdminRecordDetailItem
                  label="Waktu Kedaluwarsa"
                  value={formatDateTimeWib(item.expiredAt)}
                  compact
                  borderless
                />
              ) : null}
              <AdminRecordDetailItem
                label="Waktu Serah Terima"
                value={formatDateTimeWib(item.borrowedAt)}
                compact
                borderless
              />
              <AdminRecordDetailItem
                label="Waktu Menunggu Inspeksi"
                value={formatDateTimeWib(item.returnedPendingInspectionAt)}
                compact
                borderless
              />
              <AdminRecordDetailItem
                label="Waktu Inspeksi"
                value={formatDateTimeWib(item.inspectedAt)}
                compact
                borderless
              />
              <AdminRecordDetailItem
                label="Waktu Return"
                value={formatDateTimeWib(item.returnedAt)}
                compact
                borderless
              />
              <AdminRecordDetailItem
                label="Waktu Overdue"
                value={formatDateTimeWib(item.overdueAt)}
                compact
                borderless
              />
              <AdminRecordDetailItem
                label="Waktu Hilang/Rusak"
                value={formatDateTimeWib(item.lostDamagedAt)}
                compact
                borderless
              />
              <AdminRecordDetailItem
                label="Waktu Stok Dipulihkan"
                value={formatDateTimeWib(item.repairedAt)}
                compact
                borderless
              />
            </AdminRecordDetailGrid>
          </AdminRecordDetailSection>

          <AdminRecordDetailSection
            title="Keterangan"
            icon={<NotebookPen className="h-5 w-5" />}
            compact
          >
            <div className="space-y-2.5">
              <AdminRecordDetailItem label="Tujuan" value={item.purpose} compact borderless />
              <AdminRecordDetailItem
                label="Catatan Pemohon"
                value={item.note || "-"}
                compact
                borderless
              />
              <AdminRecordDetailItem
                label="Catatan Inspeksi"
                value={item.inspectionNote || "-"}
                compact
                borderless
              />
              {item.status === "Rejected" ? (
                <AdminRecordDetailItem
                  label="Alasan Penolakan"
                  value={item.rejectionNote || "-"}
                  compact
                  borderless
                />
              ) : null}
            </div>
          </AdminRecordDetailSection>
        </AdminRecordDetailShell>
      )}
    </>
  );
}
