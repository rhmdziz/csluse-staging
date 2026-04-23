"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AppWindow,
  Boxes,
  Building2,
  CalendarCheck2,
  ChevronDown,
  Package,
  ShieldUser,
  Sparkles,
  Users,
  Handshake,
  User,
} from "lucide-react";

import { AdminPageHeader } from "@/components/admin/shared";
import { InlineErrorAlert } from "@/components/shared";
import { Skeleton } from "@/components/ui";
import { API_AUTH_ADMIN_DASHBOARD } from "@/constants/api";
import { useAdminActions, type AdminAction } from "@/hooks/admin";
import { useLoadProfile } from "@/hooks/shared/profile";
import { authFetch } from "@/lib/auth";
import {
  formatDateId,
  formatDateTimeIdWithZone,
  formatTimeIdWithZone,
} from "@/lib/date";

type AdminKpis = {
  totalUsers: number;
  totalRooms: number;
  totalEquipments: number;
  totalMaterials: number;
  totalSoftware: number;
  totalBookings: number;
  totalBorrows: number;
  totalSampleTesting: number;
  usersByRole: Record<string, number>;
  bookingsByStatus: Record<string, number>;
  borrowsByStatus: Record<string, number>;
  pengujiansByStatus: Record<string, number>;
};

type AdminKpisResponse = {
  total_users?: number;
  total_rooms?: number;
  total_equipments?: number;
  total_materials?: number;
  total_software?: number;
  total_bookings?: number;
  total_borrows?: number;
  total_pengujians?: number;
  users_by_role?: Record<string, number>;
  bookings_by_status?: Record<string, number>;
  borrows_by_status?: Record<string, number>;
  pengujians_by_status?: Record<string, number>;
};

function formatActionLabel(action: AdminAction["action"]) {
  if (action === "create") return "Create";
  if (action === "update") return "Update";
  if (action === "delete") return "Delete";
  return "Unknown";
}

