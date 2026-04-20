"use client";

import { ArrowLeft, FlaskConical, Loader2, Package2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { Button, Skeleton } from "@/components/ui";
import { useMaterialDetail } from "@/hooks/shared/resources/materials";

type MaterialDetailParams = {
  id?: string | string[];
};

function hasDisplayValue(value?: string | null) {
  if (!value) return false;
  const normalized = value.trim();
  return normalized !== "" && normalized !== "-";
}

function formatStatus(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "-";
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
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">{children}</div>
    </section>
  );
}

function DetailMetaItem({ label, value }: { label: string; value: string }) {
  if (!hasDisplayValue(value)) return null;
  return (
    <div className="grid gap-1 rounded-md border border-slate-200 bg-slate-50/80 px-4 py-3 md:grid-cols-[180px_minmax(0,1fr)] md:items-start md:gap-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="break-words text-xs leading-5 text-slate-800">{value}</p>
    </div>
  );
}

function MaterialDetailSkeleton() {
  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28 bg-slate-700" />
            <Skeleton className="h-7 w-56 bg-slate-700" />
          </div>
          <Skeleton className="h-10 w-28 bg-slate-700" />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
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
          </div>
        </div>
      </div>
    </section>
  );
}

export default function MaterialDetailPage() {
  const router = useRouter();
  const params = useParams<MaterialDetailParams>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const { material, isLoading, error } = useMaterialDetail(id);

  if (isLoading) return <MaterialDetailSkeleton />;

  if (error) {
    return (
      <section className="space-y-3">
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
        <Button type="button" variant="outline" onClick={() => router.push("/booking-rooms/materials")}>
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Daftar Bahan
        </Button>
      </section>
    );
  }

  if (!material) {
    return (
      <section className="space-y-3">
        <p className="text-sm text-slate-600">Data bahan tidak ditemukan.</p>
        <Button type="button" variant="outline" onClick={() => router.push("/booking-rooms/materials")}>
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Daftar Bahan
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-slate-300">Detail Bahan</p>
            <h2 className="mt-1 text-xl font-bold text-slate-50">{material.name}</h2>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => router.push("/booking-rooms/materials")}>
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <DetailCard
            title="Informasi Bahan"
            subtitle="Ringkasan detail bahan habis pakai yang tersedia di laboratorium."
            icon={<FlaskConical className="h-4 w-4" />}
          >
            <DetailMetaItem label="Nama Bahan" value={material.name} />
            <DetailMetaItem label="Kategori" value={material.category} />
            <DetailMetaItem label="Status" value={formatStatus(material.status)} />
            <DetailMetaItem label="Ruangan" value={material.roomName || "-"} />
            <DetailMetaItem label="Deskripsi" value={material.description || "-"} />
          </DetailCard>
        </div>

        <div className="space-y-4">
          <DetailCard
            title="Catatan Bahan"
            subtitle="Informasi singkat mengenai ketersediaan bahan ini."
            icon={<Package2 className="h-4 w-4" />}
          >
            <DetailMetaItem label="Status Saat Ini" value={formatStatus(material.status)} />
            {material.roomName ? (
              <DetailMetaItem label="Lokasi" value={`Bahan ini terdaftar di ${material.roomName}.`} />
            ) : null}
          </DetailCard>
        </div>
      </div>
    </section>
  );
}
