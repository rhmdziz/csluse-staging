const ROLE_VALUES = {
  STUDENT: "Student",
  LECTURER: "Lecturer",
  ADMIN: "Admin",
  STAFF: "Staff",
  GUEST: "Guest",
  SUPER_ADMINISTRATOR: "SuperAdministrator",
} as const;

const ROLE_LABELS = {
  [ROLE_VALUES.STUDENT]: "Student",
  [ROLE_VALUES.LECTURER]: "Lecturer",
  [ROLE_VALUES.ADMIN]: "Admin",
  [ROLE_VALUES.STAFF]: "Staff",
  [ROLE_VALUES.GUEST]: "Guest",
} as const;

const ROLE_OPTIONS = [
  { value: "", label: "Pilih role" },
  { value: ROLE_VALUES.STUDENT, label: ROLE_LABELS[ROLE_VALUES.STUDENT] },
  { value: ROLE_VALUES.LECTURER, label: ROLE_LABELS[ROLE_VALUES.LECTURER] },
  { value: ROLE_VALUES.ADMIN, label: ROLE_LABELS[ROLE_VALUES.ADMIN] },
  { value: ROLE_VALUES.STAFF, label: ROLE_LABELS[ROLE_VALUES.STAFF] },
  { value: ROLE_VALUES.GUEST, label: ROLE_LABELS[ROLE_VALUES.GUEST] },
];

const ROLE_FILTER_OPTIONS = [
  ROLE_VALUES.STUDENT,
  ROLE_VALUES.LECTURER,
  ROLE_VALUES.ADMIN,
  ROLE_VALUES.STAFF,
  ROLE_VALUES.GUEST,
];

const ROLE_NORMALIZATION_MAP: Record<string, string> = {
  STUDENT: ROLE_VALUES.STUDENT,
  LECTURER: ROLE_VALUES.LECTURER,
  ADMIN: ROLE_VALUES.ADMIN,
  ADMINISTRATOR: ROLE_VALUES.ADMIN,
  STAFF: ROLE_VALUES.STAFF,
  GUEST: ROLE_VALUES.GUEST,
  OTHER: ROLE_VALUES.GUEST,
  SUPERADMINISTRATOR: ROLE_VALUES.SUPER_ADMINISTRATOR,
  SUPER_ADMINISTRATOR: ROLE_VALUES.SUPER_ADMINISTRATOR,
};

const MENU_ACCESS_RULES: Record<string, readonly string[]> = {
  dashboard: [
    ROLE_VALUES.STUDENT,
    ROLE_VALUES.GUEST,
    ROLE_VALUES.LECTURER,
    ROLE_VALUES.STAFF,
    ROLE_VALUES.ADMIN,
    ROLE_VALUES.SUPER_ADMINISTRATOR,
  ],
  schedule: [
    ROLE_VALUES.STUDENT,
    ROLE_VALUES.GUEST,
    ROLE_VALUES.LECTURER,
    ROLE_VALUES.STAFF,
    ROLE_VALUES.ADMIN,
    ROLE_VALUES.SUPER_ADMINISTRATOR,
  ],
  "booking-rooms": [
    ROLE_VALUES.STUDENT,
    ROLE_VALUES.GUEST,
    ROLE_VALUES.LECTURER,
    ROLE_VALUES.STAFF,
    ROLE_VALUES.ADMIN,
    ROLE_VALUES.SUPER_ADMINISTRATOR,
  ],
  "borrow-equipment": [
    ROLE_VALUES.STUDENT,
    ROLE_VALUES.GUEST,
    ROLE_VALUES.LECTURER,
    ROLE_VALUES.STAFF,
    ROLE_VALUES.ADMIN,
    ROLE_VALUES.SUPER_ADMINISTRATOR,
  ],
  "sample-testing": [
    ROLE_VALUES.STUDENT,
    ROLE_VALUES.GUEST,
    ROLE_VALUES.LECTURER,
    ROLE_VALUES.STAFF,
    ROLE_VALUES.ADMIN,
    ROLE_VALUES.SUPER_ADMINISTRATOR,
  ],
  notifications: [
    ROLE_VALUES.STUDENT,
    ROLE_VALUES.GUEST,
    ROLE_VALUES.LECTURER,
    ROLE_VALUES.STAFF,
    ROLE_VALUES.ADMIN,
    ROLE_VALUES.SUPER_ADMINISTRATOR,
  ],
  "my-profile": [
    ROLE_VALUES.STUDENT,
    ROLE_VALUES.GUEST,
    ROLE_VALUES.LECTURER,
    ROLE_VALUES.STAFF,
    ROLE_VALUES.ADMIN,
    ROLE_VALUES.SUPER_ADMINISTRATOR,
  ],
  "bebas-laboratorium": [
    ROLE_VALUES.STUDENT,
    ROLE_VALUES.ADMIN,
    ROLE_VALUES.SUPER_ADMINISTRATOR,
  ],
} as const;

function normalizeRoleValue(role?: string | null): string {
  if (!role) return "";
  const normalized = ROLE_NORMALIZATION_MAP[String(role).trim().toUpperCase()];
  if (normalized) return normalized;
  return String(role).trim();
}

function isPrivilegedRole(role?: string | null): boolean {
  const normalized = normalizeRoleValue(role);
  if (!normalized) return false;
  return (
    normalized === ROLE_VALUES.ADMIN ||
    normalized === ROLE_VALUES.SUPER_ADMINISTRATOR
  );
}

function hasMenuAccess(
  role: string | null | undefined,
  menuId: keyof typeof MENU_ACCESS_RULES,
): boolean {
  const normalized = normalizeRoleValue(role);
  if (!normalized) return false;
  return MENU_ACCESS_RULES[menuId].includes(normalized);
}

export {
  ROLE_VALUES,
  ROLE_LABELS,
  ROLE_OPTIONS,
  ROLE_FILTER_OPTIONS,
  MENU_ACCESS_RULES,
  normalizeRoleValue,
  isPrivilegedRole,
  hasMenuAccess,
};
