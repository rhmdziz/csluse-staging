"use client";

import type { ReactNode, RefObject } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/core";

type DashboardListTableColumn = {
  key?: string;
  label: ReactNode;
  className?: string;
};

type DashboardListTableProps = {
  columns: DashboardListTableColumn[];
  colSpan: number;
  hasRows: boolean;
  isLoading: boolean;
  hasLoadedOnce: boolean;
  emptyMessage: string;
  children: ReactNode;
  colGroup?: ReactNode;
  containerClassName?: string;
  tableClassName?: string;
  theadClassName?: string;
  tbodyClassName?: string;
  loadingCellClassName?: string;
  emptyCellClassName?: string;
  loadingMessage?: ReactNode;
  selectAll?: {
    checked: boolean;
    disabled?: boolean;
    ariaLabel?: string;
    ref?: RefObject<HTMLInputElement | null>;
    onChange: (checked: boolean) => void;
    headerClassName?: string;
    inputClassName?: string;
  };
};

export function DashboardListTable({
  columns,
  colSpan,
  hasRows,
  isLoading,
  hasLoadedOnce,
  emptyMessage,
  children,
  colGroup,
  containerClassName,
  tableClassName,
  theadClassName,
  tbodyClassName,
  loadingCellClassName,
  emptyCellClassName,
  loadingMessage = "Memuat data...",
  selectAll,
}: DashboardListTableProps) {
  return (
    <div
      className={cn(
        "w-full max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white",
        containerClassName,
      )}
    >
      <table className={cn("w-full", tableClassName)}>
        {colGroup}
        <thead className={cn("border-b border-slate-800 bg-slate-900", theadClassName)}>
          <tr className="text-left text-sm">
            {selectAll ? (
              <th
                className={cn(
                  "w-12 px-3 py-3 text-center font-medium text-slate-50",
                  selectAll.headerClassName,
                )}
              >
                <input
                  ref={selectAll.ref}
                  type="checkbox"
                  aria-label={selectAll.ariaLabel ?? "Pilih semua record pada halaman ini"}
                  className={cn(
                    "h-4 w-4 rounded border-slate-300 align-middle",
                    selectAll.inputClassName,
                  )}
                  checked={selectAll.checked}
                  disabled={selectAll.disabled}
                  onChange={(event) => selectAll.onChange(event.target.checked)}
                />
              </th>
            ) : null}
            {columns.map((column, index) => (
              <th
                key={column.key ?? `${String(column.label)}-${index}`}
                className={cn("px-3 py-3 font-medium whitespace-nowrap text-slate-50", column.className)}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={cn("text-sm", tbodyClassName)}>
          {isLoading || !hasLoadedOnce ? (
            <tr>
              <td
                colSpan={colSpan}
                className={cn("px-3 py-5 text-center text-slate-500", loadingCellClassName)}
              >
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {loadingMessage}
                </div>
              </td>
            </tr>
          ) : hasRows ? (
            children
          ) : (
            <tr>
              <td
                colSpan={colSpan}
                className={cn("px-3 py-5 text-center text-slate-500", emptyCellClassName)}
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
