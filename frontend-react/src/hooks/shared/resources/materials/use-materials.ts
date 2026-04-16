"use client";

import { useEffect, useState } from "react";
import {
  materialsService,
  mapMaterial,
  type MaterialDetail,
  type MaterialFilters,
  type MaterialRow,
} from "@/services/shared/resources";

export type { MaterialDetail, MaterialFilters, MaterialRow };
export { mapMaterial };

export function useMaterials(page: number, pageSize = 10, filters: MaterialFilters = {}, reloadKey = 0) {
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let isAborted = false;

    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const payload = await materialsService.getList(
          page,
          pageSize,
          filters,
          controller.signal,
        );
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.results)
            ? payload.results
            : [];
        const mapped = list.map(mapMaterial);

        setMaterials(mapped);
        setTotalCount(Array.isArray(payload) ? mapped.length : (payload.count ?? mapped.length));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
      } finally {
        if (isAborted || controller.signal.aborted) return;
        setIsLoading(false);
        setHasLoadedOnce(true);
      }
    };

    void load();

    return () => {
      isAborted = true;
      controller.abort();
    };
  }, [page, pageSize, filters.status, filters.category, filters.room, filters.search, reloadKey]);

  return {
    materials,
    setMaterials,
    totalCount,
    setTotalCount,
    isLoading,
    hasLoadedOnce,
    error,
    setError,
  };
}

export function useMaterialDetail(id?: string | number | null) {
  const [material, setMaterial] = useState<MaterialDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setMaterial(null);
      setError("ID bahan tidak ditemukan.");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    let isAborted = false;

    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const payload = await materialsService.getDetail(id, controller.signal);
        const mapped = mapMaterial(payload);
        setMaterial(mapped);
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
  }, [id]);

  return {
    material,
    setMaterial,
    isLoading,
    error,
    setError,
  };
}

export default useMaterials;
