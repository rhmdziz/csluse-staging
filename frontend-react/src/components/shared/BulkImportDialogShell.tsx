"use client";


import type { ChangeEvent, ReactNode } from "react";

import { FileDown, Loader2, Upload } from "lucide-react";

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
  topContent?: ReactNode;
  onDownloadTemplate: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  fileName: string;
  error?: ReactNode;
  children?: ReactNode;
  footer: ReactNode;
  contentClassName?: string;
  isProcessing?: boolean;
  processingLabel?: ReactNode;
  onStopProcessing?: () => void;
};

const DEFAULT_CONTENT_CLASSNAME =
  "flex max-h-[calc(100vh-1rem)] w-[min(720px,calc(100%-2rem))] max-w-none min-w-0 flex-col overflow-hidden sm:max-h-[90vh] sm:max-w-none [--primary:#0048B4] [--primary-foreground:#FFFFFF] [--ring:#3B82F6]";

export default function BulkImportDialogShell({
  open,
  onOpenChange,
  onReset,
  title,
  description,
  topContent,
  onDownloadTemplate,
  onFileChange,
  fileName,
  error,
  children,
  footer,
  contentClassName,
  isProcessing = false,
  processingLabel,
  onStopProcessing,
}: BulkImportDialogShellProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isProcessing) {
          onStopProcessing?.();
        }
        onOpenChange(nextOpen);
        if (!nextOpen) onReset();
      }}
    >
      <DialogContent className={cn(DEFAULT_CONTENT_CLASSNAME, contentClassName)}>
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <p className="text-xs text-muted-foreground">{description}</p>
          {topContent}

          <label className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-muted/30 px-4 py-6 text-center transition hover:border-primary/50 hover:bg-muted/50">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={onFileChange}
              className="sr-only"
              disabled={isProcessing}
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
        </div>
        {isProcessing ? (
          <div className="shrink-0 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-sky-700" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-sky-900">
                    {processingLabel || "Sedang memproses data bulk."}
                  </p>
                  <p className="text-xs text-sky-800">
                    Proses tetap berjalan sampai selesai atau dihentikan.
                  </p>
                </div>
              </div>
              {onStopProcessing ? (
                <Button type="button" variant="outline" size="sm" onClick={onStopProcessing}>
                  Berhenti
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        <DialogFooter className="shrink-0 border-t border-slate-200 pt-4 sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={onDownloadTemplate}
            disabled={isProcessing}
          >
            <FileDown className="h-4 w-4" />
            Template
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {footer}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
