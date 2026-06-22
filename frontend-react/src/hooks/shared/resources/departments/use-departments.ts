"use client";

import { useEffect, useMemo, useState } from "react";
import {
  departmentsService,
  mapDepartment,
  type DepartmentFilters,
  type DepartmentOption,
  type DepartmentRow,
} from "@/services/shared/resources";

export type { DepartmentFilters, DepartmentOption, DepartmentRow };
export { mapDepartment };

export function useDepartmentOptions(reloadKey = 0) {
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let isAborted = false;

    const load = async () => {
      setIsLoading(true);
      setError("");

      try {
        const payload = await departmentsService.getOptions(controller.signal);
        setDepartments(payload);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Terjadi kesalahan saat memuat department.",
        );
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
  }, [reloadKey]);

  const departmentNames = useMemo(
    () => departments.map((department) => department.value),
    [departments],
  );

  return {
    departments,
    departmentNames,
    isLoading,
    error,
  };
}

export function useDepartments(
  page: number,
  pageSize = 20,
  filters: DepartmentFilters = {},
  reloadKey = 0,
) {
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
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
        const payload = await departmentsService.getList(page, pageSize, filters, controller.signal);
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.results)
            ? payload.results
            : [];
        const mappedDepartments = list.map(mapDepartment);

        setDepartments(mappedDepartments);
        setTotalCount(Array.isArray(payload) ? mappedDepartments.length : (payload.count ?? mappedDepartments.length));
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Terjadi kesalahan saat memuat department.",
        );
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
  }, [page, pageSize, filters.search, filters.q, reloadKey]);

  return {
    departments,
    setDepartments,
    totalCount,
    setTotalCount,
    isLoading,
    hasLoadedOnce,
    error,
    setError,
  };
}

export default useDepartments;
