"use client";

import { useRef, useState } from "react";
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
  email: string;
  status: "success" | "error";
  message: string;
};

const ERROR_FIELD_LABELS: Record<string, string> = {
  batch: "batch",
  department: "department",
  detail: "detail",
  email: "email",
  full_name: "nama lengkap",
  id_number: "id number",
  initials: "initials",
  institution: "institution",
  non_field_errors: "data",
  password1: "password",
  password2: "konfirmasi password",
  role: "role",
  user_type: "user type",
};

type ExtractedErrorMessage = {
  field?: string;
  message: string;
};

function extractErrorMessage(value: unknown): ExtractedErrorMessage | null {
  if (typeof value === "string") {
    const message = value.trim();
    return message ? { message } : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractErrorMessage(item);
      if (extracted) return extracted;
    }
    return null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const prioritizedEntries = [
    ...entries.filter(([key]) => key === "detail" || key === "non_field_errors"),
    ...entries.filter(([key]) => key !== "detail" && key !== "non_field_errors"),
  ];

  for (const [key, entryValue] of prioritizedEntries) {
    const extracted = extractErrorMessage(entryValue);
    if (!extracted) continue;
    if (key === "detail" || key === "non_field_errors") {
      return extracted;
    }
    return {
      field: ERROR_FIELD_LABELS[key] ?? key,
      message: extracted.message,
    };
  }

  return null;
}

export function useBulkCreateUsers() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef(false);

  const createUsers = async (rows: BulkRow[], onProgress?: (results: BulkResult[]) => void) => {
    stopRequestedRef.current = false;
    setIsSubmitting(true);
    const results: BulkResult[] = [];

    try {
      for (const row of rows) {
        if (stopRequestedRef.current) {
          break;
        }

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

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
                abortController.signal,
              )
            : await usersService.createProfile(
                toCreateProfilePayload({
                  email: row.email,
                  form: row,
                }) as CreateProfilePayload,
                abortController.signal,
              );

          if (result.ok) {
            results.push({
              index: row.index,
              email: row.email,
              status: "success",
              message: "Sukses",
            });
          } else {
            let message = `Gagal (${result.status})`;
            const extracted = extractErrorMessage(result.data);
            if (extracted?.field) {
              message = `${extracted.field}: ${extracted.message}`;
            } else if (extracted?.message) {
              message = extracted.message;
            }
            results.push({
              index: row.index,
              email: row.email,
              status: "error",
              message,
            });
          }
        } catch (error) {
          if (
            stopRequestedRef.current ||
            (error instanceof DOMException && error.name === "AbortError")
          ) {
            break;
          }
          results.push({
            index: row.index,
            email: row.email,
            status: "error",
            message: error instanceof Error ? error.message : "Terjadi kesalahan.",
          });
        } finally {
          if (abortControllerRef.current === abortController) {
            abortControllerRef.current = null;
          }
        }
        onProgress?.([...results]);
      }
    } finally {
      abortControllerRef.current = null;
      setIsSubmitting(false);
    }

    return results;
  };

  const cancelCreateUsers = () => {
    stopRequestedRef.current = true;
    abortControllerRef.current?.abort();
  };

  return { createUsers, cancelCreateUsers, isSubmitting };
}

export default useBulkCreateUsers;
