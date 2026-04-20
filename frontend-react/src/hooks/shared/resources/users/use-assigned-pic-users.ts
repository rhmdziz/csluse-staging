"use client";

import { useEffect, useState } from "react";
import {
  usersService,
  type PicUser,
} from "@/services/shared/resources";

export type { PicUser };

export function useAssignedPicUsers(enabled = true) {
  const [picUsers, setPicUsers] = useState<PicUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    let isAborted = false;

    const loadPicUsers = async () => {
      setIsLoading(true);
      setError("");

      try {
        const list = await usersService.getAssignedPicUsers(controller.signal);
        setPicUsers(list);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Terjadi kesalahan saat memuat PIC.");
      } finally {
        if (isAborted || controller.signal.aborted) return;
        setIsLoading(false);
      }
    };

    void loadPicUsers();

    return () => {
      isAborted = true;
      controller.abort();
    };
  }, [enabled]);

  return { picUsers, isLoading, error };
}

export default useAssignedPicUsers;
