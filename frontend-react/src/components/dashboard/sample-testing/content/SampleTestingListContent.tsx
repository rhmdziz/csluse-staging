"use client";

import { useEffect, useMemo, useState } from "react";

import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Eye,
  FlaskConical,
  Loader2,
  PackageSearch,
  Pencil,
  RotateCcw,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  DataPagination,
  InlineErrorAlert,
  RequestProgressDialog,
  type ProgressStepItem,
  TableActionIconButton,
} from "@/components/shared";
import { DeleteRequestConfirmDialog } from "@/components/dialogs";

import {
  SampleTestingDocumentsDialog,
  SampleTestingSummaryCard,
} from "@/components/dashboard/sample-testing";
import { DashboardListTable } from "@/components/dashboard/shared";

import { formatDateTimeWib } from "@/lib/date";

import { getSampleTestingProgressFlow } from "@/lib/request";

import {
  getStatusBadgeClass,
  getSampleTestingStatusDisplayLabel,
  getStatusSummaryTone,
  normalizeStatus,
} from "@/lib/request";

import { toEndOfDay, toStartOfDay } from "@/lib/date";

import {
  useCreateSampleTesting,
  useSampleTestingList,
  useUpdateSampleTestingStatus,
  type SampleTestingListScope,
} from "@/hooks/sample-testing";

const PAGE_SIZE = 20;

function canShowDocumentAction(status: string) {
  const normalized = normalizeStatus(status);
  return ["approved", "diproses", "completed"].includes(normalized);
}

type SampleTestingListContentProps = {
  scope: SampleTestingListScope;
  emptyMessage: string;
};

