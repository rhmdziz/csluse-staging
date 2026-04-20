"use client";


import { useState } from "react";

import { ArrowLeft, ClipboardList, FlaskConical, UserRound } from "lucide-react";
import { toast } from "sonner";

import { useParams, usePathname, useRouter } from "next/navigation";

import { DeleteRequestConfirmDialog } from "@/components/dialogs";
import { DashboardDetailReviewPanel } from "@/components/dashboard/layout";

import {
  SampleTestingMetaItem,
  SampleTestingSectionCard,
} from "@/components/dashboard/sample-testing/content";

import { SampleTestingDocumentsSection } from "@/components/dashboard/sample-testing";

import { RequestInformationCard, RequestProgressDialog, ProgressSteps } from "@/components/shared";

import { Button, Skeleton } from "@/components/ui";

import {
  useSampleTestingDetail,
  useUpdateSampleTestingStatus,
} from "@/hooks/sample-testing";

import { formatDateTimeWib } from "@/lib/date";

import { getSampleTestingProgressFlow } from "@/lib/request";

import {
  getSampleTestingStatusDisplayLabel,
  getStatusBadgeClass,
  normalizeStatus,
} from "@/lib/request";

function SampleTestingDetailSkeleton() {
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
      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
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
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
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
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function SampleTestingDetailPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { id } = useParams();
  const sampleTestingId = Array.isArray(id) ? id[0] : id;
  const [reloadKey, setReloadKey] = useState(0);
  const [progressOpen, setProgressOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const { updateSampleTestingStatus, pendingAction } =
    useUpdateSampleTestingStatus();
  const { sampleTesting: item, isLoading, error } = useSampleTestingDetail(
    sampleTestingId ?? null,
    reloadKey,
    { enabled: true },
  );

  const isApprovalPage = pathname.startsWith("/sample-testing/approval/");
  const backHref = isApprovalPage ? "/sample-testing/approval" : "/sample-testing";
  const backLabel = isApprovalPage
    ? "Kembali ke Daftar Pengajuan"
    : "Kembali ke Pengajuan Saya";
  const canCancelSampleTesting =
    !isApprovalPage && normalizeStatus(item?.status) === "approved";

  if (isLoading) return <SampleTestingDetailSkeleton />;

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
        <p className="text-sm text-slate-600">Data pengajuan pengujian sampel tidak ditemukan.</p>
        <Button type="button" variant="outline" onClick={() => router.push(backHref)}>
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Button>
      </section>
    );
  }

  const handleCancelSampleTesting = async () => {
    const result = await updateSampleTestingStatus(item.id, "cancel");
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Pengajuan pengujian sampel berhasil dibatalkan.");
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
              {getSampleTestingStatusDisplayLabel(item.status)}
            </button>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => router.push(backHref)}>
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-1 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-900">Progress Pengajuan</h3>
        </div>
        <ProgressSteps
          steps={getSampleTestingProgressFlow(item)}
          minWidthClassName="min-w-[760px]"
        />
      </div>

      {isApprovalPage ? (
        <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-4">
            <SampleTestingDocumentsSection
              item={item}
              viewerRole="approver"
              onUploaded={() => setReloadKey((prev) => prev + 1)}
            />

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
          </div>
          <div className="space-y-4">
            {sampleTestingId ? (
              <DashboardDetailReviewPanel
                context={{ kind: "sample-testing", id: sampleTestingId }}
                initialSampleTesting={item}
                onActionComplete={() => setReloadKey((prev) => prev + 1)}
              />
            ) : null}

            <SampleTestingSectionCard
              title="Informasi Pemohon"
              subtitle="Identitas pemohon dan informasi institusi yang dicantumkan saat pengajuan."
              icon={<UserRound className="h-5 w-5" />}
            >
              <SampleTestingMetaItem label="Nama Pemohon" value={item.name} />
              <SampleTestingMetaItem label="Institusi" value={item.institution} />
              <SampleTestingMetaItem
                label="Alamat Institusi"
                value={item.institutionAddress}
              />
              <SampleTestingMetaItem label="Email" value={item.email} />
              <SampleTestingMetaItem label="Nomor Telepon" value={item.phoneNumber} />

            </SampleTestingSectionCard>

            <RequestInformationCard
              icon={<ClipboardList className="h-4 w-4" />}
              requesterName={item.name}
              requesterDepartment={item.requesterDepartment}
              status={item.status}
              onStatusClick={() => setProgressOpen(true)}
              approvedByName={item.approvedByName}
            >
              <SampleTestingMetaItem
                label="Tanggal Dibuat"
                value={formatDateTimeWib(item.createdAt)}
              />
              <SampleTestingMetaItem
                label="Terakhir Diperbarui"
                value={formatDateTimeWib(item.updatedAt)}
              />
            </RequestInformationCard>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-4">
            <SampleTestingDocumentsSection
              item={item}
              viewerRole="requester"
              onUploaded={() => setReloadKey((prev) => prev + 1)}
            />

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
          </div>

          <div className="space-y-4">
            <SampleTestingSectionCard
              title="Informasi Pemohon"
              subtitle="Identitas pemohon dan informasi institusi yang dicantumkan saat pengajuan."
              icon={<UserRound className="h-5 w-5" />}
            >
              <SampleTestingMetaItem label="Nama Pemohon" value={item.name} />
              <SampleTestingMetaItem label="Institusi" value={item.institution} />
              <SampleTestingMetaItem
                label="Alamat Institusi"
                value={item.institutionAddress}
              />
              <SampleTestingMetaItem label="Email" value={item.email} />
              <SampleTestingMetaItem label="Nomor Telepon" value={item.phoneNumber} />
              <SampleTestingMetaItem
                label="Prodi Pemohon"
                value={item.requesterDepartment}
              />
            </SampleTestingSectionCard>

            <RequestInformationCard
              icon={<ClipboardList className="h-4 w-4" />}
              requesterName={item.name}
              requesterDepartment={item.requesterDepartment}
              status={item.status}
              onStatusClick={() => setProgressOpen(true)}
              approvedByName={item.approvedByName}
            >
              <SampleTestingMetaItem
                label="Tanggal Dibuat"
                value={formatDateTimeWib(item.createdAt)}
              />
              <SampleTestingMetaItem
                label="Terakhir Diperbarui"
                value={formatDateTimeWib(item.updatedAt)}
              />
            </RequestInformationCard>

            {canCancelSampleTesting ? (
              <section className="rounded-xl border border-rose-200 bg-rose-50/70 p-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  Batalkan Pengajuan
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Pengajuan yang sudah disetujui dapat dibatalkan oleh pemohon sebelum proses lanjutan berjalan.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  className="mt-4"
                  onClick={() => setCancelOpen(true)}
                  disabled={pendingAction.sampleTestingId === item.id}
                >
                  Batalkan Pengajuan
                </Button>
              </section>
            ) : null}
          </div>
        </div>
      )}
      <DeleteRequestConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onConfirm={() => void handleCancelSampleTesting()}
        isSubmitting={pendingAction.sampleTestingId === item.id}
        title="Batalkan pengajuan pengujian sampel ini?"
        description="Status pengajuan akan diubah menjadi dibatalkan dan tidak akan diproses lebih lanjut."
        confirmLabel="Ya, Batalkan"
      />
      <RequestProgressDialog
        open={progressOpen}
        onOpenChange={setProgressOpen}
        title="Progress Pengujian Sampel"
        code={item.code}
        steps={getSampleTestingProgressFlow(item)}
      />
    </section>
  );
}
