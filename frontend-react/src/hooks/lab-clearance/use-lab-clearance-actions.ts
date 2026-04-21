"use client";

import { useState } from "react";

import {
  extractApiErrorMessage,
  extractApiErrorMessageFromText,
} from "@/lib/core";
import { labClearanceService, type LabClearanceDocumentType } from "@/services/lab-clearance";

export function useSubmitLabClearance() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const submit = async (files: Partial<Record<LabClearanceDocumentType, File>>) => {
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const result = await labClearanceService.submit(files);
      if (result.ok) return { ok: true as const };
      const message = extractApiErrorMessage(
        result.data,
        "Gagal mengajukan permohonan.",
        ["documents"],
      );
      setErrorMessage(message);
      return { ok: false as const, message };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan jaringan.";
      setErrorMessage(message);
      return { ok: false as const, message };
    } finally {
      setIsSubmitting(false);
    }
  };

  return { submit, isSubmitting, errorMessage, setErrorMessage };
}

export function useLabClearanceReview() {
  const [pendingId, setPendingId] = useState<string | null>(null);

  const approve = async (id: string) => {
    setPendingId(id);
    try {
      const result = await labClearanceService.approve(id);
      return result;
    } finally {
      setPendingId(null);
    }
  };

  const reject = async (id: string, note: string) => {
    setPendingId(id);
    try {
      const result = await labClearanceService.reject(id, note);
      return result;
    } finally {
      setPendingId(null);
    }
  };

  return { approve, reject, pendingId };
}

export function useUpdateLabClearanceDocuments() {
  const [pendingDocumentType, setPendingDocumentType] = useState<LabClearanceDocumentType | null>(null);

  const updateDocuments = async (
    id: string,
    documentType: LabClearanceDocumentType,
    file: File,
  ) => {
    setPendingDocumentType(documentType);

    try {
      const result = await labClearanceService.updateDocuments(id, { [documentType]: file });
      if (!result.ok) {
        let message = "Gagal mengganti dokumen surat bebas laboratorium.";

        if (typeof result.data !== "undefined") {
          message = extractApiErrorMessage(result.data, message);
        } else if (result.text) {
          message = extractApiErrorMessageFromText(result.text, message);
        }

        return { ok: false as const, message };
      }

      return { ok: true as const, data: result.data };
    } catch (error) {
      return {
        ok: false as const,
        message:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat mengganti dokumen.",
      };
    } finally {
      setPendingDocumentType(null);
    }
  };

  return { updateDocuments, pendingDocumentType };
}

export function useDeleteLabClearanceDocument() {
  const [pendingDocumentType, setPendingDocumentType] = useState<LabClearanceDocumentType | null>(null);

  const deleteDocument = async (id: string, documentType: LabClearanceDocumentType) => {
    setPendingDocumentType(documentType);

    try {
      const result = await labClearanceService.deleteDocument(id, documentType);
      if (!result.ok) {
        let message = "Gagal menghapus dokumen surat bebas laboratorium.";

        if (typeof result.data !== "undefined") {
          message = extractApiErrorMessage(result.data, message);
        } else if (result.text) {
          message = extractApiErrorMessageFromText(result.text, message);
        }

        return { ok: false as const, message };
      }

      return { ok: true as const, data: result.data };
    } catch (error) {
      return {
        ok: false as const,
        message:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat menghapus dokumen.",
      };
    } finally {
      setPendingDocumentType(null);
    }
  };

  return { deleteDocument, pendingDocumentType };
}
