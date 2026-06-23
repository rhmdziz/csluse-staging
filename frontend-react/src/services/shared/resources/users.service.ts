import {
  API_AUTH_ASSIGNED_PIC_USERS_DROPDOWN,
  API_AUTH_ADMIN_PROFILE_DETAIL,
  API_AUTH_ADMIN_PROFILE_CONFIRM_USER,
  API_AUTH_ADMIN_PROFILE,
  API_AUTH_PIC_USERS,
  API_AUTH_PIC_USERS_BULK_ASSIGN,
  API_AUTH_PIC_USERS_BULK_REMOVE_ASSIGNMENTS,
  API_AUTH_PIC_USERS_DROPDOWN,
  API_AUTH_PIC_USER_REMOVE_ASSIGNMENTS,
  API_AUTH_REGISTER,
  API_AUTH_USERS,
  API_AUTH_USERS_BULK_DELETE,
  API_USERS_MENTORS_DROPDOWN,
} from "@/constants/api";
import { normalizeRoleValue } from "@/constants/roles";
import { authFetch } from "@/lib/auth";

export type UserFilters = {
  department?: string;
  role?: string;
  batch?: string;
  search?: string;
  q?: string;
  isMentor?: boolean;
  hasUser?: boolean;
};

type ApiUserProfile = {
  id?: number | string | null;
  full_name?: string | null;
  initials?: string | null;
  email?: string | null;
  last_login?: string | null;
  role?: string | null;
  is_mentor?: boolean | null;
  user_type?: string | null;
  batch?: string | number | null;
  department?: string | null;
  id_number?: string | null;
  institution?: string | null;
};

type ApiUser = {
  id?: number | string | null;
  username?: string | null;
  email?: string | null;
  is_verified?: boolean | null;
  profile?: ApiUserProfile | null;
};

type ApiUsersResponse = {
  count?: number;
  results?: ApiUser[];
  aggregates?: {
    total?: number;
    student?: number;
    lecturer?: number;
    admin?: number;
    staff?: number;
    guest?: number;
  } | null;
};

type ApiAdminProfile = {
  id?: number | string | null;
  user_id?: number | string | null;
  is_verified?: boolean | null;
  email?: string | null;
  full_name?: string | null;
  initials?: string | null;
  role?: string | null;
  is_mentor?: boolean | null;
  user_type?: string | null;
  batch?: string | number | null;
  department?: string | null;
  id_number?: string | null;
  institution?: string | null;
  last_login?: string | null;
  has_user?: boolean | null;
  status?: string | null;
};

type ApiAdminProfilesResponse = {
  count?: number;
  results?: ApiAdminProfile[];
  aggregates?: {
    total?: number;
    student?: number;
    lecturer?: number;
    admin?: number;
    staff?: number;
    guest?: number;
    pre_provisioned?: number;
    active?: number;
  } | null;
};

export type UserRow = {
  id: number | string;
  uid: number | string;
  profileId: number | string | null;
  userId: number | string | null;
  name: string;
  initials: string;
  email: string;
  role: string;
  isMentor: boolean;
  userType: string;
  batch: string;
  department: string;
  idNumber: string;
  institution: string;
  isVerified: boolean;
  hasUser: boolean;
  status: "active" | "pre_provisioned";
  lastLogin: string;
};

export type UserRoleAggregates = {
  total: number;
  student: number;
  lecturer: number;
  admin: number;
  staff: number;
  guest: number;
  preProvisioned: number;
  active: number;
};

export type CreateUserPayload = {
  full_name: string;
  initials?: string;
  institution?: string;
  email: string;
  username: string;
  password1: string;
  password2: string;
  role?: string;
  is_mentor?: boolean;
  department?: string;
  batch?: string;
  id_number?: string;
  user_type?: string;
};

export type CreateProfilePayload = {
  full_name: string;
  initials?: string;
  institution?: string;
  email: string;
  role?: string;
  is_mentor?: boolean;
  department?: string;
  batch?: string;
  id_number?: string;
  user_type?: string;
};

export type UpdateUserProfilePayload = {
  full_name?: string;
  initials?: string;
  is_mentor?: boolean;
  department?: string | null;
  batch?: string | null;
  id_number?: string | null;
  role?: string | null;
  user_type?: string | null;
  institution?: string | null;
};

