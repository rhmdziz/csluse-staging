"use client";

import type { ReactNode } from "react";
import { ClipboardList, FileText, ScrollText, Stamp } from "lucide-react";

import {
  AdminRecordAsideCard,
  AdminRecordAsideItem,
  AdminRecordDetailGrid,
  AdminRecordDetailItem,
  AdminRecordDetailSection,
  AdminRecordDetailShell,
} from "@/components/admin/history";
import type { LabClearanceDetail } from "@/services/lab-clearance";
import { formatDateTimeWib } from "@/lib/date";

type Props = {
  item: LabClearanceDetail | null;
  isLoading: boolean;
  error: string;
  onBack: () => void;
  backLabel?: string;
  actions?: ReactNode;
  showAside?: boolean;
  onOpenUserDetail?: (userId: string | number) => void;
};

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  form_alat_kecil: "F-027A Alat Kecil",
  form_alat_besar: "F-027B Alat Besar",
  form_permintaan_bahan: "F-028 Bahan",
};

export default function AdminLabClearanceHistoryDetailContent({
  item,
  isLoading,
  error,
  onBack,
  backLabel = "Kembali",
  actions,
  showAside = true,
  onOpenUserDetail,
}: Props) {
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
          Data record surat bebas lab tidak ditemukan.
        </div>
      ) : (
        <AdminRecordDetailShell
          title="Detail Surat Bebas Lab"
          code={item.code}
          icon={<ClipboardList className="h-5 w-5" />}
          status={item.status}
          onBack={onBack}
          backLabel={backLabel}
          actions={actions}
          aside={
            showAside ? (
              <>
                <AdminRecordAsideCard title="Ringkasan Status">
                  <AdminRecordAsideItem label="Status" value={item.status} />
                  <AdminRecordAsideItem
                    label="Diajukan"
                    value={formatDateTimeWib(item.created_at)}
                  />
                  <AdminRecordAsideItem
                    label="Diupdate"
                    value={formatDateTimeWib(item.updated_at)}
                  />
                  <AdminRecordAsideItem
                    label="Direview Oleh"
                    value={item.reviewed_by_detail?.full_name || "-"}
                  />
                </AdminRecordAsideCard>
                <AdminRecordAsideCard title="Audit Singkat">
                  <AdminRecordAsideItem label="Kode" value={item.code} />
                  <AdminRecordAsideItem
                    label="Pemohon"
                    value={item.requested_by_detail?.full_name || "-"}
                  />
                  <AdminRecordAsideItem
                    label="Angkatan"
                    value={item.requested_by_detail?.batch || "-"}
                  />
                </AdminRecordAsideCard>
              </>
            ) : undefined
          }
        >
          <AdminRecordDetailSection
            title="Informasi Review"
            icon={<Stamp className="h-5 w-5" />}
          >
            <AdminRecordDetailGrid>
              <AdminRecordDetailItem label="Kode Pengajuan" value={item.code} />
              <AdminRecordDetailItem label="Status" value={item.status} status />
              <AdminRecordDetailItem
                label="Diajukan Pada"
                value={formatDateTimeWib(item.created_at)}
              />
              <AdminRecordDetailItem
                label="Direview Pada"
                value={formatDateTimeWib(item.reviewed_at)}
              />
              <AdminRecordDetailItem
                label="Direview Oleh"
                value={item.reviewed_by_detail?.full_name || "-"}
                hrefIcon={Boolean(item.reviewed_by_detail?.id)}
                onClick={
                  item.reviewed_by_detail?.id && onOpenUserDetail
                    ? () => onOpenUserDetail(item.reviewed_by_detail!.id)
                    : undefined
                }
              />
              <AdminRecordDetailItem label="Catatan" value={item.note || "-"} />
            </AdminRecordDetailGrid>
          </AdminRecordDetailSection>

          <AdminRecordDetailSection
            title="Riwayat Penggunaan Ruang Lab"
            icon={<ScrollText className="h-5 w-5" />}
          >
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full table-auto text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Ruang Lab</th>
                    <th className="px-3 py-2 font-semibold">Tanggal Mulai</th>
                    <th className="px-3 py-2 font-semibold">Tanggal Selesai</th>
                  </tr>
                </thead>
                <tbody>
                  {item.booking_histories.length ? (
                    item.booking_histories.map((history) => (
                      <tr key={history.id} className="border-t">
                        <td className="px-3 py-2 text-slate-700">
                          {history.lab_room_name || "-"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                          {history.start_date || "-"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                          {history.end_date || "-"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-slate-500">
                        Tidak ada riwayat penggunaan ruang lab.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </AdminRecordDetailSection>

          <AdminRecordDetailSection
            title="Dokumen Pengajuan"
            icon={<FileText className="h-5 w-5" />}
          >
            <div className="space-y-3">
              {item.documents.length ? (
                item.documents.map((document) => (
                  <div
                    key={document.id}
                    className="flex flex-col gap-3 rounded-lg border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">
                        {DOCUMENT_TYPE_LABEL[document.document_type] ?? document.document_type}
                      </p>
                      <p className="truncate text-sm text-slate-500">{document.original_name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Diunggah pada {formatDateTimeWib(document.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={document.document_url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Buka Dokumen
                      </a>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Tidak ada dokumen tersimpan.
                </div>
              )}
            </div>
          </AdminRecordDetailSection>
        </AdminRecordDetailShell>
      )}
    </>
  );
}
