"use client";

import { useCallback, useState } from "react";
import {
  labClearanceService,
  type LabClearanceResult,
  type UserRow,
} from "@/services/admin";

export type { LabClearanceResult, UserRow };

export function useAdminLabClearance() {
  const [searchResults, setSearchResults] = useState<UserRow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [clearanceData, setClearanceData] = useState<LabClearanceResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState("");

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    setSearchError("");
    try {
      const results = await labClearanceService.searchUsers(query);
      setSearchResults(results);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Gagal mencari pengguna.");
    } finally {
      setIsSearching(false);
    }
  }, []);

  const selectUser = useCallback(async (user: UserRow) => {
    setSelectedUser(user);
    setSearchResults([]);
    setClearanceData(null);
    setCheckError("");

    const profileId = user.profileId ? String(user.profileId) : null;
    if (!profileId) {
      setCheckError("Pengguna ini tidak memiliki profil.");
      return;
    }

    setIsChecking(true);
    try {
      const data = await labClearanceService.getLabClearance(profileId);
      setClearanceData(data);
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : "Gagal mengambil data tanggungan.");
    } finally {
      setIsChecking(false);
    }
  }, []);

  const reset = useCallback(() => {
    setSelectedUser(null);
    setClearanceData(null);
    setSearchResults([]);
    setSearchError("");
    setCheckError("");
  }, []);

  return {
    searchResults,
    isSearching,
    searchError,
    selectedUser,
    clearanceData,
    isChecking,
    checkError,
    searchUsers,
    selectUser,
    reset,
  };
}
