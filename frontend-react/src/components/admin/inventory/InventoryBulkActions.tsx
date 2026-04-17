"use client";


import { ChevronDown, Download, FileSpreadsheet, Share2, BookOpen, Wrench, Trash2, X } from "lucide-react";

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

type InventoryBulkActionsProps = {
  selectedCount: number;
  isDeleting: boolean;
  isBulkSettingFlag?: boolean;
  isExportingSelectedPdf: boolean;
  isExportingSelectedExcel: boolean;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onExportSelectedPdf: () => void;
  onExportSelectedExcel: () => void;
  onSetShareable?: (value: boolean) => void;
  onSetBorrowable?: (value: boolean) => void;
  onSetUseable?: (value: boolean) => void;
};

export default function InventoryBulkActions({
  selectedCount,
  isDeleting,
  isBulkSettingFlag,
  isExportingSelectedPdf,
  isExportingSelectedExcel,
  onClearSelection,
  onDeleteSelected,
  onExportSelectedPdf,
  onExportSelectedExcel,
  onSetShareable,
  onSetBorrowable,
  onSetUseable,
}: InventoryBulkActionsProps) {
  const isBusy = isDeleting || isBulkSettingFlag;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={selectedCount === 0 || isBusy}
        >
          Aksi Terpilih
          {selectedCount ? ` (${selectedCount})` : ""}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="w-60">
        {onSetShareable && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={selectedCount === 0 || isBulkSettingFlag}>
              <Share2 className="h-4 w-4" />
              Tetapkan Shareable
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              <DropdownMenuItem onClick={() => onSetShareable(true)}>
                Tandai sebagai Shareable
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSetShareable(false)}>
                Hapus Shareable
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {onSetBorrowable && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={selectedCount === 0 || isBulkSettingFlag}>
              <BookOpen className="h-4 w-4" />
              Tetapkan Borrowable
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              <DropdownMenuItem onClick={() => onSetBorrowable(true)}>
                Tandai sebagai Borrowable
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSetBorrowable(false)}>
                Hapus Borrowable
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {onSetUseable && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={selectedCount === 0 || isBulkSettingFlag}>
              <Wrench className="h-4 w-4" />
              Tetapkan Useable
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              <DropdownMenuItem onClick={() => onSetUseable(true)}>
                Tandai sebagai Useable
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSetUseable(false)}>
                Hapus Useable
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {(onSetShareable || onSetBorrowable || onSetUseable) && <DropdownMenuSeparator />}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={selectedCount === 0 || isExportingSelectedPdf || isExportingSelectedExcel}>
            <Download className="h-4 w-4" />
            Export Terpilih
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            <DropdownMenuItem
              disabled={selectedCount === 0 || isExportingSelectedExcel}
              onClick={onExportSelectedExcel}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={selectedCount === 0 || isExportingSelectedPdf}
              onClick={onExportSelectedPdf}
            >
              <Download className="h-4 w-4" />
              Export PDF
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={selectedCount === 0 || isDeleting}
          onClick={onDeleteSelected}
        >
          <Trash2 className="h-4 w-4" />
          Hapus Terpilih
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={selectedCount === 0}
          onClick={onClearSelection}
          className="text-xs text-slate-500"
        >
          <X className="h-3.5 w-3.5" />
          Clear selection
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
