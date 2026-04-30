"use client";


import type { ReactNode } from "react";

import { Button, DialogFooter } from "@/components/ui";

type AdminDetailActionsProps = {
  isEditing: boolean;
  isSubmitting?: boolean;
  showDeleteAction?: boolean;
  deleteLabel?: string;
  saveLabel?: string;
  savingLabel?: string;
  extraActions?: ReactNode;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete?: () => void;
};

export default function AdminDetailActions({
  isEditing,
  isSubmitting = false,
  showDeleteAction = false,
  deleteLabel = "Hapus",
  saveLabel = "Simpan",
  savingLabel = "Menyimpan...",
  extraActions,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: AdminDetailActionsProps) {
  return (
    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
      {isEditing ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onCancelEdit}
          disabled={isSubmitting}
        >
          Batal
        </Button>
      ) : null}

      <Button
        type="button"
        variant={isEditing ? "default" : "outline"}
        onClick={isEditing ? onSave : onEdit}
        disabled={isSubmitting}
      >
        {isEditing ? (isSubmitting ? savingLabel : saveLabel) : "Edit"}
      </Button>

      {!isEditing ? extraActions : null}

      {!isEditing && showDeleteAction ? (
        <Button
          type="button"
          variant="destructive"
          onClick={onDelete}
          disabled={isSubmitting}
        >
          {deleteLabel}
        </Button>
      ) : null}
    </DialogFooter>
  );
}