export default function SampleTestingListContent({
  scope,
  emptyMessage,
}: SampleTestingListContentProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [progressState, setProgressState] = useState<{
    code: string;
    steps: ProgressStepItem[];
  } | null>(null);
  const [documentsSampleTestingId, setDocumentsSampleTestingId] = useState<
    string | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    code: string;
  } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{
    id: string;
    code: string;
  } | null>(null);
  const status = searchParams.get("status") ?? "";
  const search = searchParams.get("q") ?? "";
  const createdAfter = searchParams.get("created_after") ?? "";
  const createdBefore = searchParams.get("created_before") ?? "";
  const normalizedStatus = normalizeStatus(status);

  useEffect(() => {
    setPage(1);
  }, [status, search, createdAfter, createdBefore]);

  const { deleteSampleTesting, isSubmitting: isDeletingSampleTesting } =
    useCreateSampleTesting();
  const { updateSampleTestingStatus, pendingAction } =
    useUpdateSampleTestingStatus();
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
      createdAfter: createdAfter ? toStartOfDay(createdAfter) : "",
      createdBefore: createdBefore ? toEndOfDay(createdBefore) : "",
    },
    reloadKey,
    scope,
  );

  const filteredSampleTestings = useMemo(
    () => sampleTestings,
    [sampleTestings],
  );

  const totalPages = Math.max(
    1,
    Math.ceil((totalCount || filteredSampleTestings.length) / PAGE_SIZE),
  );

  const canManageSampleTesting = (statusValue: string) =>
    scope !== "all" && normalizeStatus(statusValue) === "pending";

  const canCancelSampleTesting = (statusValue: string) =>
    scope !== "all" && normalizeStatus(statusValue) === "approved";

  const handleDeleteSampleTesting = async () => {
    if (!deleteTarget) return;

    const result = await deleteSampleTesting(deleteTarget.id);
    if (!result.ok) return;

    setDeleteTarget(null);
    setReloadKey((prev) => prev + 1);
  };

  const handleCancelSampleTesting = async () => {
    if (!cancelTarget) return;

    const result = await updateSampleTestingStatus(cancelTarget.id, "cancel");
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Pengajuan pengujian sampel berhasil dibatalkan.");
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SampleTestingSummaryCard
          label="Total Pengajuan"
          value={aggregates.total}
          icon={<PackageSearch className="h-4 w-4" />}
          tone={getStatusSummaryTone("total")}
          isActive={!normalizedStatus}
          onClick={() => handleStatusCardClick("")}
        />
        <SampleTestingSummaryCard
          label="Menunggu"
          value={aggregates.pending}
          icon={<CalendarClock className="h-4 w-4" />}
          tone={getStatusSummaryTone("pending")}
          isActive={normalizedStatus === "pending"}
          onClick={() => handleStatusCardClick("pending")}
        />
        <SampleTestingSummaryCard
          label="Disetujui"
          value={aggregates.approved}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone={getStatusSummaryTone("approved")}
          isActive={normalizedStatus === "approved"}
          onClick={() => handleStatusCardClick("approved")}
        />
        <SampleTestingSummaryCard
          label="Diproses"
          value={aggregates.diproses}
          icon={<Settings2 className="h-4 w-4" />}
          tone={getStatusSummaryTone("Diproses")}
          isActive={normalizedStatus === "diproses"}
          onClick={() => handleStatusCardClick("diproses")}
        />
        <SampleTestingSummaryCard
          label="Selesai"
          value={aggregates.completed}
          icon={<FlaskConical className="h-4 w-4" />}
          tone={getStatusSummaryTone("completed")}
          isActive={normalizedStatus === "completed"}
          onClick={() => handleStatusCardClick("completed")}
        />
        <SampleTestingSummaryCard
          label="Ditolak"
          value={aggregates.rejected}
          icon={<RotateCcw className="h-4 w-4" />}
          tone={getStatusSummaryTone("rejected")}
          isActive={normalizedStatus === "rejected"}
          onClick={() => handleStatusCardClick("rejected")}
        />
      </div>

      {error ? <InlineErrorAlert>{error}</InlineErrorAlert> : null}

      <DashboardListTable
        columns={[
          { key: "code", label: "Kode" },
          { key: "sample", label: "Sampel" },
          { key: "type", label: "Jenis Uji" },
          { key: "institution", label: "Institusi" },
          { key: "status", label: "Status" },
          { key: "created", label: "Dibuat" },
          {
            key: "actions",
            label: "Aksi",
            className:
              "sticky right-0 z-20 bg-slate-900 text-center shadow-[-1px_0_0_0_rgba(51,65,85,1)]",
          },
        ]}
        colSpan={7}
        hasRows={filteredSampleTestings.length > 0}
        isLoading={isLoading}
        hasLoadedOnce={hasLoadedOnce}
        emptyMessage={emptyMessage}
        tableClassName="min-w-[1160px]"
      >
        {filteredSampleTestings.map((item) => (
          <tr key={String(item.id)} className="border-b last:border-b-0">
            <td className="px-3 py-2.5 font-medium whitespace-nowrap text-slate-800">
              {item.code}
            </td>
            <td className="px-3 py-2.5 text-slate-700">
              <div className="space-y-1">
                <p className="font-medium text-slate-800">{item.sampleName}</p>
                <p className="whitespace-nowrap text-slate-500">{item.sampleType}</p>
              </div>
            </td>
            <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
              {item.sampleTestingType}
            </td>
            <td className="px-3 py-2.5 text-slate-700">
              <p className="font-medium text-slate-800">{item.institution}</p>
            </td>
            <td className="px-3 py-2.5">
              <button
                type="button"
                onClick={() =>
                  setProgressState({
                    code: item.code,
                    steps: getSampleTestingProgressFlow(item),
                  })
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
                {canShowDocumentAction(item.status) ? (
                  <TableActionIconButton
                    type="button"
                    label="Dokumen"
                    icon={<FileText className="h-3.5 w-3.5" />}
                    className="w-8 rounded-md border border-blue-200 bg-blue-50 p-0 text-blue-700 shadow-none hover:bg-blue-100"
                    onClick={() => setDocumentsSampleTestingId(String(item.id))}
                  />
                ) : null}
                {canManageSampleTesting(item.status) ? (
                  <>
                    <TableActionIconButton
                      type="button"
                      label="Edit"
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      className="w-8 rounded-md border border-amber-200 bg-amber-50 p-0 text-amber-700 shadow-none hover:bg-amber-100"
                      onClick={() => router.push(`/sample-testing/${item.id}/edit`)}
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
                {canCancelSampleTesting(item.status) ? (
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
                  onClick={() => router.push(`/sample-testing/${item.id}`)}
                />
              </div>
            </td>
          </tr>
        ))}
      </DashboardListTable>

      <DataPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount || filteredSampleTestings.length}
        pageSize={PAGE_SIZE}
        itemLabel="pengajuan"
        isLoading={isLoading}
        onPageChange={setPage}
      />

      <RequestProgressDialog
        open={Boolean(progressState)}
        onOpenChange={(open) => {
          if (!open) setProgressState(null);
        }}
        title="Progress Pengujian Sampel"
        code={progressState?.code ?? ""}
        steps={progressState?.steps ?? []}
      />
      <SampleTestingDocumentsDialog
        open={Boolean(documentsSampleTestingId)}
        onOpenChange={(open) => {
          if (!open) setDocumentsSampleTestingId(null);
        }}
        sampleTestingId={documentsSampleTestingId}
        viewerRole="requester"
      />
      <DeleteRequestConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => void handleDeleteSampleTesting()}
        isSubmitting={isDeletingSampleTesting}
        title="Hapus Pengajuan Pengujian Sampel"
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
        onConfirm={() => void handleCancelSampleTesting()}
        isSubmitting={pendingAction.sampleTestingId === cancelTarget?.id}
        title="Batalkan pengajuan pengujian sampel ini?"
        description="Status pengajuan akan diubah menjadi dibatalkan dan tidak akan diproses lebih lanjut."
        confirmLabel="Ya, Batalkan"
      />
    </section>
  );
}
