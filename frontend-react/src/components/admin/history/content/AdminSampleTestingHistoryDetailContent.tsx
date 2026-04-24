"use client";

import {
  ClipboardList,
  FlaskConical,
  Microscope,
  UserRound,
} from "lucide-react";

import { SampleTestingDocumentsSection } from "@/components/dashboard/sample-testing";
import {
  AdminRecordAsideCard,
  AdminRecordAsideItem,
  AdminRecordDetailGrid,
  AdminRecordDetailItem,
  AdminRecordDetailSection,
  AdminRecordDetailShell,
} from "@/components/admin/history";
import type { SampleTestingRow } from "@/hooks/sample-testing";
import { formatDateTimeWib } from "@/lib/date";

type Props = {
  item: SampleTestingRow | null;
  isLoading: boolean;
  error: string;
  onBack: () => void;
  backLabel?: string;
  showAside?: boolean;
  onOpenUserDetail?: (userId: string | number) => void;
};

function hasValue(value?: string | null) {
  return Boolean(value && value.trim() && value !== "-");
}

export default function AdminSampleTestingRecordDetailContent({
  item,
  isLoading,
  error,
  onBack,
  backLabel = "Kembali",
  showAside = true,
  onOpenUserDetail,
}: Props) {
  const isGuestRequester = item ? !hasValue(item.requesterDepartment) : false;

  return (
    <>
      {error ? (
        <div className="w-full rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-8 text-sm text-muted-foreground">
          Memuat detail record...
        </div>
      ) : !item ? (
        <div className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-8 text-sm text-muted-foreground">
          Data record pengujian sampel tidak ditemukan.
        </div>
      ) : (
        <AdminRecordDetailShell
          title="Detail Pengujian Sampel"
          code={item.code}
          icon={<ClipboardList className="h-5 w-5" />}
          status={item.status}
          onBack={onBack}
          backLabel={backLabel}
          aside={
            showAside
              ? (
            <>
              <AdminRecordAsideCard title="Ringkasan Status">
                <AdminRecordAsideItem label="Status" value={item.status} />
                <AdminRecordAsideItem
                  label="Diajukan"
                  value={formatDateTimeWib(item.createdAt)}
                />
                <AdminRecordAsideItem
                  label="Diupdate"
                  value={formatDateTimeWib(item.updatedAt)}
                />
                <AdminRecordAsideItem
                  label="Disetujui Oleh"
                  value={item.approvedByName || "-"}
                />
              </AdminRecordAsideCard>
              <AdminRecordAsideCard title="Audit Singkat">
                <AdminRecordAsideItem label="Kode" value={item.code} />
                <AdminRecordAsideItem label="Pemohon" value={item.name} />
                <AdminRecordAsideItem label="Institusi" value={item.institution} />
              </AdminRecordAsideCard>
            </>
                )
              : undefined
          }
        >
          <AdminRecordDetailSection
            title="Informasi Pemohon"
            icon={<UserRound className="h-5 w-5" />}
          >
            <AdminRecordDetailGrid>
              <AdminRecordDetailItem label="Nama Pemohon" value={item.name} />
              {isGuestRequester ? (
                <>
                  <AdminRecordDetailItem label="Institusi" value={item.institution} />
                  <AdminRecordDetailItem
                    label="Alamat Institusi"
                    value={item.institutionAddress}
                  />
                </>
              ) : null}
              <AdminRecordDetailItem label="Email" value={item.email} />
              <AdminRecordDetailItem label="Telepon" value={item.phoneNumber} />
              <AdminRecordDetailItem
                label="Pemohon Internal"
                value={item.requesterName}
                hrefIcon={Boolean(item.requesterId)}
                onClick={
                  item.requesterId && onOpenUserDetail
                    ? () => onOpenUserDetail(item.requesterId)
                    : undefined
                }
              />
              {!isGuestRequester ? (
                <AdminRecordDetailItem
                  label="Prodi Pemohon"
                  value={item.requesterDepartment}
                />
              ) : null}
              <AdminRecordDetailItem label="Status" value={item.status} status />
            </AdminRecordDetailGrid>
          </AdminRecordDetailSection>

          <AdminRecordDetailSection
            title="Detail Sampel"
            icon={<FlaskConical className="h-5 w-5" />}
          >
            <AdminRecordDetailGrid>
              <AdminRecordDetailItem label="Nama Sampel" value={item.sampleName} />
              <AdminRecordDetailItem label="Jenis Sampel" value={item.sampleType} />
              <AdminRecordDetailItem label="Merek Sampel" value={item.sampleBrand} />
              <AdminRecordDetailItem
                label="Kemasan Sampel"
                value={item.samplePackaging}
              />
              <AdminRecordDetailItem
                label="Berat Netto / Dimensi Sampel"
                value={item.sampleWeight}
              />
              <AdminRecordDetailItem label="Jumlah Sampel" value={item.sampleQuantity} />
            </AdminRecordDetailGrid>
          </AdminRecordDetailSection>

          <AdminRecordDetailSection
            title="Spesifikasi Pengujian"
            icon={<Microscope className="h-5 w-5" />}
          >
            <AdminRecordDetailGrid>
              <AdminRecordDetailItem
                label="Cara Penyajian / Penanganan"
                value={item.sampleTestingServing}
              />
              <AdminRecordDetailItem
                label="Metode Pengujian"
                value={item.sampleTestingMethod}
              />
              <AdminRecordDetailItem
                label="Jenis Pengujian"
                value={item.sampleTestingType}
              />
              <AdminRecordDetailItem
                label="Disetujui Oleh"
                value={item.approvedByName}
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
              />
              {item.status === "Rejected" ? (
                <AdminRecordDetailItem
                  label="Waktu Ditolak"
                  value={formatDateTimeWib(item.rejectedAt)}
                />
              ) : null}
              {item.status === "Completed" ? (
                <AdminRecordDetailItem
                  label="Waktu Selesai"
                  value={formatDateTimeWib(item.completedAt)}
                />
              ) : null}
            </AdminRecordDetailGrid>
          </AdminRecordDetailSection>

          <AdminRecordDetailSection
            title="Dokumen Pengujian"
            icon={<ClipboardList className="h-5 w-5" />}
          >
            <SampleTestingDocumentsSection
              item={item}
              viewerRole="approver"
              embedded
              allowActions={false}
            />
          </AdminRecordDetailSection>
        </AdminRecordDetailShell>
      )}
    </>
  );
}
