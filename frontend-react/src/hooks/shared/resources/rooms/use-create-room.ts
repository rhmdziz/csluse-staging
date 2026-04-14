"use client";

import { useState } from "react";
import { extractApiErrorMessage } from "@/lib/core";
import {
  roomsService,
  type CreateRoomPayload,
} from "@/services/shared/resources";

export type { CreateRoomPayload };

function parseRoomError(data: unknown, fallback = "Gagal membuat ruangan.") {
  return extractApiErrorMessage(data, fallback, [
    "name",
    "capacity",
    "number",
    "floor",
    "pics",
  ]);
}

export async function createRoomRequest(payload: CreateRoomPayload) {
  const result = await roomsService.create(payload);
  if (result.ok) {
    return { ok: true as const };
  }

  let message = "Gagal membuat ruangan. Periksa data dan coba lagi.";
  if (typeof result.data !== "undefined") {
    message = parseRoomError(result.data, message);
  }

  return { ok: false as const, message };
}

export function useCreateRoom() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const createRoom = async (payload: CreateRoomPayload) => {
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const result = await createRoomRequest(payload);
      if (result.ok) {
        return { ok: true as const };
      }
      setErrorMessage(result.message);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Terjadi kesalahan jaringan. Coba lagi.";
      setErrorMessage(message);
      return { ok: false as const, message };
    } finally {
      setIsSubmitting(false);
    }
  };

  return { createRoom, isSubmitting, errorMessage, setErrorMessage };
}

export default useCreateRoom;
