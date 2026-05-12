"use client";

import type { ReactNode } from "react";

import { AdminRoomBookingHistoryDetailContent } from "@/components/admin/history/content";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import type { BookingRow } from "@/hooks/booking-rooms";

type AdminRoomBookingHistoryDetailDialogProps = {
  open: boolean;
  booking: BookingRow | null;
  isLoading: boolean;
  error: string;
  onOpenChange: (open: boolean) => void;
  onOpenRoomDetail?: (roomId: string | number) => void;
  onOpenUserDetail?: (userId: string | number) => void;
  actions?: ReactNode;
  backLabel?: string;
  showAside?: boolean;
};

export default function AdminRoomBookingHistoryDetailDialog({
  open,
  booking,
  isLoading,
  error,
  onOpenChange,
  onOpenRoomDetail,
  onOpenUserDetail,
  actions,
  backLabel = "Tutup",
  showAside = false,
}: AdminRoomBookingHistoryDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:w-[50vw] sm:max-w-[960px] sm:min-w-[720px] sm:max-w-none">
        <DialogHeader className="sr-only">
          <DialogTitle>Detail Peminjaman Lab</DialogTitle>
          <DialogDescription>
            Detail peminjaman lab ditampilkan dalam modal.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[85vh] overflow-y-auto px-1 pt-1 pb-4">
          <AdminRoomBookingHistoryDetailContent
            booking={booking}
            isLoading={isLoading}
            error={error}
            showAside={showAside}
            backLabel={backLabel}
            onBack={() => onOpenChange(false)}
            onOpenRoomDetail={onOpenRoomDetail}
            onOpenUserDetail={onOpenUserDetail}
            actions={actions}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
