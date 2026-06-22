"use client";

import { ChevronDown, Trash2, X } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui";

type DepartmentBulkActionsProps = {
  selectedCount: number;
  isDeleting: boolean;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
};

export default function DepartmentBulkActions({
  selectedCount,
  isDeleting,
  onClearSelection,
  onDeleteSelected,
}: DepartmentBulkActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={selectedCount === 0 || isDeleting}
        >
          Aksi Terpilih
          {selectedCount ? ` (${selectedCount})` : ""}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="w-48">
        <DropdownMenuItem
          variant="destructive"
          disabled={selectedCount === 0 || isDeleting}
          onClick={onDeleteSelected}
        >
          <Trash2 className="h-4 w-4" />
          Hapus Department
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={selectedCount === 0}
          onClick={onClearSelection}
          className="text-xs text-slate-500"
        >
          <X className="h-3.5 w-3.5" />
          Bersihkan pilihan
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
