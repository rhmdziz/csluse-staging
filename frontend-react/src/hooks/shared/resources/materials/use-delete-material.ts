"use client";

import { useState } from "react";
import { extractApiErrorMessage } from "@/lib/core";
import { materialsService } from "@/services/shared/resources";

function parseDeleteMaterialError(data: unknown, fallback = "Gagal menghapus bahan.") {
  return extractApiErrorMessage(data, fallback);
}

export function useDeleteMaterial() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const deleteMaterial = async (materialId: string | number) => {
    if (!materialId) {
      const message = "Material ID kosong.";
      setErrorMessage(message);
      return { ok: false as const, message };
    }

    setErrorMessage("");
    setIsDeleting(true);

    try {
      const result = await materialsService.remove(materialId);

      if (result.ok || result.status === 204) {
        return { ok: true as const };
      }

      let message = `Gagal menghapus bahan (${result.status}).`;
      if (typeof result.data !== "undefined") {
        message = parseDeleteMaterialError(result.data, message);
      }

      setErrorMessage(message);
      return { ok: false as const, message };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Terjadi kesalahan jaringan. Coba lagi.";
      setErrorMessage(message);
      return { ok: false as const, message };
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteMaterials = async (materialIds: Array<string | number>) => {
    if (!materialIds.length) {
      const message = "Pilih minimal satu bahan.";
      setErrorMessage(message);
      return { ok: false as const, message };
    }

    setErrorMessage("");
    setIsDeleting(true);

    try {
      const result = await materialsService.bulkRemove(materialIds);

      const fallback = `Gagal menghapus bahan terpilih (${result.ok ? 200 : result.status}).`;
      const data = (result.data ?? null) as
        | {
            detail?: string;
            deleted_ids?: Array<string | number>;
            deleted_count?: number;
            failed_count?: number;
            message?: string;
          }
        | null;

      if (result.ok || result.status === 207) {
        return {
          ok: true as const,
          deletedIds: Array.isArray(data?.deleted_ids) ? data.deleted_ids : [],
          deletedCount: Number(data?.deleted_count ?? 0),
          failedCount: Number(data?.failed_count ?? 0),
          message: typeof data?.detail === "string" ? data.detail : undefined,
        };
      }

      const message = data ? parseDeleteMaterialError(data, fallback) : fallback;
      setErrorMessage(message);
      return { ok: false as const, message };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Terjadi kesalahan jaringan. Coba lagi.";
      setErrorMessage(message);
      return { ok: false as const, message };
    } finally {
      setIsDeleting(false);
    }
  };

  return { deleteMaterial, deleteMaterials, isDeleting, errorMessage, setErrorMessage };
}

export default useDeleteMaterial;
