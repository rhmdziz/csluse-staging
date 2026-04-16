"use client";

import { useEffect, useState } from "react";
import {
  materialsService,
  type MaterialOption,
} from "@/services/shared/resources";

export type { MaterialOption };

export function useMaterialOptions(
  status = "",
  room = "",
  enabled = true,
  category = "",
) {
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) {
      setMaterials([]);
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
        const mapped = await materialsService.getOptions(
          { status, room, category },
          controller.signal,
        );
        setMaterials(mapped.filter((item) => item.id));
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
  }, [status, room, enabled, category]);

  return { materials, isLoading, error };
}

export default useMaterialOptions;
