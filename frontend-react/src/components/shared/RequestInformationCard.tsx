"use client";

import type { ReactNode } from "react";

import { getStatusBadgeClass, getStatusDisplayLabel } from "@/lib/request";

function hasDisplayValue(value?: string | null) {
  if (!value) return false;
  const normalized = value.trim();
  return normalized !== "" && normalized !== "-";
}

function DetailMetaItem({
  label,
  value,
  itemGridClassName,
}: {
  label: string;
  value: string;
  itemGridClassName?: string;
}) {
  if (!hasDisplayValue(value)) return null;

  return (
    <div
      className={`grid gap-1 rounded-md border border-slate-200 bg-slate-50/80 px-4 py-3 ${itemGridClassName ?? "md:grid-cols-[180px_minmax(0,1fr)]"} md:items-start md:gap-4`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xs leading-5 text-slate-800 break-words">{value}</p>
    </div>
  );
}

export function RequestInformationCard({
  icon,
  requesterName,
  requesterDepartment,
  status,
  onStatusClick,
  approvedByName,
  rejectionNote,
  children,
  itemGridClassName,
}: {
  icon: ReactNode;
  requesterName: string;
  requesterDepartment?: string;
  status: string;
  onStatusClick?: () => void;
  approvedByName?: string;
  rejectionNote?: string;
  children?: ReactNode;
  itemGridClassName?: string;
}) {
  const approverLabel = status === "Rejected" ? "Ditolak Oleh" : "Disetujui Oleh";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Informasi Permohonan</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Informasi utama permohonan dan hasil persetujuan saat ini.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <DetailMetaItem
          label="Pemohon"
          value={requesterName}
          itemGridClassName={itemGridClassName}
        />
        <DetailMetaItem
          label="Prodi Pemohon"
          value={requesterDepartment || "-"}
          itemGridClassName={itemGridClassName}
        />
        <div
          className={`grid gap-1 rounded-md border border-slate-200 bg-slate-50/80 px-4 py-3 ${itemGridClassName ?? "md:grid-cols-[180px_minmax(0,1fr)]"} md:items-start md:gap-4`}
        >
          <p className="text-xs text-slate-500">Status Saat Ini</p>
          <div className="flex items-center">
            {onStatusClick ? (
              <button
                type="button"
                onClick={onStatusClick}
                className={`inline-flex w-fit cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(status)}`}
              >
                {getStatusDisplayLabel(status)}
              </button>
            ) : (
              <span
                className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(status)}`}
              >
                {getStatusDisplayLabel(status)}
              </span>
            )}
          </div>
        </div>
        <DetailMetaItem
          label={approverLabel}
          value={approvedByName || "-"}
          itemGridClassName={itemGridClassName}
        />
        <DetailMetaItem
          label="Alasan Penolakan"
          value={rejectionNote || "-"}
          itemGridClassName={itemGridClassName}
        />
        {children}
      </div>
    </section>
  );
}
