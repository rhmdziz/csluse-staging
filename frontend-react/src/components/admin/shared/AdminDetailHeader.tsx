import type { ReactNode } from "react";

type AdminDetailHeaderProps = {
  title: string;
  icon: ReactNode;
  description?: string;
  meta?: string;
  backLabel?: string;
  onBack?: () => void;
  actions?: ReactNode;
  compact?: boolean;
};

export function AdminDetailHeader({
  title,
  icon,
  description,
  meta,
  backLabel = "Kembali",
  onBack,
  actions,
  compact = false,
}: AdminDetailHeaderProps) {
  return (
    <div
      className={`border-b border-slate-200 sm:px-6 ${compact ? "px-4 py-3.5" : "px-5 py-5"}`}
    >
      <div
        className={`flex flex-col ${compact ? "gap-2.5" : "gap-4"}`}
      >
        <div className={`flex items-start ${compact ? "gap-2.5" : "gap-4"}`}>
          <div
            className={`flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 ${compact ? "h-9 w-9" : "h-10 w-10"}`}
          >
            {icon}
          </div>
          <div className={`min-w-0 ${compact ? "space-y-1" : "space-y-2"}`}>
            <div className="space-y-1">
              <h1
                className={`${compact ? "text-lg" : "text-xl"} font-semibold tracking-tight text-slate-900`}
              >
                {title}
              </h1>
              {description ? (
                <p className={`${compact ? "text-xs" : "text-sm"} text-slate-500`}>
                  {description}
                </p>
              ) : null}
              {meta ? (
                <p className={`${compact ? "text-xs" : "text-sm"} text-slate-500`}>
                  {meta}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
