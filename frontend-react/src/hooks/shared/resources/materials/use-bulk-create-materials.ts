"use client";

import { useState } from "react";
import { extractApiErrorMessage } from "@/lib/core";
import {
  materialsService,
  type BulkMaterialResult,
  type BulkMaterialRow,
} from "@/services/shared/resources";

export type { BulkMaterialResult, BulkMaterialRow };

export function useBulkCreateMaterials() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createMaterials = async (
    rows: BulkMaterialRow[],
    onProgress?: (results: BulkMaterialResult[]) => void,
  ) => {
    setIsSubmitting(true);

    try {
      const result = await materialsService.bulkCreate(rows);

      const data = (result.data ?? {}) as {
        results?: { index?: number; status?: "success" | "error"; message?: unknown }[];
        detail?: string;
      };

      if (!result.ok && !Array.isArray(data.results)) {
        throw new Error(
          extractApiErrorMessage(
            data,
            "Gagal membuat bahan secara bulk.",
            ["detail"],
          ),
        );
      }

      const results: BulkMaterialResult[] = (data.results || []).map((row) => ({
        index: Number(row.index) || 0,
        status: row.status === "success" ? "success" : "error",
        message:
          row.status === "success"
            ? "Sukses"
            : extractApiErrorMessage(
                row.message,
                "Terjadi kesalahan.",
                ["name", "quantity", "category", "room", "unit"],
              ),
      }));
      onProgress?.(results);
      return results;
    } catch (error) {
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
      setIsSubmitting(false);
    }
  };

  return { createMaterials, isSubmitting };
}

export default useBulkCreateMaterials;
