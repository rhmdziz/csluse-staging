"use client";

import { useState } from "react";

import {
  extractApiErrorMessage,
  extractApiErrorMessageFromText,
} from "@/lib/core";
import {
  sampleTestingService,
  type SampleTestingStatusActionType as ActionType,
} from "@/services/sample-testing";

export function useUpdateSampleTestingStatus() {
  const [pendingAction, setPendingAction] = useState<{
    sampleTestingId: string | number | null;
    type: ActionType | null;
  }>({
    sampleTestingId: null,
    type: null,
  });

  const updateSampleTestingStatus = async (
    sampleTestingId: string | number,
    type: ActionType,
  ) => {
    setPendingAction({ sampleTestingId, type });

    try {
      const result = await sampleTestingService.updateStatus(sampleTestingId, type);

      if (!result.ok) {
        let message =
          type === "approve"
            ? "Gagal menyetujui pengajuan pengujian sampel."
            : type === "reject"
              ? "Gagal menolak pengajuan pengujian sampel."
              : type === "complete"
                ? "Gagal menandai pengajuan pengujian sampel sebagai selesai."
                : "Gagal membatalkan pengajuan pengujian sampel.";

        if (typeof result.data !== "undefined") {
          message = extractApiErrorMessage(result.data, message);
        } else if (result.text) {
          message = extractApiErrorMessageFromText(result.text, message);
        }

        return {
          ok: false as const,
          message,
        };
      }

      return {
        ok: true as const,
        data: (result.data ?? {}) as Record<string, unknown>,
      };
    } catch (error) {
      return {
        ok: false as const,
        message:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat memproses pengajuan.",
      };
    } finally {
      setPendingAction({ sampleTestingId: null, type: null });
    }
  };

  return {
    updateSampleTestingStatus,
    pendingAction,
  };
}

export default useUpdateSampleTestingStatus;