function getActionBadgeClass(action: AdminAction["action"]) {
  if (action === "create")
    return "border-emerald-200 bg-emerald-100 text-emerald-800";
  if (action === "update") return "border-sky-200 bg-sky-100 text-sky-800";
  if (action === "delete") return "border-rose-200 bg-rose-100 text-rose-800";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function getActionAccentClass(action: AdminAction["action"]) {
  if (action === "create") return "bg-emerald-500";
  if (action === "update") return "bg-sky-500";
  if (action === "delete") return "bg-rose-500";
  return "bg-slate-400";
}

function ActionItem({
  item,
  showDivider,
}: {
  item: AdminAction;
  showDivider: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative min-w-0 overflow-hidden rounded-lg border bg-white p-3">
      <span
        className={`absolute inset-y-0 left-0 w-1 ${getActionAccentClass(item.action)}`}
      />
      <div className="ml-2 min-w-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full min-w-0 flex-col items-start gap-2 text-left sm:flex-row sm:items-start sm:justify-between sm:gap-3"
        >
          <p className="min-w-0 max-w-[80%] flex-1 break-all text-sm font-semibold text-slate-900 sm:max-w-none sm:break-words sm:line-clamp-2">
            {item.object_repr || "-"}
          </p>
          <div className="flex shrink-0 flex-row items-center gap-2 sm:items-end">
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getActionBadgeClass(item.action)}`}
            >
              {formatActionLabel(item.action)}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </div>
        </button>

        {open && (
          <>
            <div className="mt-2 grid gap-1 text-xs text-slate-600">
              <p className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                <span className="flex min-w-0 max-w-[80%] flex-1 items-center gap-1 sm:max-w-none">
                  <ShieldUser className="h-3.5 w-3.5 text-slate-500" />
                  <span className="min-w-0 flex-1 break-all sm:break-words">
                    {item.actor || "-"}
                  </span>
                </span>
                <span className="flex max-w-full flex-wrap items-center gap-1 break-words text-[11px] sm:text-xs">
                  <CalendarCheck2 className="h-3 w-3 text-slate-500" />
                  {formatDateId(item.action_time)} {", "}
                  {formatTimeIdWithZone(item.action_time)}
                </span>
              </p>
            </div>

            {item.change_message ? (
              <p className="mt-2 min-w-0 break-all rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                {item.change_message}
              </p>
            ) : null}
          </>
        )}
      </div>
      {showDivider ? (
        <div className="mt-3 border-b border-dashed border-slate-200" />
      ) : null}
    </div>
  );
}

function ActionList({
  title,
  actions,
}: {
  title: string;
  actions: AdminAction[];
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-linear-to-b from-white to-slate-50 p-3">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {actions.length ? (
        <div className="space-y-2">
          {actions.map((item, index) => (
            <ActionItem
              key={item.id}
              item={item}
              showDivider={index < actions.length - 1}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>
      )}
    </div>
  );
}

export default function Page() {
  const { recentActions, myActions, isLoading, error } = useAdminActions();
  const { profile } = useLoadProfile();
  const [kpis, setKpis] = useState<AdminKpis>({
    totalUsers: 0,
    totalRooms: 0,
    totalEquipments: 0,
    totalMaterials: 0,
    totalSoftware: 0,
    totalBookings: 0,
    totalBorrows: 0,
    totalSampleTesting: 0,
    usersByRole: {},
    bookingsByStatus: {},
    borrowsByStatus: {},
    pengujiansByStatus: {},
  });
  const [isLoadingKpis, setIsLoadingKpis] = useState(true);
  const [kpisError, setKpisError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let isAborted = false;

    const loadKpis = async () => {
      setIsLoadingKpis(true);
      setKpisError("");

      try {
        const response = await authFetch(API_AUTH_ADMIN_DASHBOARD, {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Gagal memuat KPI (${response.status})`);
        }

        const payload = (await response.json()) as AdminKpisResponse;
        setKpis({
          totalUsers: payload.total_users ?? 0,
          totalRooms: payload.total_rooms ?? 0,
          totalEquipments: payload.total_equipments ?? 0,
          totalMaterials: payload.total_materials ?? 0,
          totalSoftware: payload.total_software ?? 0,
          totalBookings: payload.total_bookings ?? 0,
          totalBorrows: payload.total_borrows ?? 0,
          totalSampleTesting: payload.total_pengujians ?? 0,
          usersByRole: payload.users_by_role ?? {},
          bookingsByStatus: payload.bookings_by_status ?? {},
          borrowsByStatus: payload.borrows_by_status ?? {},
          pengujiansByStatus: payload.pengujians_by_status ?? {},
        });
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        )
          return;
        setKpisError(
          loadError instanceof Error ? loadError.message : "Terjadi kesalahan.",
        );
      } finally {
        if (isAborted || controller.signal.aborted) return;
        setIsLoadingKpis(false);
      }
    };

    void loadKpis();

    return () => {
      isAborted = true;
      controller.abort();
    };
  }, []);

  const lastLoginText = profile.last_login
    ? formatDateTimeIdWithZone(profile.last_login)
    : "-";
  const displayName = profile.name || "User";

  if (isLoading) {
    return <HomePageSkeleton />;
  }

  return (
    <section className="space-y-4 px-4">
      <AdminPageHeader
        title={`Selamat datang, ${displayName}!`}
        description={`Last login: ${lastLoginText}`}
        icon={
          <Link
            href="/admin/my-profile"
            aria-label="Buka profil saya"
            className="inline-flex h-full w-full items-center justify-center rounded-full"
          >
            <User className="h-5 w-5 text-sky-200" />
          </Link>
        }
      />

      {kpisError ? <InlineErrorAlert>{kpisError}</InlineErrorAlert> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_3fr]">
        <KpiCard
          label="Pengguna"
          value={isLoadingKpis ? "0" : String(kpis.totalUsers)}
          tone="users"
          roleBreakdown={isLoadingKpis ? undefined : kpis.usersByRole}
          className="h-full"
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 *:h-full">
          <KpiCard
            label="Ruangan"
            value={isLoadingKpis ? "0" : String(kpis.totalRooms)}
            tone="rooms"
          />
          <KpiCard
            label="Peralatan"
            value={isLoadingKpis ? "0" : String(kpis.totalEquipments)}
            tone="equipments"
          />
          <KpiCard
            label="Bahan"
            value={isLoadingKpis ? "0" : String(kpis.totalMaterials)}
            tone="materials"
          />
          <KpiCard
            label="Software"
            value={isLoadingKpis ? "0" : String(kpis.totalSoftware)}
            tone="software"
          />
          <KpiCard
            label="Peminjaman Lab"
            value={isLoadingKpis ? "0" : String(kpis.totalBookings)}
            tone="bookings"
            statusBreakdown={isLoadingKpis ? undefined : kpis.bookingsByStatus}
          />
          <KpiCard
            label="Peminjaman Alat"
            value={isLoadingKpis ? "0" : String(kpis.totalBorrows)}
            tone="borrows"
            statusBreakdown={isLoadingKpis ? undefined : kpis.borrowsByStatus}
          />
          <KpiCard
            label="Pengujian Sampel"
            value={isLoadingKpis ? "0" : String(kpis.totalSampleTesting)}
            tone="sample-testing"
            statusBreakdown={
              isLoadingKpis ? undefined : kpis.pengujiansByStatus
            }
          />
        </div>
      </div>

      {error ? <InlineErrorAlert>{error}</InlineErrorAlert> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ActionList title="My Actions" actions={myActions} />
        <ActionList title="Recent Actions" actions={recentActions} />
      </div>
    </section>
  );
}

