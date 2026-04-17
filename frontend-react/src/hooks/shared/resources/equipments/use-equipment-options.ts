"use client";

import { useEffect, useState } from "react";
import {
  equipmentsService,
  type EquipmentOption,
} from "@/services/shared/resources";

export type { EquipmentOption };

export function useEquipmentOptions(
  status = "",
  room = "",
  enabled = true,
  isMoveable?: boolean,
  category = "",
  isBorrowable?: boolean,
) {
  const [equipments, setEquipments] = useState<EquipmentOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) {
      setEquipments([]);
      setError("");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    let isAborted = false;

    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const mapped = await equipmentsService.getOptions(
          { status, room, isMoveable, isBorrowable, category },
          controller.signal,
        );
        setEquipments(mapped.filter((item) => item.id));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
      } finally {
        if (isAborted || controller.signal.aborted) return;
        setIsLoading(false);
      }
    };

    void load();

    return () => {
      isAborted = true;
      controller.abort();
    };
  }, [status, room, enabled, isMoveable, isBorrowable, category]);

  return { equipments, isLoading, error };
}

export default useEquipmentOptions;
