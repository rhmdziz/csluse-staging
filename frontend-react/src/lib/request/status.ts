type StatusClassOptions = {
  bordered?: boolean;
};

export type StatusSummaryTone =
  | "slate"
  | "blue"
  | "amber"
  | "emerald"
  | "sky"
  | "rose";

export type StatusOption = {
  value: string;
  label: string;
};

export type ReviewActionKind =
  | "booking"
  | "sample-testing"
  | "borrow";

export const REQUEST_STATUS_OPTIONS: StatusOption[] = [
  { value: "", label: "Semua Status" },
  { value: "active", label: "Aktif" },
  { value: "pending", label: "Menunggu" },
  { value: "approved", label: "Disetujui" },
  { value: "canceled", label: "Dibatalkan" },
  { value: "rejected", label: "Ditolak" },
  { value: "expired", label: "Kedaluwarsa" },
  { value: "completed", label: "Selesai" },
];

export const BORROW_STATUS_OPTIONS: StatusOption[] = [
  { value: "", label: "Semua Status" },
  { value: "active", label: "Aktif" },
  { value: "pending", label: "Menunggu" },
  { value: "approved", label: "Disetujui" },
  { value: "canceled", label: "Dibatalkan" },
  { value: "rejected", label: "Ditolak" },
  { value: "expired", label: "Kedaluwarsa" },
  { value: "borrowed", label: "Dipinjam" },
  { value: "returned_pending_inspection", label: "Dikembalikan Menunggu Inspeksi" },
  { value: "returned", label: "Dikembalikan" },
  { value: "overdue", label: "Terlambat" },
  { value: "lost_damaged", label: "Hilang/Rusak" },
];

export const SAMPLE_TESTING_STATUS_OPTIONS: StatusOption[] = [
  { value: "", label: "Semua Status" },
  { value: "active", label: "Aktif" },
  { value: "pending", label: "Menunggu" },
  { value: "approved", label: "Disetujui" },
  { value: "canceled", label: "Dibatalkan" },
  { value: "diproses", label: "Diproses" },
  { value: "rejected", label: "Ditolak" },
  { value: "completed", label: "Selesai" },
];

export function normalizeStatus(status?: string | null) {
  return String(status ?? "").trim().toLowerCase();
}

export function getStatusBadgeClass(
  status?: string | null,
  options: StatusClassOptions = {},
) {
  const normalized = normalizeStatus(status);
  const bordered = options.bordered ?? false;

  if (normalized === "approved") {
    return bordered
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "bg-emerald-100 text-emerald-700";
  }
  if (normalized === "canceled" || normalized === "cancelled") {
    return bordered
      ? "border-slate-200 bg-slate-50 text-slate-700"
      : "bg-slate-200 text-slate-700";
  }
  if (normalized === "diproses") {
    return bordered
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "bg-blue-100 text-blue-700";
  }
  if (normalized === "pending") {
    return bordered
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "bg-amber-100 text-amber-700";
  }
  if (normalized === "completed" || normalized === "returned") {
    return bordered
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : "bg-sky-100 text-sky-700";
  }
  if (normalized === "borrowed") {
    return bordered
      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
      : "bg-indigo-100 text-indigo-700";
  }
  if (normalized === "returned pending inspection" || normalized === "returned_pending_inspection") {
    return bordered
      ? "border-cyan-200 bg-cyan-50 text-cyan-700"
      : "bg-cyan-100 text-cyan-700";
  }
  if (normalized === "overdue") {
    return bordered
      ? "border-orange-200 bg-orange-50 text-orange-700"
      : "bg-orange-100 text-orange-700";
  }
  if (normalized === "expired") {
    return bordered
      ? "border-zinc-200 bg-zinc-50 text-zinc-700"
      : "bg-zinc-200 text-zinc-700";
  }
  if (normalized === "lost_damaged" || normalized === "lost/damaged") {
    return bordered
      ? "border-red-200 bg-red-50 text-red-700"
      : "bg-red-100 text-red-700";
  }
  if (normalized === "rejected") {
    return bordered
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "bg-rose-100 text-rose-700";
  }

  return bordered
    ? "border-slate-200 bg-slate-50 text-slate-700"
    : "bg-slate-100 text-slate-600";
}

