"use client";

import type { ReactNode } from "react";

type SampleTestingSummaryCardProps = {
  label: string;
  value: number;
  icon: ReactNode;
  tone: "slate" | "blue" | "amber" | "emerald" | "sky" | "rose";
  isActive?: boolean;
  onClick?: () => void;
};

export default function SampleTestingSummaryCard({
  label,
  value,
  icon,
  tone,
  isActive = false,
  onClick,
}: SampleTestingSummaryCardProps) {
  const toneClass =
    tone === "blue"
      ? {
          card: "border-blue-300 bg-blue-100/90",
          activeCard:
            "border-blue-600 bg-blue-600 shadow-[0_14px_28px_rgba(37,99,235,0.32)] ring-2 ring-blue-200/80 ring-offset-2",
          icon: "bg-white/80 text-blue-800",
          activeIcon: "bg-white/20 text-white",
          label: "text-slate-500",
          activeLabel: "text-blue-50",
          value: "text-blue-900",
          activeValue: "text-white",
        }
      : tone === "amber"
        ? {
            card: "border-amber-300 bg-amber-100/90",
            activeCard:
              "border-amber-500 bg-amber-400 shadow-[0_14px_28px_rgba(245,158,11,0.32)] ring-2 ring-amber-200/90 ring-offset-2",
            icon: "bg-white/80 text-amber-800",
            activeIcon: "bg-white/25 text-slate-950",
            label: "text-slate-500",
            activeLabel: "text-amber-950/80",
            value: "text-amber-900",
            activeValue: "text-slate-950",
          }
        : tone === "emerald"
          ? {
              card: "border-emerald-300 bg-emerald-100/90",
              activeCard:
                "border-emerald-600 bg-emerald-600 shadow-[0_14px_28px_rgba(5,150,105,0.32)] ring-2 ring-emerald-200/80 ring-offset-2",
              icon: "bg-white/80 text-emerald-800",
              activeIcon: "bg-white/20 text-white",
              label: "text-slate-500",
              activeLabel: "text-emerald-50",
              value: "text-emerald-900",
              activeValue: "text-white",
            }
          : tone === "sky"
            ? {
                card: "border-sky-300 bg-sky-100/90",
                activeCard:
                  "border-sky-600 bg-sky-600 shadow-[0_14px_28px_rgba(2,132,199,0.3)] ring-2 ring-sky-200/80 ring-offset-2",
                icon: "bg-white/80 text-sky-800",
                activeIcon: "bg-white/20 text-white",
                label: "text-slate-500",
                activeLabel: "text-sky-50",
                value: "text-sky-900",
                activeValue: "text-white",
              }
            : tone === "rose"
              ? {
                  card: "border-rose-300 bg-rose-100/90",
                  activeCard:
                    "border-rose-600 bg-rose-600 shadow-[0_14px_28px_rgba(225,29,72,0.3)] ring-2 ring-rose-200/80 ring-offset-2",
                  icon: "bg-white/80 text-rose-800",
                  activeIcon: "bg-white/20 text-white",
                  label: "text-slate-500",
                  activeLabel: "text-rose-50",
                  value: "text-rose-900",
                  activeValue: "text-white",
                }
              : {
                  card: "border-slate-300 bg-slate-100/90",
                  activeCard:
                    "border-slate-700 bg-slate-700 shadow-[0_14px_28px_rgba(51,65,85,0.28)] ring-2 ring-slate-200/80 ring-offset-2",
                  icon: "bg-white/80 text-slate-800",
                  activeIcon: "bg-white/15 text-white",
                  label: "text-slate-500",
                  activeLabel: "text-slate-100",
                  value: "text-slate-900",
                  activeValue: "text-white",
                };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`w-full cursor-pointer rounded-xl border p-3 text-left shadow-[0_4px_14px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.14)] ${
        isActive ? toneClass.activeCard : toneClass.card
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-h-14 flex-col justify-between">
          <p
            className={`text-xs font-medium uppercase tracking-wide ${
              isActive ? toneClass.activeLabel : toneClass.label
            }`}
          >
            {label}
          </p>
          <p
            className={`text-2xl font-semibold leading-none ${
              isActive ? toneClass.activeValue : toneClass.value
            }`}
          >
            {value}
          </p>
        </div>
        <div
          className={`rounded-lg p-2 ${
            isActive ? toneClass.activeIcon : toneClass.icon
          }`}
        >
          {icon}
        </div>
      </div>
    </button>
  );
}