export type MentorOption = {
  id: string;
  label: string;
};

export type PicUser = {
  id: string;
  name: string;
  role: string | null;
  department: string | null;
};

export type RoomPicTaskUserRow = UserRow & {
  roomNames?: string[];
  roomAssignments?: RoomPicTaskAssignment[];
};

export type RoomPicTaskAssignment = {
  id: string;
  name: string;
  number: string;
  label: string;
};

type ApiMentorOption = {
  id?: string | number | null;
  name?: string | null;
};

type ApiPicUser = {
  id?: string | number | null;
  name?: string | null;
  role?: string | null;
  department?: string | null;
};

type ApiRoomPicUser = {
  id?: string | number | null;
  email?: string | null;
  profile_id?: string | null;
  full_name?: string | null;
  role?: string | null;
  department?: string | null;
  id_number?: string | null;
  room_names?: string[] | null;
  room_assignments?: Array<{
    id?: string | number | null;
    name?: string | null;
    number?: string | number | null;
    label?: string | null;
  }> | null;
  is_mentor?: boolean | null;
};

export type RoomPicTaskUsersFilters = {
  department?: string;
  role?: string;
  room?: string;
  search?: string;
};

export type BulkAssignRoomPicPayload = {
  roomIds: string[];
  picIds: string[];
};

export type BulkAssignRoomPicResult = {
  assigned_room_count?: number;
  assigned_pic_count?: number;
  created_assignment_count?: number;
  skipped_existing_count?: number;
  room_ids?: string[];
  pic_ids?: string[];
};

type MutationResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; data?: unknown; text?: string };

export function mapUser(item: ApiUser): UserRow {
  const fallbackId = String(item.email ?? item.username ?? "user");
  const rawId = item.id ?? item.email ?? item.username ?? fallbackId;
  const profile = item.profile ?? {};
  const email = item.email ?? profile.email ?? "-";
  const name = profile.full_name ?? item.username ?? "-";

  return {
    id: rawId,
    uid: rawId,
    profileId: profile.id ?? null,
    userId: item.id ?? null,
    name: String(name),
    initials: String(profile.initials ?? ""),
    email: String(email),
    role: normalizeRoleValue(profile.role) || "-",
    isMentor: Boolean(profile.is_mentor),
    userType: String(profile.user_type ?? "-"),
    batch: String(profile.batch ?? "-"),
    department: String(profile.department ?? "-"),
    idNumber: String(profile.id_number ?? "-"),
    institution: String(profile.institution ?? "-"),
    isVerified: Boolean(item.is_verified),
    hasUser: true,
    status: "active",
    lastLogin: String(profile.last_login ?? ""),
  };
}

export function mapProfile(item: ApiAdminProfile): UserRow {
  const rawId = item.id ?? item.email ?? "profile";
  const hasUser = Boolean(item.has_user ?? item.user_id);

  return {
    id: rawId,
    uid: rawId,
    profileId: item.id ?? null,
    userId: item.user_id ?? null,
    name: String(item.full_name ?? item.email ?? "-"),
    initials: String(item.initials ?? ""),
    email: String(item.email ?? "-"),
    role: normalizeRoleValue(item.role) || "-",
    isMentor: Boolean(item.is_mentor),
    userType: String(item.user_type ?? "-"),
    batch: String(item.batch ?? "-"),
    department: String(item.department ?? "-"),
    idNumber: String(item.id_number ?? "-"),
    institution: String(item.institution ?? "-"),
    isVerified: Boolean(item.is_verified),
    hasUser,
    status: hasUser ? "active" : "pre_provisioned",
    lastLogin: String(item.last_login ?? ""),
  };
}

function mapPicUser(user: ApiPicUser): PicUser | null {
  if (!user.id) return null;

  const role = user.role ? String(user.role) : null;
  const baseName = String(user.name ?? "-");

  return {
    id: String(user.id),
    name: role ? `${baseName} (${role})` : baseName,
    role,
    department: user.department ? String(user.department) : null,
  };
}

