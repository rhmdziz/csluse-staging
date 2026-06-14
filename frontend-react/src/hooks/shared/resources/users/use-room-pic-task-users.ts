"use client";

import { useEffect, useState } from "react";
import {
  usersService,
  type RoomPicTaskAssignment,
  type RoomPicTaskUserRow,
  type RoomPicTaskUsersFilters as UseRoomPicTaskUsersFilters,
} from "@/services/shared/resources";

export type { RoomPicTaskAssignment, RoomPicTaskUserRow };

export function useRoomPicTaskUsers(
  filters: UseRoomPicTaskUsersFilters = {},
  reloadKey = 0,
) {
  const [users, setUsers] = useState<RoomPicTaskUserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let isAborted = false;

    const loadUsers = async () => {
      setIsLoading(true);
      setError("");

      try {
        const payload = await usersService.getRoomPicTaskUsers(
          filters,
          controller.signal,
        );
        setUsers(payload);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Terjadi kesalahan saat memuat PIC ruangan.",
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
  }, [filters.department, filters.role, filters.room, filters.search, reloadKey]);

  return {
    users,
    setUsers,
    totalCount: users.length,
    isLoading,
    hasLoadedOnce,
    error,
    setError,
  };
}

export async function removeRoomPicAssignments(userId: string | number) {
  return usersService.removeRoomPicAssignments(userId);
}

export async function bulkRemoveRoomPicAssignments(ids: Array<number | string>) {
  return usersService.bulkRemoveRoomPicAssignments(ids);
}
