"use client";

import { useState } from "react";
import { usersService, type UserRow } from "@/services/shared/resources";

export function useDeleteUser() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const deleteUser = async (user: Pick<UserRow, "id" | "userId" | "profileId" | "hasUser">) => {
    if (!user?.profileId) return { ok: false, message: "Profile ID kosong" };

    setIsDeleting(true);
    setErrorMessage("");

    try {
      const result = await usersService.removeProfile(user.profileId);

      if (result.ok || result.status === 204) {
        return { ok: true };
      }

      let message = `Gagal menghapus profile (${result.status})`;
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

    setIsDeleting(true);
    setErrorMessage("");

    try {
      const deletedIds: Array<number | string> = [];
      const failedIds: Array<number | string> = [];

      const profileIds = users
        .map((user) => user.profileId ?? user.id)
        .map((id) => String(id).trim())
        .filter((id) => Boolean(id));

      if (profileIds.length) {
        const result = await usersService.bulkRemove(profileIds);
        const data = (result.data ?? {}) as {
          detail?: string;
          deleted_ids?: Array<number | string>;
          failed_ids?: Array<number | string>;
        };

        if (!result.ok) {
          const message =
            (typeof data.detail === "string" && data.detail.trim()) ||
            `Gagal menghapus akun/profile (${result.status})`;
          setErrorMessage(message);
          return { ok: false, message, deletedIds: [], failedIds: [] };
        }

        const deletedProfileIds = Array.isArray(data.deleted_ids) ? data.deleted_ids : [];
        const failedProfileIds = Array.isArray(data.failed_ids) ? data.failed_ids : [];
        const deletedProfileIdSet = new Set(deletedProfileIds.map((id) => String(id)));
        const failedProfileIdSet = new Set(failedProfileIds.map((id) => String(id)));

        for (const profile of users) {
          const currentProfileId = String(profile.profileId ?? profile.id);
          if (deletedProfileIdSet.has(currentProfileId)) {
            deletedIds.push(profile.id);
          } else if (failedProfileIdSet.has(currentProfileId)) {
            failedIds.push(profile.id);
          }
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
