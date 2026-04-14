"use client";

import { useState } from "react";
import { extractApiErrorMessage } from "@/lib/core";
import {
  equipmentsService,
  type CreateEquipmentPayload,
} from "@/services/shared/resources";

export type { CreateEquipmentPayload };

function parseEquipmentError(data: unknown, fallback = "Gagal membuat peralatan.") {
  return extractApiErrorMessage(data, fallback, [
    "name",
    "quantity",
    "category",
    "room",
    "is_moveable",
  ]);
}

export async function createEquipmentRequest(payload: CreateEquipmentPayload) {
  const result = await equipmentsService.create(payload);
  if (result.ok) {
    return { ok: true as const };
  }

  let message = "Gagal membuat peralatan. Periksa data dan coba lagi.";
  if (typeof result.data !== "undefined") {
    message = parseEquipmentError(result.data, message);
  }

  return { ok: false as const, message };
}

export function useCreateEquipment() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const createEquipment = async (payload: CreateEquipmentPayload) => {
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const result = await createEquipmentRequest(payload);
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

  return { createEquipment, isSubmitting, errorMessage, setErrorMessage };
}

export default useCreateEquipment;
