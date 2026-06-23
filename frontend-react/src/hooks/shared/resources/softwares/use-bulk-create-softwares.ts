"use client";

import { useRef, useState } from "react";
import { extractApiErrorMessage } from "@/lib/core";
import {
  softwaresService,
  type BulkSoftwareResult,
  type BulkSoftwareRow,
} from "@/services/shared/resources";

export type { BulkSoftwareResult, BulkSoftwareRow };

export function useBulkCreateSoftwares() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const createSoftwares = async (
    rows: BulkSoftwareRow[],
    onProgress?: (results: BulkSoftwareResult[]) => void,
  ) => {
    setIsSubmitting(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const result = await softwaresService.bulkCreate(rows, abortController.signal);

      const data = (result.data ?? {}) as {
        results?: { index?: number; status?: "success" | "error"; message?: unknown }[];
        detail?: string;
      };

      if (!result.ok && !Array.isArray(data.results)) {
        throw new Error(
          extractApiErrorMessage(
            data,
            "Gagal membuat software secara bulk.",
            ["detail"],
          ),
        );
      }

      const results: BulkSoftwareResult[] = (data.results || []).map((row) => ({
        index: Number(row.index) || 0,
        status: row.status === "success" ? "success" : "error",
        message:
          row.status === "success"
            ? "Sukses"
            : extractApiErrorMessage(
                row.message,
                "Terjadi kesalahan.",
                ["name", "version", "license_info", "license_expiration", "equipment", "description"],
              ),
      }));
      onProgress?.(results);
      return results;
    } catch (error) {
      if (abortController.signal.aborted) {
        return [];
      }
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan.";
      const results = rows.map((row) => ({
        index: row.index,
        status: "error" as const,
        message,
      }));
      onProgress?.(results);
      return results;
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setIsSubmitting(false);
    }
  };

  const cancelCreateSoftwares = () => {
    abortControllerRef.current?.abort();
  };

  return { createSoftwares, cancelCreateSoftwares, isSubmitting };
}

export default useBulkCreateSoftwares;
