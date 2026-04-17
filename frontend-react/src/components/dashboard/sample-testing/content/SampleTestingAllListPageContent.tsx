"use client";

import { useEffect, useState } from "react";

import {
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Eye,
  FileText,
  FlaskConical,
  Loader2,
  PackageSearch,
  RotateCcw,
  Settings2,
} from "lucide-react";

import { useRouter, useSearchParams } from "next/navigation";

import { DashboardDetailReviewDialog } from "@/components/dashboard/layout/DashboardDetailReviewDialog";

import {
  SampleTestingDocumentsDialog,
  SampleTestingSummaryCard,
} from "@/components/dashboard/sample-testing";

import {
  DataPagination,
  InlineErrorAlert,
  RequestProgressDialog,
  TableActionIconButton,
} from "@/components/shared";

import {
  getStatusBadgeClass,
  getSampleTestingStatusDisplayLabel,
  getStatusSummaryTone,
  normalizeStatus,
} from "@/lib/request";

import { formatDateTimeWib } from "@/lib/date";

import { useSampleTestingList } from "@/hooks/sample-testing";

import { toEndOfDay, toStartOfDay } from "@/lib/date";

import { getSampleTestingProgressFlow } from "@/lib/request";

const PAGE_SIZE = 10;

function canShowDocumentAction(status: string) {
  const normalized = normalizeStatus(status);
  return ["approved", "diproses", "menunggu pembayaran", "completed"].includes(
    normalized,
  );
}