function HomePageSkeleton() {
  return (
    <section className="space-y-4 px-4">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#0052C7] via-[#0048B4] to-[#003C99] px-5 py-4">
        <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/10 blur-xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3 w-20 bg-white/20" />
            <Skeleton className="h-8 w-56 bg-white/20" />
            <Skeleton className="mt-3 h-4 w-44 bg-white/20" />
          </div>
          <Skeleton className="h-10 w-10 rounded-full bg-white/20" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        {/* Pengguna skeleton */}
        <div className="relative overflow-hidden rounded-lg border bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-7 rounded-lg" />
          </div>
          <Skeleton className="mt-3 h-8 w-14" />
          <Skeleton className="mt-3 h-2 w-full rounded-full" />
          <div className="mt-2 flex gap-2">
            <Skeleton className="h-2 w-14" />
            <Skeleton className="h-2 w-14" />
            <Skeleton className="h-2 w-10" />
          </div>
        </div>
        {/* Inventaris + Layanan 4×2 */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`kpi-sk-inv-${index}`}
              className="relative overflow-hidden rounded-lg border bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-7 rounded-lg" />
              </div>
              <Skeleton className="mt-3 h-8 w-14" />
            </div>
          ))}
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`kpi-sk-svc-${index}`}
              className="rounded-lg border bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-7 rounded-lg" />
              </div>
              <Skeleton className="mt-3 h-8 w-14" />
              <Skeleton className="mt-3 h-2 w-full rounded-full" />
              <div className="mt-2 flex gap-2">
                <Skeleton className="h-2 w-14" />
                <Skeleton className="h-2 w-10" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ActionListSkeleton />
        <ActionListSkeleton />
      </div>
    </section>
  );
}

