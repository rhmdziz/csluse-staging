"use client";

import type { ComponentProps, ReactNode } from "react";

import { AdminDetailHeader } from "@/components/admin/shared";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui";

type AdminDetailDialogShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseReset?: () => void;
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  trigger?: ReactNode;
  contentClassName?: string;
  contentProps?: Omit<ComponentProps<typeof DialogContent>, "children" | "className">;
  dialogProps?: Omit<ComponentProps<typeof Dialog>, "children" | "open" | "onOpenChange">;
  showCloseButton?: boolean;
  backLabel?: string;
};

export default function AdminDetailDialogShell({
  open,
  onOpenChange,
  onCloseReset,
  title,
  description,
  icon,
  children,
  trigger,
  contentClassName,
  contentProps,
  dialogProps,
  showCloseButton = true,
  backLabel = "Tutup",
}: AdminDetailDialogShellProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          onCloseReset?.();
        }
      }}
      {...dialogProps}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        showCloseButton={showCloseButton}
        className={contentClassName}
        {...contentProps}
      >
        <AdminDetailHeader
          title={title}
          description={description}
          icon={icon}
          backLabel={backLabel}
        />

        {children}
      </DialogContent>
    </Dialog>
  );
}