export default function SampleTestingAllListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [progressSampleTestingId, setProgressSampleTestingId] = useState<
    string | null
  >(null);
  const [documentsSampleTestingId, setDocumentsSampleTestingId] = useState<
    string | null
  >(null);
  const [reviewSampleTestingId, setReviewSampleTestingId] = useState<
    string | null
  >(null);
  const [reloadKey, setReloadKey] = useState(0);
  const status = searchParams.get("status") ?? "";
  const search = searchParams.get("q") ?? "";
  const requestedBy = searchParams.get("requested_by") ?? "";
  const createdAfter = searchParams.get("created_after") ?? "";
  const createdBefore = searchParams.get("created_before") ?? "";
  const isActiveFilter = status === "active";
  const emptyMessage = isActiveFilter
    ? "Tidak ada pengajuan aktif pengujian sampel yang menjadi tanggung jawab Anda."
    : "Belum ada pengajuan pengujian sampel yang perlu Anda proses.";

  useEffect(() => {
    setPage(1);
  }, [status, search, requestedBy, createdAfter, createdBefore]);

  const {
    sampleTestings,
    totalCount,
    aggregates,
    isLoading,
    hasLoadedOnce,
    error,
  } = useSampleTestingList(
    page,
    PAGE_SIZE,
    {
      q: search,
      status,
      requestedBy,
      createdAfter: createdAfter ? toStartOfDay(createdAfter) : "",
      createdBefore: createdBefore ? toEndOfDay(createdBefore) : "",
    },
    reloadKey,
    "all",
  );

  const totalPages = Math.max(
    1,
    Math.ceil((totalCount || sampleTestings.length) / PAGE_SIZE),
  );
  const progressSampleTesting =
    sampleTestings.find(
      (item) => String(item.id) === progressSampleTestingId,
    ) ?? null;

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
        <SampleTestingSummaryCard
          label="Total Pengajuan"
          value={aggregates.total}
          icon={<PackageSearch className="h-4 w-4" />}
          tone={getStatusSummaryTone("total")}
        />
        <SampleTestingSummaryCard
          label="Menunggu"
          value={aggregates.pending}
          icon={<CalendarClock className="h-4 w-4" />}
          tone={getStatusSummaryTone("pending")}
        />
        <SampleTestingSummaryCard
          label="Disetujui"
          value={aggregates.approved}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone={getStatusSummaryTone("approved")}
        />
        <SampleTestingSummaryCard
          label="Diproses"
          value={aggregates.diproses}
          icon={<Settings2 className="h-4 w-4" />}
          tone={getStatusSummaryTone("Diproses")}
        />
        <SampleTestingSummaryCard
          label="Menunggu Bayar"
          value={aggregates.menungguPembayaran}
          icon={<CircleDollarSign className="h-4 w-4" />}
          tone={getStatusSummaryTone("menunggu pembayaran")}
        />
        <SampleTestingSummaryCard
          label="Selesai"
          value={aggregates.completed}
          icon={<FlaskConical className="h-4 w-4" />}
          tone={getStatusSummaryTone("completed")}
        />
        <SampleTestingSummaryCard
          label="Ditolak"
          value={aggregates.rejected}
          icon={<RotateCcw className="h-4 w-4" />}
          tone={getStatusSummaryTone("rejected")}
        />
      </div>

      {error ? <InlineErrorAlert>{error}</InlineErrorAlert> : null}

      <div className="w-full max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1180px]">
          <thead className="border-b border-slate-800 bg-slate-900">
            <tr className="text-left text-sm">
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                Kode
              </th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                Pemohon
              </th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                Institusi
              </th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                Sampel
              </th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                Jenis Uji
              </th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                Status
              </th>
              <th className="px-3 py-3 font-medium whitespace-nowrap text-slate-50">
                Dibuat
              </th>
              <th className="sticky right-0 z-20 bg-slate-900 px-3 py-3 text-center font-medium whitespace-nowrap text-slate-50 shadow-[-1px_0_0_0_rgba(51,65,85,1)]">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {isLoading || !hasLoadedOnce ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-5 text-center text-slate-500"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat data...
                  </div>
                </td>
              </tr>
            ) : sampleTestings.length ? (
              sampleTestings.map((item) => (
                <tr key={String(item.id)} className="border-b last:border-b-0">
                  <td className="px-3 py-2.5 font-medium whitespace-nowrap text-slate-800">
                    {item.code}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">
                    <p className="font-medium text-slate-800">{item.name}</p>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {item.institution}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">
                    <div className="space-y-1">
                      <p className="font-medium text-slate-800">
                        {item.sampleName}
                      </p>
                      <p className="whitespace-nowrap text-slate-500">
                        {item.sampleType}
                      </p>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {item.sampleTestingType}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setProgressSampleTestingId(String(item.id))
                      }
                      className={`inline-flex cursor-pointer rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(item.status)}`}
                    >
                      {getSampleTestingStatusDisplayLabel(item.status)}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                    {formatDateTimeWib(item.createdAt)}
                  </td>
                  <td className="sticky right-0 z-10 bg-white px-3 py-2.5 text-center shadow-[-1px_0_0_0_rgba(226,232,240,1)]">
                    <div className="flex items-center justify-center gap-2">
                      {normalizeStatus(item.status) === "pending" ? (
                        <TableActionIconButton
                          type="button"
                          label="Review"
                          icon={<ClipboardCheck className="h-3.5 w-3.5" />}
                          className="w-8 rounded-md border border-sky-200 bg-sky-50 p-0 text-sky-700 shadow-none hover:bg-sky-100"
                          onClick={() =>
                            setReviewSampleTestingId(String(item.id))
                          }
                        />
                      ) : null}
                      {canShowDocumentAction(item.status) ? (
                        <TableActionIconButton
                          type="button"
                          label="Dokumen"
                          icon={<FileText className="h-3.5 w-3.5" />}
                          className="w-8 rounded-md border border-blue-200 bg-blue-50 p-0 text-blue-700 shadow-none hover:bg-blue-100"
                          onClick={() =>
                            setDocumentsSampleTestingId(String(item.id))
                          }
                        />
                      ) : null}
                      <TableActionIconButton
                        type="button"
                        label="Lihat detail"
                        icon={<Eye className="h-3.5 w-3.5" />}
                        className="w-8 rounded-md border border-slate-200 bg-slate-50 p-0 text-slate-700 shadow-none hover:bg-slate-100"
                        onClick={() =>
                          router.push(`/sample-testing/approval/${item.id}`)
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-5 text-center text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <DataPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount || sampleTestings.length}
        pageSize={PAGE_SIZE}
        itemLabel="pengajuan"
        isLoading={isLoading}
        onPageChange={setPage}
      />
      {progressSampleTesting ? (
        <RequestProgressDialog
          open={Boolean(progressSampleTestingId)}
          onOpenChange={(open) => {
            if (!open) setProgressSampleTestingId(null);
          }}
          title="Progress Pengujian Sampel"
          code={progressSampleTesting.code}
          steps={getSampleTestingProgressFlow(progressSampleTesting)}
        />
      ) : null}
      <SampleTestingDocumentsDialog
        open={Boolean(documentsSampleTestingId)}
        onOpenChange={(open) => {
          if (!open) setDocumentsSampleTestingId(null);
        }}
        sampleTestingId={documentsSampleTestingId}
        viewerRole="approver"
        onUploaded={() => setReloadKey((prev) => prev + 1)}
      />
      <DashboardDetailReviewDialog
        open={Boolean(reviewSampleTestingId)}
        onOpenChange={(open) => {
          if (!open) setReviewSampleTestingId(null);
        }}
        context={
          reviewSampleTestingId
            ? { kind: "sample-testing", id: reviewSampleTestingId }
            : null
        }
        onActionComplete={() => {
          setReviewSampleTestingId(null);
          setReloadKey((prev) => prev + 1);
        }}
      />
    </section>
  );
}
