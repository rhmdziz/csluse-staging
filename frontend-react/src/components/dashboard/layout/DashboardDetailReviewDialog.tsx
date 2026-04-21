"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui";

import {
  DashboardDetailReviewPanel,
  type ReviewContext,
} from "./DashboardDetailReviewPanel";

function getReviewDialogTitle(context: Exclude<ReviewContext, null>) {
  switch (context.kind) {
    case "booking":
      return "Review Pengajuan Peminjaman Lab";
    case "borrow":
      return "Review Pengajuan Peminjaman Alat";
    case "sample-testing":
      return "Review Pengajuan Pengujian Sampel";
  }
}

type DashboardDetailReviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: ReviewContext;
  onActionComplete?: () => void;
};

export function DashboardDetailReviewDialog({
  open,
  onOpenChange,
  context,
  onActionComplete,
}: DashboardDetailReviewDialogProps) {
  if (!context) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[85vh] overflow-y-auto border-none bg-transparent p-0 shadow-none sm:max-w-2xl"
      >
        <DialogTitle className="sr-only">{getReviewDialogTitle(context)}</DialogTitle>
        <DashboardDetailReviewPanel
          context={context}
          onActionComplete={onActionComplete}
        />
      </DialogContent>
    </Dialog>
  );
}
