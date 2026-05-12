"use client";

import type { ComponentProps, ReactNode, RefObject } from "react";
import { ArrowUpRight, ChevronDown, Download, FileSpreadsheet, Loader2, SlidersHorizontal, Trash2, X } from "lucide-react";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui";
import { getStatusBadgeClass, getStatusDisplayLabel } from "@/lib/request";

type ApprovalTableColumn = {
  label: string;
  className?: string;
};

type ApprovalTableProps = {
  columns: ApprovalTableColumn[];
  colSpan: number;
  hasRows: boolean;
  isLoading: boolean;
  hasLoadedOnce: boolean;
  emptyMessage: string;
  allVisibleSelected: boolean;
  onToggleSelectAll: (checked: boolean) => void;
  selectAllRef?: RefObject<HTMLInputElement | null>;
  selectAllAriaLabel?: string;
  selectAllDisabled?: boolean;
  children: ReactNode;
};

export function LabClearanceApprovalTable({
  columns,
  colSpan,
  hasRows,
  isLoading,
  hasLoadedOnce,
  emptyMessage,
  allVisibleSelected,
  onToggleSelectAll,
  selectAllRef,
  selectAllAriaLabel = "Pilih semua record pada halaman ini",
  selectAllDisabled = false,
  children,
}: ApprovalTableProps) {
  return (
    <div className="w-full min-w-0 overflow-x-auto rounded border border-slate-200 bg-card [scrollbar-width:thin]">
      <table className="min-w-max w-full table-auto">
        <thead className="border-b border-slate-800 bg-slate-900">
          <tr className="text-left text-sm">
            <th className="w-12 px-3 py-3 text-center font-medium text-slate-50">
              <input
                ref={selectAllRef}
                type="checkbox"
                aria-label={selectAllAriaLabel}
                className="h-4 w-4 rounded border-slate-300 align-middle"
                checked={allVisibleSelected}
                disabled={selectAllDisabled}
                onChange={(event) => onToggleSelectAll(event.target.checked)}
              />
            </th>
            {columns.map((column) => (
              <th
                key={column.label}
                className={column.className ?? "whitespace-nowrap px-3 py-3 font-medium text-slate-50"}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-sm">
          {isLoading || !hasLoadedOnce ? (
            <tr>
              <td colSpan={colSpan} className="px-3 py-8 text-center">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              </td>
            </tr>
          ) : hasRows ? (
            children
          ) : (
            <tr>
              <td colSpan={colSpan} className="px-3 py-6 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

type ApprovalBulkActionsProps = {
  selectedCount: number;
  isDeleting: boolean;
  isExportingSelectedExcel?: boolean;
  isExportingSelectedPdf?: boolean;
  onExportSelectedExcel?: () => void;
  onExportSelectedPdf?: () => void;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
  showExportActions?: boolean;
};

export function LabClearanceApprovalBulkActions({
  selectedCount,
  isDeleting,
  isExportingSelectedExcel = false,
  isExportingSelectedPdf = false,
  onExportSelectedExcel = () => {},
  onExportSelectedPdf = () => {},
  onDeleteSelected,
  onClearSelection,
  showExportActions = true,
}: ApprovalBulkActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="disabled:border-slate-200 disabled:text-slate-400"
          disabled={selectedCount === 0 || isDeleting}
        >
          Aksi Terpilih
          {selectedCount ? ` (${selectedCount})` : ""}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" sideOffset={6} className="min-w-38">
        {showExportActions ? (
          <>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                <Download className="h-4 w-4" />
                Export Terpilih
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-44">
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={isExportingSelectedExcel}
                  onSelect={onExportSelectedExcel}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Export Excel
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={isExportingSelectedPdf}
                  onSelect={onExportSelectedPdf}
                >
                  <Download className="h-4 w-4" />
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem
          className="cursor-pointer text-rose-600 focus:text-rose-700"
          onSelect={onDeleteSelected}
        >
          <Trash2 className="h-4 w-4" />
          Hapus Terpilih
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-xs text-slate-500"
          disabled={selectedCount === 0}
          onSelect={onClearSelection}
        >
          <X className="h-3.5 w-3.5" />
          Clear selection
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type ApprovalFilterCardProps = {
  open: boolean;
  onToggle: () => void;
  onReset: () => void;
  children: ReactNode;
};

export function LabClearanceApprovalFilterCard({
  open,
  onToggle,
  onReset,
  children,
}: ApprovalFilterCardProps) {
  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg border border-slate-400/60 bg-gradient-to-br from-slate-50 to-slate-100/75 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3 px-4 py-1 transition-[padding] duration-250 ease-out">
        <button
          type="button"
          className="-ml-2 -my-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left hover:cursor-pointer"
          onClick={onToggle}
          aria-expanded={open}
          aria-label="Toggle filter"
        >
          <div className="rounded-md bg-white p-1 text-slate-600 shadow-xs transition-all duration-250 ease-out">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <p className="text-sm font-semibold text-slate-800">Filter</p>
        </button>
      </div>

      <div
        className={`grid transition-all duration-300 ease-out ${
          open
            ? "grid-rows-[1fr] border-t border-slate-200/70"
            : "grid-rows-[0fr] border-t border-transparent"
        }`}
        aria-hidden={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={`bg-white px-4 transition-all duration-300 ease-out ${
              open
                ? "translate-y-0 pb-4.5 pt-3.5 opacity-100"
                : "-translate-y-1 pb-0 pt-0 opacity-0"
            }`}
          >
            {children}
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 border-slate-200 bg-white px-4 text-xs text-slate-700 hover:bg-slate-50"
                onClick={onToggle}
                tabIndex={open ? 0 : -1}
              >
                Tutup
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-2 border-slate-200 bg-white px-4 text-xs text-slate-700 hover:bg-slate-50"
                onClick={onReset}
                tabIndex={open ? 0 : -1}
              >
                <X className="h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type ApprovalDetailDialogShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseReset?: () => void;
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  trigger?: ReactNode;
  contentClassName?: string;
  contentProps?: Omit<ComponentProps<typeof DialogContent>, "children" | "className">;
  dialogProps?: Omit<ComponentProps<typeof Dialog>, "children" | "open" | "onOpenChange">;
  showCloseButton?: boolean;
  backLabel?: string;
};

export function LabClearanceApprovalDetailDialogShell({
  open,
  onOpenChange,
  onCloseReset,
  title,
  description,
  icon,
  children,
  trigger,
  contentClassName,
  contentProps,
  dialogProps,
  showCloseButton = true,
  backLabel = "Tutup",
}: ApprovalDetailDialogShellProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) onCloseReset?.();
      }}
      {...dialogProps}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent showCloseButton={showCloseButton} className={contentClassName} {...contentProps}>
        <LabClearanceApprovalDetailHeader
          title={title}
          description={description}
          icon={icon}
        />
        {children}
      </DialogContent>
    </Dialog>
  );
}

type ApprovalDetailHeaderProps = {
  title: string;
  icon: ReactNode;
  description?: string;
  meta?: string;
  actions?: ReactNode;
  compact?: boolean;
};

export function LabClearanceApprovalDetailHeader({
  title,
  icon,
  description,
  meta,
  actions,
  compact = false,
}: ApprovalDetailHeaderProps) {
  return (
    <div className={`border-b border-slate-200 sm:px-6 ${compact ? "px-4 py-3.5" : "px-5 py-5"}`}>
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
              <h1 className={`${compact ? "text-lg" : "text-xl"} font-semibold tracking-tight text-slate-900`}>
                {title}
              </h1>
              {description ? (
                <p className={`${compact ? "text-xs" : "text-sm"} text-slate-500`}>{description}</p>
              ) : null}
              {meta ? <p className={`${compact ? "text-xs" : "text-sm"} text-slate-500`}>{meta}</p> : null}
            </div>
          </div>
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

type RecordDetailItemProps = {
  label: string;
  value: string;
  hrefLabel?: string;
  hrefIcon?: boolean;
  onClick?: () => void;
  status?: boolean;
  compact?: boolean;
  borderless?: boolean;
};

export function LabClearanceRecordDetailItem({
  label,
  value,
  hrefLabel,
  hrefIcon = false,
  onClick,
  status,
  compact = false,
  borderless = false,
}: RecordDetailItemProps) {
  const displayValue = value?.trim() ? value : "-";

  return (
    <div className={borderless ? "space-y-1" : compact ? "space-y-1" : "space-y-1.5"}>
      <p className="text-xs font-medium text-slate-700">{label}</p>
      {status ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <span
            className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(displayValue)}`}
          >
            {getStatusDisplayLabel(displayValue)}
          </span>
        </div>
      ) : onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-sky-700 transition hover:text-sky-800"
        >
          {displayValue}
          {hrefIcon ? (
            <ArrowUpRight className="ml-2 inline h-3.5 w-3.5 align-text-top text-sky-500" />
          ) : hrefLabel ? (
            <span className="ml-2 text-xs font-medium text-sky-500">{hrefLabel}</span>
          ) : null}
        </button>
      ) : (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
          {displayValue}
        </div>
      )}
    </div>
  );
}

function hasDisplayValue(value?: string | null) {
  if (!value) return false;
  const normalized = value.trim();
  return normalized !== "" && normalized !== "-";
}

export function LabClearanceSectionCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
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

export function LabClearanceMetaItem({
  label,
  value,
  valueNode,
}: {
  label: string;
  value?: string | null;
  valueNode?: ReactNode;
}) {
  const displayValue = hasDisplayValue(value) ? String(value).trim() : "-";

  return (
    <div className="grid gap-1 rounded-md border border-slate-200 bg-slate-50/80 px-4 py-3 md:grid-cols-[124px_minmax(0,1fr)] md:items-start md:gap-4">
      <p className="text-xs text-slate-500">{label}</p>
      {valueNode ? (
        <div className="text-xs leading-5 text-slate-800">{valueNode}</div>
      ) : (
        <p
          className={`text-xs leading-5 break-words ${displayValue === "-" ? "italic text-slate-400" : "text-slate-800"}`}
        >
          {displayValue}
        </p>
      )}
    </div>
  );
}
