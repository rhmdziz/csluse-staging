"use client";

import { useRef, useState } from "react";
import { extractApiErrorMessage } from "@/lib/core";
import {
  roomsService,
  type BulkRoomResult,
  type BulkRoomRow,
} from "@/services/shared/resources";

export type { BulkRoomResult, BulkRoomRow };

export function useBulkCreateRooms() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const createRooms = async (
    rows: BulkRoomRow[],
    onProgress?: (results: BulkRoomResult[]) => void,
  ) => {
    setIsSubmitting(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const result = await roomsService.bulkCreate(rows, abortController.signal);

      const data = (result.data ?? {}) as {
        results?: { index?: number; status?: "success" | "error"; message?: unknown }[];
        detail?: string;
      };

      if (!result.ok && !Array.isArray(data.results)) {
        throw new Error(
          extractApiErrorMessage(
            data,
            "Gagal membuat ruangan secara bulk.",
            ["detail"],
          ),
        );
      }

      const results: BulkRoomResult[] = (data.results || []).map((row) => ({
        index: Number(row.index) || 0,
        status: row.status === "success" ? "success" : "error",
        message:
          row.status === "success"
            ? "Sukses"
            : extractApiErrorMessage(
                row.message,
                "Terjadi kesalahan.",
                ["name", "capacity", "number", "floor", "pics", "image"],
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

  const cancelCreateRooms = () => {
    abortControllerRef.current?.abort();
  };

  return { createRooms, cancelCreateRooms, isSubmitting };
}

export default useBulkCreateRooms;
