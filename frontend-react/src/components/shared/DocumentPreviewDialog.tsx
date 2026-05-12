"use client";

import { Download, FileText, ImageIcon } from "lucide-react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import {
  downloadDocumentFile,
  isImageDocumentFile,
  isPdfDocumentFile,
} from "@/lib/core";

type PreviewDocument = {
  id: string;
  documentType: string;
  documentLabel: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
  updatedAt: string;
};

export default function DocumentPreviewDialog({
  open,
  onOpenChange,
  document,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: PreviewDocument | null;
}) {
  const canRenderImage = document ? isImageDocumentFile(document) : false;
  const canRenderPdf = document ? isPdfDocumentFile(document) : false;

  const handleDownload = () => {
    if (!document) return;
    downloadDocumentFile(document);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[96vh] w-[calc(100vw-1rem)] !max-w-[1200px] flex-col overflow-hidden border-slate-200 p-0 shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:w-[96vw]"
      >
        <DialogHeader className="border-b border-slate-200 px-4 py-4 text-left sm:px-6 sm:py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700">
              {canRenderImage ? (
                <ImageIcon className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm font-semibold text-slate-900 sm:truncate">
                {document?.documentLabel ?? "Preview Dokumen"}
              </DialogTitle>
              <DialogDescription className="mt-1 break-words text-sm leading-5 text-slate-500">
                {document?.originalName ?? "Dokumen tidak tersedia."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3 sm:p-6">
          {document ? (
            canRenderImage ? (
              <div className="flex min-h-full items-center justify-center">
                <img
                  src={document.url}
                  alt={document.originalName}
                  className="max-h-[60vh] w-auto max-w-full rounded-md border border-slate-200 bg-white object-contain shadow-sm sm:max-h-[70vh]"
                />
              </div>
            ) : canRenderPdf ? (
              <iframe
                title={document.originalName}
                src={document.url}
                className="h-[65vh] w-full rounded-md border border-slate-200 bg-white sm:h-[70vh]"
              />
            ) : (
              <div className="flex min-h-[32vh] items-center justify-center sm:h-[40vh]">
                <div className="max-w-md rounded-lg border border-slate-200 bg-white px-4 py-4 text-center text-sm text-slate-600 shadow-sm sm:px-5">
                  Format dokumen ini belum bisa dipreview di dalam modal.
                  Gunakan tombol download untuk melihat file.
                </div>
              </div>
            )
          ) : (
            <div className="flex min-h-[32vh] items-center justify-center sm:h-[40vh]">
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600 shadow-sm sm:px-5">
                Dokumen tidak tersedia.
              </div>
            </div>
          )}
        </div>
        {document ? (
          <div className="border-t border-slate-200 px-4 py-4 sm:px-6">
            <DialogFooter>
              <Button
                type="button"
                className="border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