export function getStatusSummaryTone(status?: string | null): StatusSummaryTone {
  const normalized = normalizeStatus(status);

  if (normalized === "approved" || normalized === "disetujui") return "emerald";
  if (normalized === "diproses") return "blue";
  if (normalized === "pending" || normalized === "menunggu") return "amber";
  if (
    normalized === "canceled" ||
    normalized === "cancelled" ||
    normalized === "dibatalkan"
  ) {
    return "slate";
  }
  if (
    normalized === "returned pending inspection" ||
    normalized === "returned_pending_inspection" ||
    normalized === "dikembalikan menunggu inspeksi"
  ) {
    return "blue";
  }
  if (
    normalized === "completed" ||
    normalized === "returned" ||
    normalized === "selesai" ||
    normalized === "dikembalikan"
  ) {
    return "sky";
  }
  if (
    normalized === "rejected" ||
    normalized === "lost_damaged" ||
    normalized === "lost/damaged" ||
    normalized === "ditolak" ||
    normalized === "hilang/rusak"
  ) {
    return "rose";
  }
  if (
    normalized === "expired" ||
    normalized === "overdue" ||
    normalized === "kedaluwarsa" ||
    normalized === "terlambat"
  ) {
    return "slate";
  }

  return "blue";
}

export function getStatusDisplayLabel(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (normalized === "pending") return "Menunggu";
  if (normalized === "approved") return "Disetujui";
  if (normalized === "canceled" || normalized === "cancelled") return "Dibatalkan";
  if (normalized === "diproses") return "Diproses";
  if (normalized === "completed") return "Selesai";
  if (normalized === "rejected") return "Ditolak";
  if (normalized === "expired") return "Kedaluwarsa";
  if (normalized === "borrowed") return "Dipinjam";
  if (normalized === "returned pending inspection" || normalized === "returned_pending_inspection") {
    return "Dikembalikan Menunggu Inspeksi";
  }
  if (normalized === "returned") return "Dikembalikan";
  if (normalized === "overdue") return "Terlambat";
  if (normalized === "lost_damaged" || normalized === "lost/damaged") {
    return "Hilang/Rusak";
  }

  return String(status ?? "").trim() || "-";
}

export function getRequestStatusDisplayLabel(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (normalized === "active") return "Aktif";
  if (normalized === "pending") return "Menunggu";
  if (normalized === "approved") return "Disetujui";
  if (normalized === "canceled" || normalized === "cancelled") return "Dibatalkan";
  if (normalized === "completed") return "Selesai";
  if (normalized === "rejected") return "Ditolak";
  if (normalized === "expired") return "Kedaluwarsa";

  return getStatusDisplayLabel(status);
}

export function getBorrowStatusDisplayLabel(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (normalized === "active") return "Aktif";
  if (normalized === "pending") return "Menunggu";
  if (normalized === "approved") return "Disetujui";
  if (normalized === "canceled" || normalized === "cancelled") return "Dibatalkan";
  if (normalized === "rejected") return "Ditolak";
  if (normalized === "expired") return "Kedaluwarsa";
  if (normalized === "borrowed") return "Dipinjam";
  if (
    normalized === "returned pending inspection" ||
    normalized === "returned_pending_inspection"
  ) {
    return "Dikembalikan Menunggu Inspeksi";
  }
  if (normalized === "returned") return "Dikembalikan";
  if (normalized === "overdue") return "Terlambat";
  if (normalized === "lost_damaged" || normalized === "lost/damaged") {
    return "Hilang/Rusak";
  }

  return getStatusDisplayLabel(status);
}

export function getSampleTestingStatusDisplayLabel(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (normalized === "active") return "Aktif";
  if (normalized === "pending") return "Menunggu";
  if (normalized === "approved") return "Disetujui";
  if (normalized === "canceled" || normalized === "cancelled") return "Dibatalkan";
  if (normalized === "diproses") return "Diproses";
  if (normalized === "completed") return "Selesai";
  if (normalized === "rejected") return "Ditolak";

  return getStatusDisplayLabel(status);
}

export function shouldShowReviewAction(
  kind: ReviewActionKind,
  status?: string | null,
) {
  const normalized = normalizeStatus(status);

  if (kind === "borrow") {
    return !["completed", "canceled", "cancelled", "rejected", "expired", "returned"].includes(
      normalized,
    );
  }

  return !["completed", "canceled", "cancelled", "rejected", "expired"].includes(normalized);
}
