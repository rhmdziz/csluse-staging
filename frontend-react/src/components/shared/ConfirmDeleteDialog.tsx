"use client";

import type { MouseEvent, ReactNode } from "react";

import { Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui";

type ConfirmDeleteDialogProps = {
  open?: boolean;
  title?: string;
  description?: string;
  isDeleting?: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfirm: () => void;
  trigger?: ReactNode;
  size?: "default" | "sm";
  contentClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pendingLabel?: string;
};

export default function ConfirmDeleteDialog({
  open,
  title = "Hapus item ini?",
  description = "Data yang dihapus tidak bisa dikembalikan.",
  isDeleting = false,
  onOpenChange,
  onConfirm,
  trigger,
  size = "default",
  contentClassName,
  headerClassName,
  footerClassName,
  confirmLabel = "Hapus",
  cancelLabel = "Batal",
  pendingLabel = "Menghapus...",
}: ConfirmDeleteDialogProps) {
  const handleConfirm = (event: MouseEvent<HTMLButtonElement>) => {
    // Keep the dialog open until the caller closes it explicitly after the async action finishes.
    event.preventDefault();
    onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent size={size} className={contentClassName}>
        <AlertDialogHeader className={headerClassName}>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className={footerClassName}>
          <AlertDialogCancel disabled={isDeleting}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDeleting}
            variant="destructive"
            className="gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {pendingLabel}
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