function ActionListSkeleton() {
  return (
    <div className="mb-16 rounded-xl border bg-linear-to-b from-white to-slate-50 p-3">
      <Skeleton className="mb-3 h-5 w-28" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`action-skeleton-${index}`}
            className="overflow-hidden rounded-lg border bg-white p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="mt-2 space-y-2">
              <Skeleton className="h-3 w-44" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type KpiTone =
  | "users"
  | "rooms"
  | "equipments"
  | "materials"
  | "software"
  | "bookings"
  | "borrows"
  | "sample-testing";

function getKpiIcon(tone: KpiTone) {
  if (tone === "users") return Users;
  if (tone === "rooms") return Building2;
  if (tone === "equipments") return Package;
  if (tone === "materials") return Boxes;
  if (tone === "software") return AppWindow;
  if (tone === "bookings") return CalendarCheck2;
  if (tone === "borrows") return Handshake;
  return Sparkles;
}

function getKpiIconToneClass(tone: KpiTone) {
  if (tone === "users") return "bg-sky-100 text-sky-700";
  if (tone === "rooms") return "bg-emerald-100 text-emerald-700";
  if (tone === "equipments") return "bg-violet-100 text-violet-700";
  if (tone === "materials") return "bg-orange-100 text-orange-700";
  if (tone === "software") return "bg-fuchsia-100 text-fuchsia-700";
  if (tone === "bookings") return "bg-amber-100 text-amber-700";
  if (tone === "borrows") return "bg-rose-100 text-rose-700";
  return "bg-cyan-100 text-cyan-700";
}

const STATUS_COLOR_MAP: Record<string, string> = {
  Pending: "bg-amber-400",
  Approved: "bg-emerald-500",
  Rejected: "bg-rose-500",
  Expired: "bg-slate-400",
  Completed: "bg-sky-500",
  Borrowed: "bg-blue-500",
  "Returned Pending Inspection": "bg-violet-400",
  Returned: "bg-teal-500",
  Overdue: "bg-orange-500",
  "Lost/Damaged": "bg-red-700",
  Diproses: "bg-cyan-500",
};

const STATUS_LABEL_ID: Record<string, string> = {
  Pending: "Menunggu",
  Approved: "Disetujui",
  Rejected: "Ditolak",
  Expired: "Kedaluwarsa",
  Completed: "Selesai",
  Borrowed: "Dipinjam",
  "Returned Pending Inspection": "Dikembalikan (Cek)",
  Returned: "Dikembalikan",
  Overdue: "Terlambat",
  "Lost/Damaged": "Hilang/Rusak",
  Diproses: "Diproses",
};

function getStatusColor(status: string): string {
  return STATUS_COLOR_MAP[status] ?? "bg-slate-300";
}

function getStatusLabel(status: string): string {
  return STATUS_LABEL_ID[status] ?? status;
}

const ROLE_COLOR_MAP: Record<string, string> = {
  Admin: "bg-violet-600",
  Staff: "bg-sky-600",
  Lecturer: "bg-emerald-500",
  Student: "bg-amber-400",
  Guest: "bg-rose-400",
};

const ROLE_COLOR_CSS: Record<string, string> = {
  Admin: "#7c3aed",
  Staff: "#0284c7",
  Lecturer: "#10b981",
  Student: "#fbbf24",
  Guest: "#fb7185",
};

const ROLE_LABEL_ID: Record<string, string> = {
  Admin: "Admin",
  Staff: "Staff",
  Lecturer: "Dosen",
  Student: "Mahasiswa",
  Guest: "Tamu",
};

function getRoleColor(role: string): string {
  return ROLE_COLOR_MAP[role] ?? "bg-slate-300";
}

function getRoleLabel(role: string): string {
  return ROLE_LABEL_ID[role] ?? role;
}

function RolePieChart({
  entries,
  total,
}: {
  entries: [string, number][];
  total: number;
}) {
  const cx = 50,
    cy = 50,
    oR = 44,
    iR = 30;
  let angle = -Math.PI / 2;

  const slices = entries.map(([role, count]) => {
    const sweep = (count / total) * 2 * Math.PI;
    const end = angle + sweep;
    const isFull = sweep >= 2 * Math.PI - 0.001;
    const large = sweep > Math.PI ? 1 : 0;
    const ox1 = cx + oR * Math.cos(angle),
      oy1 = cy + oR * Math.sin(angle);
    const ox2 = cx + oR * Math.cos(end),
      oy2 = cy + oR * Math.sin(end);
    const ix1 = cx + iR * Math.cos(end),
      iy1 = cy + iR * Math.sin(end);
    const ix2 = cx + iR * Math.cos(angle),
      iy2 = cy + iR * Math.sin(angle);
    const path = `M${ox1} ${oy1} A${oR} ${oR} 0 ${large} 1 ${ox2} ${oy2} L${ix1} ${iy1} A${iR} ${iR} 0 ${large} 0 ${ix2} ${iy2}Z`;
    angle = end;
    return { role, count, path, isFull };
  });

  return (
    <svg viewBox="0 0 100 100" className="h-42 w-42 shrink-0">
      {slices.map(({ role, count, path, isFull }) =>
        isFull ? (
          <g key={role}>
            <circle
              cx={cx}
              cy={cy}
              r={oR}
              fill={ROLE_COLOR_CSS[role] ?? "#94a3b8"}
            />
            <circle cx={cx} cy={cy} r={iR} fill="white" />
          </g>
        ) : (
          <path key={role} d={path} fill={ROLE_COLOR_CSS[role] ?? "#94a3b8"}>
            <title>{`${getRoleLabel(role)}: ${count}`}</title>
          </path>
        ),
      )}
    </svg>
  );
}

function KpiCard({
  label,
  value,
  tone,
  statusBreakdown,
  roleBreakdown,
  className,
}: {
  label: string;
  value: string;
  tone: KpiTone;
  statusBreakdown?: Record<string, number>;
  roleBreakdown?: Record<string, number>;
  className?: string;
}) {
  const Icon = getKpiIcon(tone);
  const [animatedValue, setAnimatedValue] = useState(0);
  const target = Number(value);
  const isNumericValue = Number.isFinite(target);

  useEffect(() => {
    if (!isNumericValue) return;

    const safeTarget = Math.max(0, Math.floor(target));
    if (safeTarget === 0) {
      setAnimatedValue(0);
      return;
    }

    const duration = 800;
    const startTime = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setAnimatedValue(Math.round(safeTarget * eased));
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    setAnimatedValue(0);
    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [isNumericValue, target]);

  const displayValue = isNumericValue
    ? new Intl.NumberFormat("id-ID").format(animatedValue)
    : value;

  if (statusBreakdown !== undefined) {
    const entries = Object.entries(statusBreakdown).filter(([, n]) => n > 0);
    const total = entries.reduce((a, [, n]) => a + n, 0);

    return (
      <div
        className={`relative overflow-hidden rounded-lg border bg-white p-4 ${className ?? ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <span
            className={`inline-flex rounded-lg p-1.5 ${getKpiIconToneClass(tone)}`}
          >
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-3 text-3xl font-bold leading-none text-slate-900">
          {displayValue}
        </p>
        {entries.length > 0 && total > 0 ? (
          <div className="mt-3 space-y-2">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
              {entries.map(([status, count]) => (
                <div
                  key={status}
                  className={`h-full ${getStatusColor(status)}`}
                  style={{ width: `${(count / total) * 100}%` }}
                  title={`${getStatusLabel(status)}: ${count}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {entries.map(([status, count]) => (
                <span
                  key={status}
                  className="flex items-center gap-1 text-[10px] text-slate-600"
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${getStatusColor(status)}`}
                  />
                  {getStatusLabel(status)}{" "}
                  <span className="font-semibold text-slate-800">{count}</span>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-slate-400">
            Belum ada pengajuan.
          </p>
        )}
      </div>
    );
  }

  const roleEntries = roleBreakdown
    ? Object.entries(roleBreakdown).filter(([, n]) => n > 0)
    : [];
  const roleTotal = roleEntries.reduce((a, [, n]) => a + n, 0);

  return (
    <div
      className={`relative overflow-hidden rounded-lg border bg-white p-4 ${className ?? ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <span
          className={`inline-flex rounded-lg p-1.5 ${getKpiIconToneClass(tone)}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold leading-none text-slate-900">
        {displayValue}
      </p>
      {roleEntries.length > 0 && roleTotal > 0 && (
        <div className="mt-3 flex items-center gap-4">
          <RolePieChart entries={roleEntries} total={roleTotal} />
          <div className="flex flex-col gap-1.5">
            {roleEntries.map(([role, count]) => (
              <span
                key={role}
                className="flex items-center gap-1.5 text-xs text-slate-600"
              >
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${getRoleColor(role)}`}
                />
                <span>{getRoleLabel(role)}</span>
                <span className="font-semibold text-slate-900">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
