"use client";

import { ArrowLeft, ClipboardPlus, Loader2, Package2, Settings2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { Button, Skeleton } from "@/components/ui";
import { useEquipmentDetail } from "@/hooks/shared/resources/equipments";
import { useSoftwares } from "@/hooks/shared/resources/softwares";

type EquipmentDetailParams = {
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

function EquipmentDetailSkeleton() {
  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28 bg-slate-700" />
            <Skeleton className="h-7 w-56 bg-slate-700" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-44 bg-slate-700" />
            <Skeleton className="h-10 w-28 bg-slate-700" />
          </div>
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
        <div className="space-y-4">
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
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function EquipmentDetailPage() {
  const router = useRouter();
  const params = useParams<EquipmentDetailParams>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const { equipment, isLoading, error } = useEquipmentDetail(id);
  const isComputerCategory = String(equipment?.category ?? "").trim().toLowerCase() === "computer";
  const {
    softwares,
    isLoading: isLoadingSoftwares,
    hasLoadedOnce: hasLoadedSoftwares,
    error: softwareError,
  } = useSoftwares(1, 100, {
    equipment: id ? String(id) : "",
  });

  if (isLoading) return <EquipmentDetailSkeleton />;

  if (error) {
    return (
      <section className="space-y-3">
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
        <Button type="button" variant="outline" onClick={() => router.push("/booking-rooms/equipment")}>
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Daftar Peralatan
        </Button>
      </section>
    );
  }

  if (!equipment) {
    return (
      <section className="space-y-3">
        <p className="text-sm text-slate-600">Data alat tidak ditemukan.</p>
        <Button type="button" variant="outline" onClick={() => router.push("/booking-rooms/equipment")}>
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Daftar Peralatan
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-slate-300">Detail Peralatan</p>
            <h2 className="mt-1 text-xl font-bold text-slate-50">{equipment.name}</h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {equipment.isBorrowable && (
            <Button type="button" onClick={() => router.push(`/borrow-equipment/form?equipment=${id}`)}>
              <ClipboardPlus className="h-4 w-4" />
              Ajukan Peminjaman Alat
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => router.push("/booking-rooms/equipment")}>
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <DetailCard
            title="Informasi Peralatan"
            subtitle="Ringkasan detail peralatan yang tersedia."
            icon={<Package2 className="h-4 w-4" />}
          >
            <DetailMetaItem label="Nama Alat" value={equipment.name} />
            <DetailMetaItem label="Kategori" value={equipment.category} />
            <DetailMetaItem label="Status" value={formatStatus(equipment.status)} />
            <DetailMetaItem label="Jumlah" value={equipment.quantity} />
            <DetailMetaItem label="Ruangan" value={equipment.roomName} />
            <DetailMetaItem label="Deskripsi" value={equipment.description || "-"} />
          </DetailCard>
        </div>

        <div className="space-y-4">
          <DetailCard
            title="Informasi Peminjaman"
            subtitle="Informasi singkat sebelum mengajukan peminjaman."
            icon={<Settings2 className="h-4 w-4" />}
          >
            <DetailMetaItem label="Status Saat Ini" value={formatStatus(equipment.status)} />
            <DetailMetaItem label="Lokasi" value={`Peralatan ini terdaftar di ${equipment.roomName}.`} />
            <DetailMetaItem
              label="Peminjaman"
              value={
                equipment.isBorrowable
                  ? "Gunakan tombol Ajukan Peminjaman Alat untuk melanjutkan pengajuan dari peralatan ini."
                  : "Peralatan ini tidak tersedia untuk dipinjam."
              }
            />
          </DetailCard>
        </div>
      </div>

      {isComputerCategory ? (
        <DetailCard
          title="Software Terpasang"
          subtitle="Daftar software yang terhubung dengan perangkat computer ini."
          icon={<Package2 className="h-4 w-4" />}
        >
          {softwareError ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {softwareError}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[920px] table-fixed">
                  <thead className="border-b border-slate-800 bg-slate-900">
                    <tr className="text-left text-xs uppercase tracking-[0.08em] text-slate-100">
                      <th className="w-[28%] px-4 py-3 font-semibold">Nama Software</th>
                      <th className="w-[12%] px-4 py-3 font-semibold">Versi</th>
                      <th className="w-[18%] px-4 py-3 font-semibold">Lisensi</th>
                      <th className="w-[18%] px-4 py-3 font-semibold">Kedaluwarsa Lisensi</th>
                      <th className="w-[24%] px-4 py-3 font-semibold">Deskripsi</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {isLoadingSoftwares || !hasLoadedSoftwares ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Memuat daftar software...
                          </div>
                        </td>
                      </tr>
                    ) : softwares.length ? (
                      softwares.map((software) => (
                        <tr key={String(software.id)} className="border-b border-slate-100 last:border-b-0">
                          <td className="px-4 py-3 align-top font-medium text-slate-900">{software.name}</td>
                          <td className="px-4 py-3 align-top text-slate-700">{software.version || "-"}</td>
                          <td className="px-4 py-3 align-top text-slate-700">{software.licenseInfo || "-"}</td>
                          <td className="px-4 py-3 align-top text-slate-700">{software.licenseExpiration || "-"}</td>
                          <td className="px-4 py-3 align-top text-xs leading-5 text-slate-600">
                            {software.description || "Tidak ada deskripsi software."}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                          Belum ada software yang terdaftar pada perangkat ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DetailCard>
      ) : null}
    </section>
  );
}
