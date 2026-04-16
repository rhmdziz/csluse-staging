"use client";

import { useState } from "react";
import { extractApiErrorMessage } from "@/lib/core";
import {
  materialsService,
  type UpdateMaterialPayload,
} from "@/services/shared/resources";

export type { UpdateMaterialPayload };

function parseMaterialError(data: unknown, fallback = "Gagal memperbarui bahan.") {
  return extractApiErrorMessage(data, fallback, [
    "name",
    "quantity",
    "category",
    "status",
    "room",
    "unit",
  ]);
}

export function useUpdateMaterial() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const updateMaterial = async (materialId: string | number, payload: UpdateMaterialPayload) => {
    if (!materialId) {
      const message = "Material ID kosong.";
      setErrorMessage(message);
      return { ok: false as const, message };
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const result = await materialsService.update(materialId, payload);

      if (result.ok) {
        return { ok: true as const, data: (result.data ?? {}) as Record<string, unknown> };
      }

      let message = `Gagal memperbarui bahan (${result.status}).`;
      if (typeof result.data !== "undefined") {
        message = parseMaterialError(result.data, message);
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

  return { updateMaterial, isSubmitting, errorMessage, setErrorMessage };
}

export default useUpdateMaterial;