function mapRoomPicUser(item: ApiRoomPicUser): RoomPicTaskUserRow {
  const rawId = item.profile_id ?? item.id ?? item.email ?? "user";
  const roomAssignments = Array.isArray(item.room_assignments)
    ? item.room_assignments
        .filter((room): room is NonNullable<ApiRoomPicUser["room_assignments"]>[number] => Boolean(room?.id))
        .map((room) => {
          const name = String(room?.name ?? "-");
          const number = String(room?.number ?? "");
          return {
            id: String(room?.id),
            name,
            number,
            label: String(room?.label ?? (number ? `${name} (${number})` : name)),
          };
        })
    : [];

  return {
    id: rawId,
    uid: rawId,
    profileId: item.profile_id ? String(item.profile_id) : null,
    userId: item.id ?? null,
    name: String(item.full_name ?? item.email ?? "-"),
    initials: "",
    email: String(item.email ?? "-"),
    role: normalizeRoleValue(item.role) || "-",
    isMentor: Boolean(item.is_mentor),
    userType: "-",
    batch: "-",
    department: String(item.department ?? "-"),
    idNumber: String(item.id_number ?? "-"),
    institution: "-",
    isVerified: false,
    hasUser: true,
    status: "active",
    lastLogin: "",
    roomAssignments,
    roomNames: Array.isArray(item.room_names)
      ? item.room_names.map((name) => String(name)).filter(Boolean)
      : roomAssignments.map((room) => room.label),
  };
}

async function parseMutationResponse(response: Response): Promise<MutationResult> {
  const raw = await response.text();
  let data: unknown;

  if (raw) {
    try {
      data = JSON.parse(raw) as unknown;
    } catch {
      data = undefined;
    }
  }

  if (response.ok) {
    return { ok: true, data };
  }

  return { ok: false, status: response.status, data, text: raw || undefined };
}

