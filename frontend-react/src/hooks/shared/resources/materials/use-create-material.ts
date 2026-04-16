"use client";

import { useState } from "react";
import { extractApiErrorMessage } from "@/lib/core";
import {
  materialsService,
  type CreateMaterialPayload,
} from "@/services/shared/resources";

export type { CreateMaterialPayload };

function parseMaterialError(data: unknown, fallback = "Gagal membuat bahan.") {
  return extractApiErrorMessage(data, fallback, [
    "name",
    "quantity",
    "category",
    "room",
    "unit",
  ]);
}

export async function createMaterialRequest(payload: CreateMaterialPayload) {
  const result = await materialsService.create(payload);
  if (result.ok) {
    return { ok: true as const };
  }

  let message = "Gagal membuat bahan. Periksa data dan coba lagi.";
  if (typeof result.data !== "undefined") {
    message = parseMaterialError(result.data, message);
  }

  return { ok: false as const, message };
}

export function useCreateMaterial() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const createMaterial = async (payload: CreateMaterialPayload) => {
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const result = await createMaterialRequest(payload);
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

  return { createMaterial, isSubmitting, errorMessage, setErrorMessage };
}

export default useCreateMaterial;
