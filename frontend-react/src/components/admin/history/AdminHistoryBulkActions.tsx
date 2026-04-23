"use client";


import { ChevronDown, Download, FileSpreadsheet, Trash2, X } from "lucide-react";

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

type AdminHistoryBulkActionsProps = {
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

export default function AdminHistoryBulkActions({
  selectedCount,
  isDeleting,
  isExportingSelectedExcel = false,
  isExportingSelectedPdf = false,
  onExportSelectedExcel = () => {},
  onExportSelectedPdf = () => {},
  onDeleteSelected,
  onClearSelection,
  showExportActions = true,
}: AdminHistoryBulkActionsProps) {
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
      <DropdownMenuContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="min-w-38"
      >
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
