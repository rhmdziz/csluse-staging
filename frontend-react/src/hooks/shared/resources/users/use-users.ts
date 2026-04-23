"use client";

import { useEffect, useState } from "react";
import {
  mapUser,
  mapProfile,
  usersService,
  type UserFilters,
  type UserRoleAggregates,
  type UserRow,
} from "@/services/shared/resources";

export type { UserFilters, UserRoleAggregates, UserRow };
export { mapProfile, mapUser };

export function useUserDetail(userId?: string | number | null) {
  const [user, setUser] = useState<UserRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) {
      setUser(null);
      setError("User ID tidak ditemukan.");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    let isAborted = false;

    const loadUser = async () => {
      setIsLoading(true);
      setError("");

      try {
        const payload = await usersService.getDetail(userId, controller.signal);
        setUser(mapProfile(payload));
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Terjadi kesalahan saat memuat detail profile.",
        );
      } finally {
        if (isAborted || controller.signal.aborted) return;
        setIsLoading(false);
      }
    };

    void loadUser();

    return () => {
      isAborted = true;
      controller.abort();
    };
  }, [userId]);

  return {
    user,
    setUser,
    isLoading,
    error,
    setError,
  };
}

export function getUserInitials(
  user?: Pick<UserRow, "name" | "email" | "initials"> | null,
): string {
  if (user?.initials?.trim() && user.initials.trim() !== "-") {
    return user.initials.trim().toUpperCase().slice(0, 3);
  }
  const source = user?.name || user?.email || "";
  const parts = source.trim().split(/\s+/).slice(0, 2);
  const chars = parts.map((part) => part[0]).join("");
  return chars ? chars.toUpperCase() : "U";
}

export function useUsers(
  page: number,
  pageSize = 20,
  filters: UserFilters = {},
  reloadKey = 0,
) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState("");
  const [aggregates, setAggregates] = useState<UserRoleAggregates>({
    total: 0,
    student: 0,
    lecturer: 0,
    admin: 0,
    staff: 0,
    guest: 0,
    preProvisioned: 0,
    active: 0,
  });

  useEffect(() => {
    const controller = new AbortController();
    let isAborted = false;

    const loadUsers = async () => {
      setIsLoading(true);
      setError("");

      try {
        const payload = await usersService.getList(
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
        const mappedUsers = list.map(mapProfile);

        setUsers(mappedUsers);
        setTotalCount(Array.isArray(payload) ? mappedUsers.length : (payload.count ?? mappedUsers.length));
        setAggregates({
          total: Array.isArray(payload) ? mappedUsers.length : Number(payload.aggregates?.total ?? 0),
          student: Array.isArray(payload) ? 0 : Number(payload.aggregates?.student ?? 0),
          lecturer: Array.isArray(payload) ? 0 : Number(payload.aggregates?.lecturer ?? 0),
          admin: Array.isArray(payload) ? 0 : Number(payload.aggregates?.admin ?? 0),
          staff: Array.isArray(payload) ? 0 : Number(payload.aggregates?.staff ?? 0),
          guest: Array.isArray(payload) ? 0 : Number(payload.aggregates?.guest ?? 0),
          preProvisioned: Array.isArray(payload) ? 0 : Number(payload.aggregates?.pre_provisioned ?? 0),
          active: Array.isArray(payload) ? 0 : Number(payload.aggregates?.active ?? 0),
        });
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Terjadi kesalahan saat memuat user.",
        );
      } finally {
        if (isAborted || controller.signal.aborted) return;
        setIsLoading(false);
        setHasLoadedOnce(true);
      }
    };

    void loadUsers();

    return () => {
      isAborted = true;
      controller.abort();
    };
  }, [
    page,
    pageSize,
    filters.department,
    filters.role,
    filters.batch,
    filters.search,
    filters.q,
    filters.hasUser,
    filters.isMentor,
    reloadKey,
  ]);

  return {
    users,
    setUsers,
    totalCount,
    setTotalCount,
    aggregates,
    isLoading,
    hasLoadedOnce,
    error,
    setError,
  };
}
