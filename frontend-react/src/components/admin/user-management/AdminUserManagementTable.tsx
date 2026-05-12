"use client";

import type { ReactNode, RefObject } from "react";

import { cn } from "@/lib/core";

type AdminUserManagementTableColumn = {
  key?: string;
  label: ReactNode;
  className?: string;
};

type AdminUserManagementTableProps = {
  columns: AdminUserManagementTableColumn[];
  hasRows: boolean;
  isLoading: boolean;
  hasLoadedOnce: boolean;
  emptyMessage: string;
  children: ReactNode;
  tableClassName?: string;
  tbodyClassName?: string;
  loadingCellClassName?: string;
  emptyCellClassName?: string;
  loadingIndicator?: ReactNode;
  selectAll?: {
    checked: boolean;
    ariaLabel: string;
    ref: RefObject<HTMLInputElement | null>;
    onChange: (checked: boolean) => void;
    headerClassName?: string;
  };
};

export default function AdminUserManagementTable({
  columns,
  hasRows,
  isLoading,
  hasLoadedOnce,
  emptyMessage,
  children,
  tableClassName,
  tbodyClassName,
  loadingCellClassName,
  emptyCellClassName,
  loadingIndicator,
  selectAll,
}: AdminUserManagementTableProps) {
  const colSpan = columns.length + (selectAll ? 1 : 0);

  return (
    <div className="w-full max-w-full overflow-x-auto rounded border border-slate-200 bg-card">
      <table className={cn("w-full table-fixed", tableClassName)}>
        <thead className="border-b border-slate-800 bg-slate-900">
          <tr className="text-left text-sm">
            {selectAll ? (
              <th
                className={cn(
                  "w-[52px] px-3 py-3 text-center align-middle font-medium text-slate-50",
                  selectAll.headerClassName,
                )}
              >
                <input
                  ref={selectAll.ref}
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 align-middle"
                  checked={selectAll.checked}
                  onChange={(event) => selectAll.onChange(event.target.checked)}
                  aria-label={selectAll.ariaLabel}
                />
              </th>
            ) : null}
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
          {isLoading || !hasLoadedOnce ? (
            <tr>
              <td colSpan={colSpan} className={cn("px-3 py-8 text-center", loadingCellClassName)}>
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  {loadingIndicator}
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
