"use client";

import { useState } from "react";
import { usersService, type UserRow } from "@/services/shared/resources";

export function useDeleteUser() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const deleteUser = async (user: Pick<UserRow, "id" | "userId" | "profileId" | "hasUser">) => {
    if (!user?.id) return { ok: false, message: "ID kosong" };

    setIsDeleting(true);
    setErrorMessage("");

    try {
      const activeUserId = user.userId ?? user.id;
      const result = user.hasUser
        ? await usersService.remove(activeUserId)
        : user.profileId
          ? await usersService.removeProfile(user.profileId)
          : { ok: false as const, status: 400, data: { detail: "Profile ID kosong" } };

      if (result.ok || result.status === 204) {
        return { ok: true };
      }

      let message = `Gagal menghapus ${user.hasUser ? "akun dan profile" : "profile"} (${result.status})`;
      const data = (result.data ?? {}) as { detail?: string };
      if (typeof data.detail === "string" && data.detail.trim()) {
        message = data.detail;
      }
      setErrorMessage(message);
      return { ok: false, message };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan jaringan.";
      setErrorMessage(message);
      return { ok: false, message };
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteUsers = async (
    users: Array<Pick<UserRow, "id" | "userId" | "profileId" | "hasUser">>,
  ) => {
    if (!users.length) {
      return { ok: false, message: "Data kosong", deletedIds: [], failedIds: [] };
    }

    const activeUsers = users.filter((user) => user.hasUser);
    const preProvisionedProfiles = users.filter((user) => !user.hasUser);

    setIsDeleting(true);
    setErrorMessage("");

    try {
      const deletedIds: Array<number | string> = [];
      const failedIds: Array<number | string> = [];

      if (activeUsers.length) {
        const normalizedIds = activeUsers
          .map((user) => Number(user.userId ?? user.id))
          .filter((id) => Number.isInteger(id) && id > 0);

        if (normalizedIds.length) {
          const result = await usersService.bulkRemove(normalizedIds);
          const data = (result.data ?? {}) as {
            detail?: string;
            deleted_ids?: Array<number | string>;
            failed_ids?: Array<number | string>;
          };

          if (!result.ok) {
            const message =
              (typeof data.detail === "string" && data.detail.trim()) ||
              `Gagal menghapus akun dan profile (${result.status})`;
            setErrorMessage(message);
            return { ok: false, message, deletedIds: [], failedIds: [] };
          }

          const deletedUserIds = Array.isArray(data.deleted_ids) ? data.deleted_ids : [];
          const failedUserIds = Array.isArray(data.failed_ids) ? data.failed_ids : [];
          const deletedUserIdSet = new Set(deletedUserIds.map((id) => String(id)));
          const failedUserIdSet = new Set(failedUserIds.map((id) => String(id)));

          for (const user of activeUsers) {
            const currentUserId = String(user.userId ?? user.id);
            if (deletedUserIdSet.has(currentUserId)) {
              deletedIds.push(user.id);
            } else if (failedUserIdSet.has(currentUserId)) {
              failedIds.push(user.id);
            }
          }
        }
      }

      for (const profile of preProvisionedProfiles) {
        const result = profile.profileId
          ? await usersService.removeProfile(profile.profileId)
          : { ok: false as const, status: 400, data: { detail: "Profile ID kosong" } };

        if (result.ok || result.status === 204) {
          deletedIds.push(profile.id);
        } else {
          failedIds.push(profile.id);
        }
      }

      return {
        ok: deletedIds.length > 0,
        deletedCount: deletedIds.length,
        failedCount: failedIds.length,
        deletedIds,
        failedIds,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan jaringan.";
      setErrorMessage(message);
      return { ok: false, message, deletedIds: [], failedIds: [] };
    } finally {
      setIsDeleting(false);
    }
  };

  return { deleteUser, deleteUsers, isDeleting, errorMessage, setErrorMessage };
}

export default useDeleteUser;
