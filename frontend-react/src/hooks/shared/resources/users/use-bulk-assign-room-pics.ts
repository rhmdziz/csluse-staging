"use client";

import { useState } from "react";

import { extractApiErrorMessage } from "@/lib/core";

import {
  usersService,
  type BulkAssignRoomPicPayload,
  type BulkAssignRoomPicResult,
} from "@/services/shared/resources";

function parseBulkAssignRoomPicError(
  data: unknown,
  fallback = "Gagal menambahkan PIC ke ruangan terpilih.",
) {
  return extractApiErrorMessage(data, fallback, [
    "detail",
    "room_ids",
    "pic_ids",
  ]);
}

export function useBulkAssignRoomPics() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const bulkAssignRoomPics = async (payload: BulkAssignRoomPicPayload) => {
    if (!payload.roomIds.length) {
      const message = "Pilih minimal satu ruangan.";
      setErrorMessage(message);
      return { ok: false as const, message };
    }

    if (!payload.picIds.length) {
      const message = "Pilih minimal satu PIC.";
      setErrorMessage(message);
      return { ok: false as const, message };
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const result = await usersService.bulkAssignRoomPicAssignments(payload);

      if (result.ok) {
        return {
          ok: true as const,
          data: (result.data ?? {}) as BulkAssignRoomPicResult,
        };
      }

      let message = `Gagal menambahkan PIC ke ruangan (${result.status}).`;
      if (typeof result.data !== "undefined") {
        message = parseBulkAssignRoomPicError(result.data, message);
      }
      setErrorMessage(message);
      return { ok: false as const, message };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Terjadi kesalahan jaringan. Coba lagi.";
      setErrorMessage(message);
      return { ok: false as const, message };
    } finally {
      setIsSubmitting(false);
    }
  };

  return { bulkAssignRoomPics, isSubmitting, errorMessage, setErrorMessage };
}

export default useBulkAssignRoomPics;