export const usersService = {
  async getList(
    page: number,
    pageSize = 20,
    filters: UserFilters = {},
    signal?: AbortSignal,
  ) {
    const url = new URL(API_AUTH_ADMIN_PROFILE, window.location.origin);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));
    if (filters.department) url.searchParams.set("department", filters.department);
    if (filters.role) url.searchParams.set("role", filters.role);
    if (filters.batch) url.searchParams.set("batch", filters.batch);
    if (filters.search) url.searchParams.set("search", filters.search);
    if (filters.q) url.searchParams.set("q", filters.q);
    if (typeof filters.hasUser === "boolean") {
      url.searchParams.set("has_user", String(filters.hasUser));
    }
    if (typeof filters.isMentor === "boolean") {
      url.searchParams.set("is_mentor", String(filters.isMentor));
    }

    const response = await authFetch(url.toString(), { method: "GET", signal });
    if (!response.ok) {
      throw new Error(`Gagal memuat data profile (${response.status})`);
    }

    return (await response.json()) as ApiAdminProfilesResponse | ApiAdminProfile[];
  },

  async getDetail(userId: string | number, signal?: AbortSignal) {
    const response = await authFetch(API_AUTH_ADMIN_PROFILE_DETAIL(userId), {
      method: "GET",
      signal,
    });
    if (!response.ok) {
      throw new Error(`Gagal memuat detail profile (${response.status})`);
    }

    return (await response.json()) as ApiAdminProfile;
  },

  async create(payload: CreateUserPayload, signal?: AbortSignal) {
    const response = await authFetch(API_AUTH_REGISTER, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify(payload),
    });

    return parseMutationResponse(response);
  },

  async createProfile(payload: CreateProfilePayload, signal?: AbortSignal) {
    const response = await authFetch(API_AUTH_ADMIN_PROFILE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify(payload),
    });

    return parseMutationResponse(response);
  },

  async updateProfile(profileId: string | number, payload: UpdateUserProfilePayload) {
    const response = await authFetch(API_AUTH_ADMIN_PROFILE_DETAIL(profileId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return parseMutationResponse(response);
  },

  async confirmUser(profileId: string | number) {
    const response = await authFetch(API_AUTH_ADMIN_PROFILE_CONFIRM_USER(profileId), {
      method: "POST",
    });
    return parseMutationResponse(response);
  },

  async remove(userId: number | string) {
    const response = await authFetch(`${API_AUTH_USERS}${userId}/`, {
      method: "DELETE",
    });
    return parseMutationResponse(response);
  },

  async removeProfile(profileId: number | string) {
    const response = await authFetch(API_AUTH_ADMIN_PROFILE_DETAIL(profileId), {
      method: "DELETE",
    });
    return parseMutationResponse(response);
  },

  async bulkRemove(userIds: Array<number | string>) {
    const response = await authFetch(API_AUTH_USERS_BULK_DELETE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: userIds
          .map((id) => String(id).trim())
          .filter((id) => Boolean(id)),
      }),
    });
    return parseMutationResponse(response);
  },

  async getMentorOptions(signal?: AbortSignal) {
    const response = await authFetch(API_USERS_MENTORS_DROPDOWN, {
      method: "GET",
      signal,
    });
    if (!response.ok) {
      throw new Error(`Gagal memuat dosen pembimbing (${response.status}).`);
    }
    const payload = (await response.json()) as ApiMentorOption[];
    return Array.isArray(payload)
      ? payload
          .map((item) => (item.id ? { id: String(item.id), label: String(item.name ?? "-") } : null))
          .filter((item): item is MentorOption => item !== null)
      : [];
  },

  async getPicUsers(signal?: AbortSignal) {
    const response = await authFetch(API_AUTH_PIC_USERS_DROPDOWN, {
      method: "GET",
      signal,
    });
    if (!response.ok) {
      throw new Error(`Gagal memuat data PIC (${response.status})`);
    }
    const list = (await response.json()) as ApiPicUser[];
    return list.map(mapPicUser).filter((item): item is PicUser => item !== null);
  },

  async getAssignedPicUsers(signal?: AbortSignal) {
    const response = await authFetch(API_AUTH_ASSIGNED_PIC_USERS_DROPDOWN, {
      method: "GET",
      signal,
    });
    if (!response.ok) {
      throw new Error(`Gagal memuat data PIC terpasang (${response.status})`);
    }
    const list = (await response.json()) as ApiPicUser[];
    return list.map(mapPicUser).filter((item): item is PicUser => item !== null);
  },

  async getRoomPicTaskUsers(filters: RoomPicTaskUsersFilters = {}, signal?: AbortSignal) {
    const url = new URL(API_AUTH_PIC_USERS, window.location.origin);
    url.searchParams.set("assigned_only", "true");
    if (filters.department) url.searchParams.set("department", filters.department);
    if (filters.role) url.searchParams.set("role", filters.role);
    if (filters.room) url.searchParams.set("room", filters.room);
    if (filters.search) url.searchParams.set("search", filters.search);

    const response = await authFetch(url.toString(), {
      method: "GET",
      signal,
    });
    if (!response.ok) {
      throw new Error(`Gagal memuat data PIC ruangan (${response.status})`);
    }

    const payload = (await response.json()) as ApiRoomPicUser[];
    return payload.map(mapRoomPicUser);
  },

  async removeRoomPicAssignments(userId: string | number) {
    const response = await authFetch(API_AUTH_PIC_USER_REMOVE_ASSIGNMENTS(userId), {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Gagal melepas PIC ruangan (${response.status})`);
    }
    return (await response.json()) as { removed_count?: number };
  },

  async bulkRemoveRoomPicAssignments(ids: Array<number | string>) {
    const normalizedIds = ids
      .map((id) => String(id).trim())
      .filter((id) => Boolean(id));

    const response = await authFetch(API_AUTH_PIC_USERS_BULK_REMOVE_ASSIGNMENTS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: normalizedIds }),
    });
    if (!response.ok) {
      throw new Error(`Gagal melepas PIC ruangan terpilih (${response.status})`);
    }
    return (await response.json()) as {
      removed_count?: number;
      failed_count?: number;
      removed_ids?: Array<number | string>;
      failed_ids?: Array<number | string>;
    };
  },

  async bulkAssignRoomPicAssignments(payload: BulkAssignRoomPicPayload) {
    const response = await authFetch(API_AUTH_PIC_USERS_BULK_ASSIGN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room_ids: payload.roomIds,
        pic_ids: payload.picIds,
      }),
    });

    return parseMutationResponse(response);
  },
};
