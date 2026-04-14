"use client";

import type { ReactNode } from "react";
import { ClipboardCheck } from "lucide-react";

import { getStatusBadgeClass, getStatusDisplayLabel } from "@/lib/request";

type ReviewMetaItem = {
  label: string;
  value: string;
};

type ReviewChecklistItem = {
  label: string;
  value: string;
};

type ReviewInfoItem = {
  label: string;
  value: string;
  variant?: "default" | "success" | "danger";
};

type RequestReviewCardProps = {
  status: string;
  code: string;
  meta?: ReviewMetaItem[];
  reviewInfoItems?: ReviewInfoItem[];
  checklist?: ReviewChecklistItem[];
  checklistLoading?: boolean;
  checklistEmptyMessage?: string;
  checklistPassedIndicators?: string[];
  showChecklistSection?: boolean;
  statusHintTitle?: string;
  statusHintMessage?: string;
  statusHintIndicators?: string[];
  statusHintClassName?: string;
  statusHintTitleClassName?: string;
  statusHintTextClassName?: string;
  children?: ReactNode;
};

export function RequestReviewCard({
  status,
  code,
  meta = [],
  reviewInfoItems = [],
  checklist = [],
  checklistLoading = false,
  checklistEmptyMessage,
  checklistPassedIndicators = [],
  showChecklistSection = true,
  statusHintTitle,
  statusHintMessage,
  statusHintIndicators = [],
  statusHintClassName = "border-emerald-200 bg-emerald-50/80",
  statusHintTitleClassName = "text-emerald-800",
  statusHintTextClassName = "text-emerald-900",
  children,
}: RequestReviewCardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700">
            <ClipboardCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              Review Pengajuan
            </p>
            <p className="mt-1 text-xs font-medium tracking-wide text-slate-500">
              {code}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(status)}`}
        >
          {getStatusDisplayLabel(status)}
        </span>
      </div>

      {meta.length ? (
        <div className="mt-4 space-y-2">
          {meta.map((item) => (
            <div
              key={`${item.label}-${item.value}`}
              className="grid gap-1 rounded-md border border-slate-200 bg-slate-50/80 px-4 py-3 md:grid-cols-[180px_minmax(0,1fr)] md:items-start md:gap-4"
            >
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className="text-xs leading-5 text-slate-800 break-words">
                {item.value || "-"}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 border-t border-slate-200 pt-4">
        {reviewInfoItems.length ? (
          <div className="mb-4 grid gap-2">
            {reviewInfoItems.map((item) => {
              const containerClass =
                item.variant === "success"
                  ? "border-emerald-200 bg-emerald-50/80"
                  : item.variant === "danger"
                    ? "border-rose-200 bg-rose-50/80"
                    : "border-slate-200 bg-slate-50/80";
              const labelClass =
                item.variant === "success"
                  ? "text-emerald-700"
                  : item.variant === "danger"
                    ? "text-rose-700"
                    : "text-slate-500";
              const valueClass =
                item.variant === "success"
                  ? "text-emerald-900 font-semibold"
                  : item.variant === "danger"
                    ? "text-rose-900 font-semibold"
                    : "text-slate-800 font-medium";
              return (
                <div
                  key={`${item.label}-${item.value}`}
                  className={`grid gap-1 rounded-md border px-4 py-3 md:grid-cols-[180px_minmax(0,1fr)] md:items-center md:gap-4 ${containerClass}`}
                >
                  <p className={`text-xs ${labelClass}`}>{item.label}</p>
                  <p className={`text-xs ${valueClass}`}>{item.value}</p>
                </div>
              );
            })}
          </div>
        ) : null}
        {showChecklistSection ? (
          <>
            {checklistLoading ? (
              <div className="mb-4 rounded-md border border-slate-200 bg-slate-50/80 px-4 py-3">
                <p className="text-xs text-slate-500">
                  Memeriksa catatan review...
                </p>
              </div>
            ) : null}

            {!checklistLoading && checklist.length ? (
              <div className="space-y-3">
                <div className="grid gap-2">
                  {checklist.map((item) => (
                    <div
                      key={`${item.label}-${item.value}`}
                      className="rounded-md border border-amber-200 bg-amber-50/80 px-4 py-3"
                    >
                      <p className="text-xs font-medium text-amber-800">
                        {item.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-amber-900">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {!checklistLoading && !checklist.length && checklistEmptyMessage ? (
              <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50/80 px-4 py-3">
                <p className="text-xs text-emerald-800">
                  {checklistEmptyMessage}
                </p>
                {checklistPassedIndicators.length ? (
                  <div className="mt-2 space-y-1">
                    {checklistPassedIndicators.map((item) => (
                      <p key={item} className="text-xs text-emerald-900">
                        - {item}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        {statusHintMessage ? (
          <div
            className={`mb-4 rounded-md border px-4 py-3 ${statusHintClassName}`}
          >
            {statusHintTitle ? (
              <p className={`text-xs font-medium ${statusHintTitleClassName}`}>
                {statusHintTitle}
              </p>
            ) : null}
            <p
              className={
                statusHintTitle
                  ? `mt-1 text-xs ${statusHintTextClassName}`
                  : `text-xs ${statusHintTitleClassName}`
              }
            >
              {statusHintMessage}
            </p>
            {statusHintIndicators.length ? (
              <div className="mt-2 space-y-1">
                {statusHintIndicators.map((item) => (
                  <p
                    key={item}
                    className={`text-xs ${statusHintTextClassName}`}
                  >
                    - {item}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {children ? (
          <div
            className={
              showChecklistSection &&
              (checklistLoading || checklist.length || checklistEmptyMessage)
                ? "mt-4 flex flex-wrap items-center gap-2"
                : "flex flex-wrap items-center gap-2"
            }
          >
            {children}
          </div>
        ) : null}
      </div>
    </section>
  );
}
