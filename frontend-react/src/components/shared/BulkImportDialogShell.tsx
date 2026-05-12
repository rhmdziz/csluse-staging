"use client";


import type { ChangeEvent, ReactNode } from "react";

import { FileDown, Upload } from "lucide-react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";

import { cn } from "@/lib/core";

type BulkImportDialogShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReset: () => void;
  title: string;
  description: ReactNode;
  onDownloadTemplate: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  fileName: string;
  error?: ReactNode;
  children?: ReactNode;
  footer: ReactNode;
  contentClassName?: string;
};

const DEFAULT_CONTENT_CLASSNAME =
  "w-[min(720px,calc(100%-2rem))] max-w-none min-w-0 overflow-hidden sm:max-w-none [--primary:#0048B4] [--primary-foreground:#FFFFFF] [--ring:#3B82F6]";

export default function BulkImportDialogShell({
  open,
  onOpenChange,
  onReset,
  title,
  description,
  onDownloadTemplate,
  onFileChange,
  fileName,
  error,
  children,
  footer,
  contentClassName,
}: BulkImportDialogShellProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) onReset();
      }}
    >
      <DialogContent className={cn(DEFAULT_CONTENT_CLASSNAME, contentClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          <p className="text-xs text-muted-foreground">{description}</p>

          <label className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-muted/30 px-4 py-6 text-center transition hover:border-primary/50 hover:bg-muted/50">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={onFileChange}
              className="sr-only"
            />
            <Upload className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">
              {fileName ? "Ganti file" : "Klik untuk memilih file"}
            </p>
            <p className="text-xs text-muted-foreground">
              {fileName
                ? `File terpilih: ${fileName}`
                : "Mendukung .xlsx, .xls, .csv"}
            </p>
          </label>

          {error}
          {children}
          <DialogFooter className="border-t border-slate-200 pt-4 sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={onDownloadTemplate}
            >
              <FileDown className="h-4 w-4" />
              Template
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {footer}
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
