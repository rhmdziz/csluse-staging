"use client";

import type { ReactNode } from "react";
import { FlaskConical, NotebookPen, UserRound } from "lucide-react";

import type { SampleTestingRow } from "@/hooks/sample-testing";
import { formatDateTimeWib } from "@/lib/date";
import {
  getSampleTestingStatusDisplayLabel,
  getStatusBadgeClass,
} from "@/lib/request";

function hasDisplayValue(value?: string | null) {
  if (!value) return false;
  const normalized = value.trim();
  return normalized !== "" && normalized !== "-";
}

export function SampleTestingSectionCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
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

export function SampleTestingMetaItem({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  const displayValue = hasDisplayValue(value) ? String(value).trim() : "-";

  return (
    <div className="grid gap-1 rounded-md border border-slate-200 bg-slate-50/80 px-4 py-3 md:grid-cols-[124px_minmax(0,1fr)] md:items-start md:gap-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`text-xs leading-5 break-words ${displayValue === "-" ? "italic text-slate-400" : "text-slate-800"}`}
      >
        {displayValue}
      </p>
    </div>
  );
}

export default function SampleTestingDetailContent({
  item,
  showHeader = true,
  onStatusClick,
}: {
  item: SampleTestingRow;
  showHeader?: boolean;
  onStatusClick?: () => void;
}) {
  return (
    <div className="space-y-4">
      {showHeader ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-slate-300">Detail Pengajuan</p>
              <h2 className="mt-1 text-xl font-bold text-slate-50">{item.code}</h2>
            </div>
            {onStatusClick ? (
              <button
                type="button"
                onClick={onStatusClick}
                className={`inline-flex cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(item.status)}`}
              >
                {getSampleTestingStatusDisplayLabel(item.status)}
              </button>
            ) : (
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(item.status)}`}
              >
                {getSampleTestingStatusDisplayLabel(item.status)}
              </span>
            )}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <SampleTestingSectionCard
            title="Detail Pengujian Sampel"
            subtitle="Ringkasan informasi sampel dan pengujian yang diajukan."
            icon={<FlaskConical className="h-5 w-5" />}
          >
            <SampleTestingMetaItem label="Nama Sampel" value={item.sampleName} />
            <SampleTestingMetaItem label="Jenis Sampel" value={item.sampleType} />
            <SampleTestingMetaItem label="Merek Sampel" value={item.sampleBrand} />
            <SampleTestingMetaItem label="Kemasan Sampel" value={item.samplePackaging} />
            <SampleTestingMetaItem label="Berat Sampel" value={item.sampleWeight} />
            <SampleTestingMetaItem label="Jumlah Sampel" value={item.sampleQuantity} />
            <SampleTestingMetaItem
              label="Cara Penyajian / Penanganan"
              value={item.sampleTestingServing}
            />
            <SampleTestingMetaItem
              label="Metode Pengujian"
              value={item.sampleTestingMethod}
            />
            <SampleTestingMetaItem
              label="Jenis Pengujian"
              value={item.sampleTestingType}
            />
          </SampleTestingSectionCard>

          <SampleTestingSectionCard
            title="Informasi Permohonan"
            subtitle="Informasi status permohonan dan riwayat proses saat ini."
            icon={<NotebookPen className="h-5 w-5" />}
          >
            <div className="grid gap-1 rounded-md border border-slate-200 bg-slate-50/80 px-4 py-3 md:grid-cols-[124px_minmax(0,1fr)] md:items-start md:gap-4">
              <p className="text-xs text-slate-500">Status</p>
              <div className="flex items-center">
                {onStatusClick ? (
                  <button
                    type="button"
                    onClick={onStatusClick}
                    className={`inline-flex w-fit cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(item.status)}`}
                  >
                    {getSampleTestingStatusDisplayLabel(item.status)}
                  </button>
                ) : (
                  <span
                    className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(item.status)}`}
                  >
                    {getSampleTestingStatusDisplayLabel(item.status)}
                  </span>
                )}
              </div>
            </div>
            <SampleTestingMetaItem label="Tanggal Dibuat" value={formatDateTimeWib(item.createdAt)} />
            <SampleTestingMetaItem
              label="Terakhir Diperbarui"
              value={formatDateTimeWib(item.updatedAt)}
            />
            <SampleTestingMetaItem label="Disetujui Oleh" value={item.approvedByName} />
          </SampleTestingSectionCard>
        </div>

        <div className="space-y-6">
          <SampleTestingSectionCard
            title="Informasi Pemohon"
            subtitle="Identitas pemohon dan informasi institusi yang dicantumkan saat pengajuan."
            icon={<UserRound className="h-5 w-5" />}
          >
            <SampleTestingMetaItem label="Nama Pemohon" value={item.name} />
            <SampleTestingMetaItem label="Institusi" value={item.institution} />
            <SampleTestingMetaItem label="Alamat Institusi" value={item.institutionAddress} />
            <SampleTestingMetaItem label="Email" value={item.email} />
            <SampleTestingMetaItem label="Nomor Telepon" value={item.phoneNumber} />
            <SampleTestingMetaItem label="Prodi Pemohon" value={item.requesterDepartment} />
          </SampleTestingSectionCard>
        </div>
      </div>
    </div>
  );
}
