"use client";

import { useState } from "react";
import {
  requiresUserPassword,
  toCreateProfilePayload,
  toCreateUserPayload,
  type UserFormState,
} from "@/components/admin/user-management";
import {
  usersService,
  type CreateProfilePayload,
  type CreateUserPayload,
} from "@/services/shared/resources";

export type BulkRow = UserFormState & {
  index: number;
  email: string;
  password: string;
};

type BulkResult = {
  index: number;
  status: "success" | "error";
  message: string;
};

export function useBulkCreateUsers() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createUsers = async (rows: BulkRow[], onProgress?: (results: BulkResult[]) => void) => {
    setIsSubmitting(true);
    const results: BulkResult[] = [];

    try {
      for (const row of rows) {
        try {
          const requiresPassword = requiresUserPassword({
            email: row.email,
            role: row.role,
          });
          const result = requiresPassword
            ? await usersService.create(
                toCreateUserPayload({
                  email: row.email,
                  password: row.password,
                  form: row,
                }) as CreateUserPayload,
              )
            : await usersService.createProfile(
                toCreateProfilePayload({
                  email: row.email,
                  form: row,
                }) as CreateProfilePayload,
              );

          if (result.ok) {
            results.push({ index: row.index, status: "success", message: "Sukses" });
          } else {
            let message = `Gagal (${result.status})`;
            const data = (result.data ?? {}) as Record<string, unknown>;
            if (typeof data.detail === "string") message = data.detail;
            else if (Array.isArray(data.email) && typeof data.email[0] === "string") {
              message = data.email[0];
            }
            results.push({ index: row.index, status: "error", message });
          }
        } catch (error) {
          results.push({
            index: row.index,
            status: "error",
            message: error instanceof Error ? error.message : "Terjadi kesalahan.",
          });
        }
        onProgress?.([...results]);
      }
    } finally {
      setIsSubmitting(false);
    }

    return results;
  };

  return { createUsers, isSubmitting };
}

export default useBulkCreateUsers;
