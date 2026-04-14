"use client";

import {
  ArrowLeft,
  CalendarPlus2,
  Loader2,
  MapPinned,
  Package2,
  Users,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { Button, Skeleton } from "@/components/ui";
import { useEquipments } from "@/hooks/shared/resources/equipments";
import { useRoomDetail } from "@/hooks/shared/resources/rooms";

type RoomDetailParams = {
  id?: string | string[];
};

function hasDisplayValue(value?: string | null) {
  if (!value) return false;
  const normalized = value.trim();
  return normalized !== "" && normalized !== "-";
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
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {subtitle}
          </p>
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

function EquipmentStatusBadge({ status }: { status: string }) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  if (normalized === "available") {
    return (
      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
        Available
      </span>
    );
  }

  if (normalized === "in use") {
    return (
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
        In Use
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
      {status || "-"}
    </span>
  );
}

function RoomDetailSkeleton() {
  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <Skeleton className="h-3 w-24 bg-slate-700" />
            <Skeleton className="h-7 w-56 bg-slate-700" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-48 bg-slate-700" />
            <Skeleton className="h-10 w-28 bg-slate-700" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          {/* Informasi Ruangan: 6 baris (Nama, Nomor, Lantai, Kapasitas, PIC, Deskripsi) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-72" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Catatan Pemakaian: 4 baris — baris 2-4 lebih tinggi karena teks panjang */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-60" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
            </div>
          </div>
        </div>
      </div>

      {/* Fasilitas & Peralatan */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-52" />
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          {/* Header tabel */}
          <div className="grid min-w-245 grid-cols-[22%_16%_10%_14%_12%_26%] border-b border-slate-800 bg-slate-900 px-4 py-3 gap-3">
            <Skeleton className="h-3 w-20 bg-slate-700" />
            <Skeleton className="h-3 w-16 bg-slate-700" />
            <Skeleton className="h-3 w-8 bg-slate-700" />
            <Skeleton className="h-3 w-12 bg-slate-700" />
            <Skeleton className="h-3 w-10 bg-slate-700" />
            <Skeleton className="h-3 w-20 bg-slate-700" />
          </div>
          {/* Baris data */}
          <div className="w-full overflow-x-auto">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`room-equipment-skeleton-${index}`}
                className="grid min-w-245 grid-cols-[22%_16%_10%_14%_12%_26%] gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
              >
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function RoomDetailPageContent() {
  const router = useRouter();
  const params = useParams<RoomDetailParams>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const { room, isLoading, error } = useRoomDetail(id);
  const {
    equipments,
    isLoading: isLoadingEquipments,
    hasLoadedOnce: hasLoadedEquipments,
    error: equipmentError,
  } = useEquipments(1, 100, { room: id ? String(id) : "" });

  if (isLoading) {
    return <RoomDetailSkeleton />;
  }

  if (error) {
    return (
      <section className="space-y-3">
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/rooms")}
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Daftar Ruangan
        </Button>
      </section>
    );
  }

  if (!room) {
    return (
      <section className="space-y-3">
        <p className="text-sm text-slate-600">Data ruangan tidak ditemukan.</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/rooms")}
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Daftar Ruangan
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-slate-300">Detail Ruangan</p>
            <h2 className="mt-1 text-xl font-bold text-slate-50">
              {room.name}
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => router.push(`/booking-rooms/form?room=${room.id}`)}
          >
            <CalendarPlus2 className="h-4 w-4" />
            Ajukan Peminjaman Lab
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/rooms")}
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <DetailCard
            title="Informasi Ruangan"
            subtitle="Ringkasan detail ruangan yang dapat dipilih untuk pengajuan peminjaman lab."
            icon={<MapPinned className="h-4 w-4" />}
          >
            <DetailMetaItem label="Nama Ruangan" value={room.name} />
            <DetailMetaItem label="Nomor Ruangan" value={room.number} />
            <DetailMetaItem label="Lantai" value={room.floor} />
            <DetailMetaItem label="Kapasitas" value={room.capacity} />
            <DetailMetaItem label="PIC Ruangan" value={room.picName} />
            <DetailMetaItem label="Deskripsi" value={room.description || "-"} />
          </DetailCard>

        </div>

        <div className="space-y-4">
          <DetailCard
            title="Catatan Pemakaian"
            subtitle="Informasi singkat sebelum Anda melanjutkan ke formulir pengajuan."
            icon={<Users className="h-4 w-4" />}
          >
            <DetailMetaItem
              label="Kapasitas Maksimum"
              value={`${room.capacity} peserta`}
            />
            <DetailMetaItem
              label="Pengajuan"
              value="Gunakan tombol Ajukan Peminjaman Lab untuk melanjutkan pengajuan dari ruangan ini."
            />
            <DetailMetaItem
              label="Fasilitas"
              value="Pastikan alat yang tersedia di ruangan ini sesuai dengan kebutuhan aktivitas Anda sebelum mengirim pengajuan."
            />
            <DetailMetaItem
              label="Akses"
              value="Hubungi PIC ruangan bila membutuhkan konfirmasi tambahan terkait fasilitas ruang."
            />
          </DetailCard>
        </div>
      </div>

      <DetailCard
        title="Fasilitas & Peralatan"
        subtitle="Daftar alat yang tersedia di ruangan ini."
        icon={<Package2 className="h-4 w-4" />}
      >
        {equipmentError ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {equipmentError}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[980px] table-fixed">
                <thead className="border-b border-slate-800 bg-slate-900">
                  <tr className="text-left text-xs uppercase tracking-[0.08em] text-slate-100">
                    <th className="w-[22%] px-4 py-3 font-semibold">
                      Nama Alat
                    </th>
                    <th className="w-[16%] px-4 py-3 font-semibold">
                      Kategori
                    </th>
                    <th className="w-[10%] px-4 py-3 font-semibold">Qty</th>
                    <th className="w-[14%] px-4 py-3 font-semibold">Status</th>
                    <th className="w-[12%] px-4 py-3 font-semibold">Tipe</th>
                    <th className="w-[26%] px-4 py-3 font-semibold">
                      Deskripsi
                    </th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {isLoadingEquipments || !hasLoadedEquipments ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Memuat daftar alat...
                        </div>
                      </td>
                    </tr>
                  ) : equipments.length ? (
                    equipments.map((equipment) => (
                      <tr
                        key={String(equipment.id)}
                        className="border-b border-slate-100 last:border-b-0"
                      >
                        <td className="px-4 py-3 align-top font-medium text-slate-900">
                          {equipment.name}
                        </td>
                        <td className="px-4 py-3 align-top text-slate-700">
                          {equipment.category || "-"}
                        </td>
                        <td className="px-4 py-3 align-top text-slate-700">
                          {equipment.quantity || "-"}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <EquipmentStatusBadge status={equipment.status} />
                        </td>
                        <td className="px-4 py-3 align-top text-slate-700">
                          {equipment.isMoveable ? "Moveable" : "Fixed"}
                        </td>
                        <td className="px-4 py-3 align-top text-xs leading-5 text-slate-600">
                          {equipment.description || "Tidak ada deskripsi alat."}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-sm text-slate-500"
                      >
                        Belum ada alat yang terdaftar untuk ruangan ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DetailCard>
    </section>
  );
}
