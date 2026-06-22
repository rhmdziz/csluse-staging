"use client";

import { ROLE_VALUES, normalizeRoleValue } from "@/constants/roles";
import { USER_TYPE_VALUES } from "@/constants/user-types";
import type { UserRow } from "@/hooks/shared/resources/users";

export const CAMPUS_EMAIL_DOMAIN = "prasetiyamulya.ac.id";
export const USER_MODAL_WIDTH_CLASS =
  "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-[50vw] sm:max-w-[960px] sm:min-w-[720px] sm:max-w-none";

export type UserDetailMode = "view" | "edit";

export type UserFormState = {
  full_name: string;
  initials: string;
  role: string;
  is_mentor: boolean;
  department: string;
  batch: string;
  id_number: string;
  institution: string;
};

export function normalizeUserEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isCampusEmail(email: string) {
  const normalized = normalizeUserEmail(email);
  if (!normalized.includes("@")) return false;
  const domain = normalized.split("@", 2)[1] || "";
  return domain === CAMPUS_EMAIL_DOMAIN || domain.endsWith(`.${CAMPUS_EMAIL_DOMAIN}`);
}

export function requiresUserPassword(args: { email: string; role: string | null | undefined }) {
  return !isCampusEmail(args.email);
}

export function getVisibleUserFields(role: string | null | undefined) {
  const normalizedRole = normalizeRoleValue(role || "");
  return {
    department:
      normalizedRole === ROLE_VALUES.STUDENT ||
      normalizedRole === ROLE_VALUES.LECTURER ||
      normalizedRole === ROLE_VALUES.ADMIN,
    batch: normalizedRole === ROLE_VALUES.STUDENT,
    idNumber:
      normalizedRole === ROLE_VALUES.STUDENT ||
      normalizedRole === ROLE_VALUES.LECTURER ||
      normalizedRole === ROLE_VALUES.STAFF ||
      normalizedRole === ROLE_VALUES.ADMIN,
    institution: normalizedRole === ROLE_VALUES.GUEST,
  };
}

export function createEmptyUserForm(role = ""): UserFormState {
  return {
    full_name: "",
    initials: "",
    role,
    is_mentor: false,
    department: "",
    batch: "",
    id_number: "",
    institution: "",
  };
}

export function mapUserToForm(user: UserRow): UserFormState {
  return {
    full_name: user.name || "",
    initials: user.initials === "-" ? "" : user.initials || "",
    role: normalizeRoleValue(user.role || ""),
    is_mentor: Boolean(user.isMentor),
    department: user.department === "-" ? "" : user.department || "",
    batch: user.batch === "-" ? "" : user.batch || "",
    id_number: user.idNumber === "-" ? "" : user.idNumber || "",
    institution: user.institution === "-" ? "" : user.institution || "",
  };
}

export function toCreateUserPayload(args: {
  email: string;
  password: string;
  form: UserFormState;
}) {
  const { email, password, form } = args;
  const normalizedEmail = email.trim();
  const visibleFields = getVisibleUserFields(form.role);
  const payload: Record<string, string | boolean> = {
    full_name: form.full_name.trim(),
    email: normalizedEmail,
    username: normalizedEmail.split("@")[0] || "user",
    password1: password,
    password2: password,
    user_type:
      form.role === ROLE_VALUES.GUEST
        ? USER_TYPE_VALUES.EXTERNAL
        : USER_TYPE_VALUES.INTERNAL,
  };

  if (form.initials.trim()) payload.initials = form.initials.trim();
  if (form.role) payload.role = form.role;
  if (form.role === ROLE_VALUES.LECTURER) payload.is_mentor = form.is_mentor;
  if (visibleFields.department && form.department) payload.department = form.department;
  if (visibleFields.batch && form.batch) payload.batch = form.batch;
  if (visibleFields.idNumber && form.id_number) payload.id_number = form.id_number;
  if (visibleFields.institution && form.institution) payload.institution = form.institution;

  return payload;
}

export function toCreateProfilePayload(args: {
  email: string;
  form: UserFormState;
}) {
  const { email, form } = args;
  const normalizedEmail = email.trim();
  const visibleFields = getVisibleUserFields(form.role);
  const payload: Record<string, string | boolean> = {
    full_name: form.full_name.trim(),
    email: normalizedEmail,
    user_type:
      form.role === ROLE_VALUES.GUEST
        ? USER_TYPE_VALUES.EXTERNAL
        : USER_TYPE_VALUES.INTERNAL,
  };

  if (form.initials.trim()) payload.initials = form.initials.trim();
  if (form.role) payload.role = form.role;
  if (form.role === ROLE_VALUES.LECTURER) payload.is_mentor = form.is_mentor;
  if (visibleFields.department && form.department) payload.department = form.department;
  if (visibleFields.batch && form.batch) payload.batch = form.batch;
  if (visibleFields.idNumber && form.id_number) payload.id_number = form.id_number;
  if (visibleFields.institution && form.institution) payload.institution = form.institution;

  return payload;
}

export function toUpdateUserPayload(form: UserFormState) {
  const visibleFields = getVisibleUserFields(form.role);
  return {
    full_name: form.full_name,
    initials: form.initials,
    role: form.role || null,
    is_mentor: form.role === ROLE_VALUES.LECTURER ? form.is_mentor : false,
    department: visibleFields.department ? form.department || null : null,
    batch: visibleFields.batch ? form.batch || null : null,
    id_number: visibleFields.idNumber ? form.id_number || null : null,
    institution: visibleFields.institution ? form.institution || null : null,
  };
}

export function applyUpdatedUser(user: UserRow, form: UserFormState, updated: Record<string, unknown>): UserRow {
  const visibleFields = getVisibleUserFields(form.role || user.role || "");
  return {
    ...user,
    name: String(updated.full_name || form.full_name || user.name),
    initials: String(updated.initials || form.initials || ""),
    role: normalizeRoleValue(String(updated.role || form.role || "")) || "-",
    isMentor:
      normalizeRoleValue(String(updated.role || form.role || "")) === ROLE_VALUES.LECTURER
        ? Boolean(updated.is_mentor ?? form.is_mentor)
        : false,
    department: visibleFields.department
      ? String(updated.department || form.department || "-")
      : "-",
    batch: visibleFields.batch ? String(updated.batch || form.batch || "-") : "-",
    idNumber: visibleFields.idNumber
      ? String(updated.id_number || form.id_number || "-")
      : "-",
    institution: visibleFields.institution
      ? String(updated.institution || form.institution || "-")
      : "-",
  };
}
