"use client";

import type { ReactNode, RefObject } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/core";

type AdminInformationTableColumn = {
  key?: string;
  label: ReactNode;
  className?: string;
};

type AdminInformationTableProps = {
  columns: AdminInformationTableColumn[];
  hasRows: boolean;
  isLoading: boolean;
  emptyMessage: string;
  children: ReactNode;
  tableClassName?: string;
  tbodyClassName?: string;
  loadingCellClassName?: string;
  emptyCellClassName?: string;
  selectAll: {
    checked: boolean;
    ariaLabel: string;
    ref: RefObject<HTMLInputElement | null>;
    onChange: (checked: boolean) => void;
  };
};

export default function AdminInformationTable({
  columns,
  hasRows,
  isLoading,
  emptyMessage,
  children,
  tableClassName,
  tbodyClassName,
  loadingCellClassName,
  emptyCellClassName,
  selectAll,
}: AdminInformationTableProps) {
  const colSpan = columns.length + 1;

  return (
    <div className="w-full min-w-0 overflow-x-auto rounded border border-slate-200 bg-card [scrollbar-width:thin]">
      <table className={cn("w-full table-fixed", tableClassName)}>
        <thead className="border-b border-slate-800 bg-slate-900">
          <tr className="text-left text-sm">
            <th className="w-12 px-3 py-3 text-center font-medium text-slate-50">
              <input
                ref={selectAll.ref}
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 align-middle"
                checked={selectAll.checked}
                onChange={(event) => selectAll.onChange(event.target.checked)}
                aria-label={selectAll.ariaLabel}
              />
            </th>
            {columns.map((column, index) => (
              <th
                key={column.key ?? `${String(column.label)}-${index}`}
                className={cn(
                  "px-3 py-3 font-medium whitespace-nowrap text-slate-50",
                  column.className,
                  column.className?.includes("sticky right-0") ? "z-20" : undefined,
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={cn("text-sm", tbodyClassName)}>
          {isLoading ? (
            <tr>
              <td colSpan={colSpan} className={cn("px-3 py-8 text-center", loadingCellClassName)}>
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              </td>
            </tr>
          ) : hasRows ? (
            children
          ) : (
            <tr>
              <td
                colSpan={colSpan}
                className={cn("px-3 py-6 text-center text-muted-foreground", emptyCellClassName)}
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
