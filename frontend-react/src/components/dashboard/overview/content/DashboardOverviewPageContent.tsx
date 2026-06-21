"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Loader2,
  OctagonX,
  Package,
  X,
} from "lucide-react";

import { useDashboardOverview } from "@/hooks/dashboard";
import { formatDateTimeWib } from "@/lib/date";
import {
  getStatusBadgeClass,
  getStatusDisplayLabel,
  getStatusSummaryTone,
} from "@/lib/request";

type OverviewItem = {
  id: string;
  title: string;
  code: string;
  type: string;
  status: string;
  createdAt: string;
  href: string;
};

type UpcomingApprovedItem = {
  id: string;
  title: string;
  type: string;
  requesterName?: string;
  startTime: string;
  endTime?: string;
  href: string;
};

function SummaryCard({
  label,
  value,
  icon,
  tone = "slate",
  helper,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone?: "slate" | "blue" | "amber" | "emerald" | "sky" | "rose";
  helper: string;
}) {
  const toneClass =
    tone === "blue"
      ? {
          card: "border-blue-300 bg-blue-100/90",
          icon: "bg-white/80 text-blue-800",
          value: "text-blue-900",
        }
      : tone === "amber"
        ? {
            card: "border-amber-300 bg-amber-100/90",
            icon: "bg-white/80 text-amber-800",
            value: "text-amber-900",
          }
        : tone === "emerald"
          ? {
              card: "border-emerald-300 bg-emerald-100/90",
              icon: "bg-white/80 text-emerald-800",
              value: "text-emerald-900",
            }
          : tone === "sky"
            ? {
                card: "border-sky-300 bg-sky-100/90",
                icon: "bg-white/80 text-sky-800",
                value: "text-sky-900",
              }
            : tone === "rose"
              ? {
                  card: "border-rose-300 bg-rose-100/90",
                  icon: "bg-white/80 text-rose-800",
                  value: "text-rose-900",
                }
              : {
                  card: "border-slate-300 bg-slate-100/90",
                  icon: "bg-white/80 text-slate-800",
                  value: "text-slate-900",
                };

  return (
    <div
      className={`rounded-2xl border p-4 shadow-[0_8px_22px_rgba(15,23,42,0.08)] ${toneClass.card}`}
    >
      <div className="flex min-h-[100px] flex-col md:min-h-[172px]">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </p>
          <div className={`rounded-xl p-2.5 ${toneClass.icon}`}>{icon}</div>
        </div>
        <div className="mt-auto pt-3">
          <p
            className={`text-2xl font-semibold leading-none md:text-3xl ${toneClass.value}`}
          >
            {value}
          </p>
          <p className="mt-2 w-full text-[11px] leading-4 text-slate-600 md:mt-3 md:text-xs md:leading-5">
            {helper}
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function RecentActivityItem({ item }: { item: OverviewItem }) {
  return (
    <Link
      href={item.href}
      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">
              {item.title}
            </p>
            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-blue-700">
              {item.code || "-"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{item.type}</p>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${getStatusBadgeClass(item.status, { bordered: true })}`}
        >
          {getStatusDisplayLabel(item.status)}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
        <span className="text-slate-500">
          {formatDateTimeWib(item.createdAt)}
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-[#0048B4]">
          Lihat detail
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

function UpcomingApprovedCard({ item }: { item: UpcomingApprovedItem }) {
  return (
    <Link
      href={item.href}
      className="relative block overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100/60"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(34,197,94,0.10),_transparent_34%)]" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Jadwal Terdekat
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">
              {item.title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{item.type}</p>
            {item.requesterName ? (
              <p className="mt-1 text-xs font-medium text-slate-500">
                Pemohon: {item.requesterName}
              </p>
            ) : null}
          </div>
          <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
            <BellRing className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <MetricPill label="Mulai" value={formatDateTimeWib(item.startTime)} />
          <MetricPill
            label="Selesai"
            value={item.endTime ? formatDateTimeWib(item.endTime) : "-"}
          />
        </div>

        <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#0048B4]">
          Buka detail jadwal
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}

export default function DashboardOverviewPage() {
  const { overview, isLoading, error } = useDashboardOverview();

  const upcomingApproved = useMemo<UpcomingApprovedItem[]>(
    () =>
      overview.upcoming_approved.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        requesterName: item.requester_name ?? "",
        startTime: item.start_time,
        endTime: item.end_time ?? undefined,
        href: item.href,
      })),
    [overview.upcoming_approved],
  );

  const recentActivities = useMemo<OverviewItem[]>(
    () =>
      overview.recent_activities.map((item) => ({
        id: item.id,
        title: item.title,
        code: item.code,
        type: item.type,
        status: item.status,
        createdAt: item.created_at,
        href: item.href,
      })),
    [overview.recent_activities],
  );

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          label="Total Pengajuan"
          value={overview.totals.total_requests}
          icon={<ClipboardList className="h-5 w-5" />}
          tone="blue"
          helper="Seluruh permohonan yang pernah tercatat pada akun ini."
        />
        <SummaryCard
          label={getStatusDisplayLabel("Pending")}
          value={overview.totals.pending}
          icon={<CalendarClock className="h-5 w-5" />}
          tone={getStatusSummaryTone("Pending")}
          helper="Masih menunggu persetujuan atau tindak lanjut reviewer."
        />
        <SummaryCard
          label={getStatusDisplayLabel("Approved")}
          value={overview.totals.approved}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone={getStatusSummaryTone("Approved")}
          helper="Sudah disetujui dan masih berada dalam alur layanan aktif."
        />
        <SummaryCard
          label={getStatusDisplayLabel("Completed")}
          value={overview.totals.completed}
          icon={<Package className="h-5 w-5" />}
          tone={getStatusSummaryTone("Completed")}
          helper="Pengajuan yang proses layanannya sudah selesai sepenuhnya."
        />
        <SummaryCard
          label={getStatusDisplayLabel("Rejected")}
          value={overview.totals.rejected}
          icon={<OctagonX className="h-5 w-5" />}
          tone={getStatusSummaryTone("Rejected")}
          helper="Permohonan yang tidak lolos review atau ditolak oleh PIC."
        />
        <SummaryCard
          label={getStatusDisplayLabel("Expired")}
          value={overview.totals.expired}
          icon={<X className="h-5 w-5" />}
          tone={getStatusSummaryTone("Expired")}
          helper="Pengajuan yang melewati batas proses atau tidak ditindaklanjuti."
        />
      </div>

      {isLoading ? (
        <div className="flex min-h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat ringkasan pengajuan...
          </div>
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!isLoading && !error ? (
        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <div>
            {upcomingApproved.length ? (
              <div className="space-y-3">
                {upcomingApproved.map((item) => (
                  <UpcomingApprovedCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <SectionCard
                title="Jadwal Terdekat"
                description="Jadwal layanan terdekat yang sudah disetujui akan tampil di sini."
              />
            )}
          </div>

          <SectionCard
            title="Aktivitas Pengajuan Terbaru"
            description="Permohonan paling baru yang masih relevan untuk dipantau."
          >
            {recentActivities.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {recentActivities.map((item) => (
                  <RecentActivityItem key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <p className="text-sm text-slate-600">
                  Belum ada aktivitas pengajuan untuk akun ini.
                </p>
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}
    </section>
  );
}
