"use client";

import { useEffect, useState } from "react";
import {
  equipmentsService,
  mapEquipment,
  type EquipmentDetail,
  type EquipmentFilters,
  type EquipmentRow,
} from "@/services/shared/resources";

export type { EquipmentDetail, EquipmentFilters, EquipmentRow };
export { mapEquipment };

export function useEquipments(page: number, pageSize = 10, filters: EquipmentFilters = {}, reloadKey = 0) {
  const [equipments, setEquipments] = useState<EquipmentRow[]>([]);
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
        const payload = await equipmentsService.getList(
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
        const mapped = list.map(mapEquipment);

        setEquipments(mapped);
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
  }, [page, pageSize, filters.status, filters.category, filters.room, filters.pic, filters.is_moveable, filters.is_borrowable, filters.is_useable, filters.search, reloadKey]);

  return {
    equipments,
    setEquipments,
    totalCount,
    setTotalCount,
    isLoading,
    hasLoadedOnce,
    error,
    setError,
  };
}

export function useEquipmentDetail(id?: string | number | null) {
  const [equipment, setEquipment] = useState<EquipmentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setEquipment(null);
      setError("ID peralatan tidak ditemukan.");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    let isAborted = false;

    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const payload = await equipmentsService.getDetail(id, controller.signal);
        const mapped = mapEquipment(payload);
        setEquipment(mapped);
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
    equipment,
    setEquipment,
    isLoading,
    error,
    setError,
  };
}

export default useEquipments;
