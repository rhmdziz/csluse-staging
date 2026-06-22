import {
  API_AUTH_DEPARTMENTS,
  API_AUTH_DEPARTMENTS_BULK_DELETE,
  API_AUTH_DEPARTMENT_DETAIL,
  API_USERS_DEPARTMENTS,
} from "@/constants/api";
import { authFetch } from "@/lib/auth";

export type DepartmentRow = {
  id: string;
  name: string;
  profileCount: number;
  createdAt: string;
  updatedAt: string;
};

export type DepartmentFilters = {
  search?: string;
  q?: string;
};

export type DepartmentOption = {
  id: string;
  label: string;
  value: string;
};

type ApiDepartment = {
  id?: string | number | null;
  name?: string | null;
  profile_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ApiDepartmentsResponse = {
  count?: number;
  results?: ApiDepartment[];
};

type MutationResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; data?: unknown; text?: string };

export function mapDepartment(item: ApiDepartment): DepartmentRow {
  return {
    id: String(item.id ?? ""),
    name: String(item.name ?? "-"),
    profileCount: Number(item.profile_count ?? 0),
    createdAt: String(item.created_at ?? ""),
    updatedAt: String(item.updated_at ?? ""),
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

export const departmentsService = {
  async getOptions(signal?: AbortSignal) {
    const response = await authFetch(API_USERS_DEPARTMENTS, { method: "GET", signal });
    if (!response.ok) {
      throw new Error(`Gagal memuat daftar department (${response.status})`);
    }

    const payload = (await response.json()) as ApiDepartment[];
    return Array.isArray(payload)
      ? payload
          .map((item) => {
            const name = String(item.name ?? "").trim();
            const id = String(item.id ?? "").trim();
            if (!name || !id) return null;
            return { id, value: name, label: name };
          })
          .filter((item): item is DepartmentOption => item !== null)
      : [];
  },

  async getList(
    page: number,
    pageSize = 20,
    filters: DepartmentFilters = {},
    signal?: AbortSignal,
  ) {
    const url = new URL(API_AUTH_DEPARTMENTS, window.location.origin);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));
    if (filters.search) url.searchParams.set("search", filters.search);
    if (filters.q) url.searchParams.set("q", filters.q);

    const response = await authFetch(url.toString(), { method: "GET", signal });
    if (!response.ok) {
      throw new Error(`Gagal memuat department (${response.status})`);
    }

    return (await response.json()) as ApiDepartmentsResponse | ApiDepartment[];
  },

  async create(name: string) {
    const response = await authFetch(API_AUTH_DEPARTMENTS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    return parseMutationResponse(response);
  },

  async update(id: string | number, name: string) {
    const response = await authFetch(API_AUTH_DEPARTMENT_DETAIL(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    return parseMutationResponse(response);
  },

  async remove(id: string | number) {
    const response = await authFetch(API_AUTH_DEPARTMENT_DETAIL(id), {
      method: "DELETE",
    });
    return parseMutationResponse(response);
  },

  async bulkRemove(ids: Array<string | number>) {
    const response = await authFetch(API_AUTH_DEPARTMENTS_BULK_DELETE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: ids
          .map((id) => String(id).trim())
          .filter((id) => Boolean(id)),
      }),
    });
    return parseMutationResponse(response);
  },
};
