"use client";


import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";

import { CircleHelp, ImagePlus, Trash2 } from "lucide-react";

import { USER_MODAL_WIDTH_CLASS } from "@/components/admin/user-management";

import { AdminDetailActions, AdminDetailDialogShell, InlineErrorAlert } from "@/components/shared";

import {
  Button,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from "@/components/ui";

export type FaqFormState = {
  question: string;
  answer: string;
  imageId?: string | number | null;
  imageUrl?: string;
  imageFile?: File | null;
  removeImage?: boolean;
};

export type FaqDetailMode = "view" | "edit";

function FaqDetailField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string | ReactNode;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-700">{label}</p>
      <div
        className={`rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 ${
          multiline ? "min-h-36 whitespace-pre-wrap break-words" : ""
        }`}
      >
        {value || "-"}
      </div>
    </div>
  );
}

type FaqFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  readOnlyTitle?: string;
  readOnlyDescription?: string;
  initialMode?: FaqDetailMode;
  onCancelEdit?: () => void;
  onDeleteRequest?: () => void;
  form: FaqFormState;
  onChange: <K extends keyof FaqFormState>(field: K, value: FaqFormState[K]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  error: string;
  trigger?: ReactNode;
  useDetailHeader?: boolean;
  readOnly?: boolean;
};

export default function FaqFormDialog({
  open,
  onOpenChange,
  title,
  description,
  readOnlyTitle,
  readOnlyDescription,
  initialMode = "edit",
  onCancelEdit,
  onDeleteRequest,
  form,
  onChange,
  onSubmit,
  isSubmitting,
  error,
  trigger,
  useDetailHeader = false,
  readOnly = false,
}: FaqFormDialogProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const openedInEditMode = initialMode === "edit";
  const previewUrl = useMemo(() => {
    if (form.imageFile) return URL.createObjectURL(form.imageFile);
    if (form.removeImage) return "";
    return form.imageUrl || "";
  }, [form.imageFile, form.imageUrl, form.removeImage]);

  useEffect(() => {
    if (!open) return;
    setIsEditing(initialMode === "edit" && !readOnly);
  }, [initialMode, open, readOnly]);

  useEffect(() => {
    return () => {
      if (form.imageFile && previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [form.imageFile, previewUrl]);

  const isReadOnly = readOnly || !isEditing;
  const shellTitle = isReadOnly ? (readOnlyTitle ?? title) : title;
  const shellDescription =
    isReadOnly ? (readOnlyDescription ?? description) : description;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    onChange("imageFile", file);
    onChange("removeImage", false);
  };

  return (
    <AdminDetailDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseReset={() => setIsEditing(false)}
      title={shellTitle}
      description={shellDescription}
      icon={<CircleHelp className="h-5 w-5" />}
      trigger={trigger}
      contentClassName={`${USER_MODAL_WIDTH_CLASS} gap-0 p-0 [--primary:#0048B4] [--primary-foreground:#FFFFFF] [--ring:#3B82F6]`}
    >
      {!useDetailHeader ? (
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
        ) : null}

        <form
          ref={formRef}
          className={`space-y-4 ${useDetailHeader ? "px-5 py-4 sm:px-6" : "px-6 pb-6"}`}
          onSubmit={onSubmit}
        >
          {isReadOnly ? (
            <>
              <FaqDetailField label="Pertanyaan" value={form.question} />
              <FaqDetailField label="Jawaban" value={form.answer} multiline />
              <FaqDetailField
                label="Gambar"
                value={
                  previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={form.question || "Gambar FAQ"}
                      className="max-h-64 rounded-md object-contain"
                    />
                  ) : (
                    "-"
                  )
                }
              />
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">
                  Pertanyaan
                </label>
                <Input
                  value={form.question}
                  onChange={(event) => onChange("question", event.target.value)}
                  placeholder="Masukkan pertanyaan yang sering diajukan"
                  className="h-11 border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">
                  Jawaban
                </label>
                <Textarea
                  value={form.answer}
                  onChange={(event) => onChange("answer", event.target.value)}
                  placeholder="Masukkan jawaban FAQ"
                  className="min-h-36 resize-y border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">
                  Gambar
                </label>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm">
                  <span className="truncate text-slate-500">
                    {form.imageFile?.name ||
                      (previewUrl ? "Gambar FAQ terpasang" : "Pilih gambar (opsional)")}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                  <span className="inline-flex items-center gap-1 text-sky-700">
                    <ImagePlus className="h-4 w-4" />
                    Pilih
                  </span>
                </label>

                {previewUrl ? (
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                    <img
                      src={previewUrl}
                      alt={form.question || "Preview gambar FAQ"}
                      className="max-h-64 w-full rounded-lg object-contain"
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => {
                          onChange("imageFile", null);
                          onChange("removeImage", true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Hapus Gambar
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}

          {error ? <InlineErrorAlert>{error}</InlineErrorAlert> : null}

          <AdminDetailActions
            isEditing={!isReadOnly}
            isSubmitting={isSubmitting}
            showDeleteAction={Boolean(onDeleteRequest)}
            onEdit={() => setIsEditing(true)}
            onCancelEdit={() => {
              setIsEditing(false);
              if (openedInEditMode) {
                onOpenChange(false);
                return;
              }
              if (onCancelEdit) {
                onCancelEdit();
                return;
              }
              onOpenChange(false);
            }}
            onSave={() => {
              formRef.current?.requestSubmit();
            }}
            onDelete={onDeleteRequest}
          />
        </form>
    </AdminDetailDialogShell>
  );
}
