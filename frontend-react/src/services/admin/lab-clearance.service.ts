import { API_AUTH_USERS, API_LAB_CLEARANCE_CHECK } from "@/constants/api";
import { authFetch } from "@/lib/auth";
import { mapUser, type UserRow } from "@/services/shared/resources/users.service";

export type { UserRow };

export type LabClearanceActiveService = {
  id: string;
  code: string;
  type: "borrow" | "booking" | "use" | "pengujian";
  label: string;
  status: string;
  startTime: string;
  endTime: string | null;
};

export type LabClearanceResult = {
  profileId: string;
  fullName: string;
  idNumber: string | null;
  email: string;
  department: string | null;
  batch: string | null;
  role: string;
  isClear: boolean;
  activeServices: LabClearanceActiveService[];
  summary: {
    totalActive: number;
    borrowCount: number;
    bookingCount: number;
    useCount: number;
    pengujianCount: number;
  };
};

type ApiActiveService = {
  id?: string | null;
  code?: string | null;
  type?: string | null;
  label?: string | null;
  status?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

type ApiLabClearanceResponse = {
  profile_id?: string | null;
  full_name?: string | null;
  id_number?: string | null;
  email?: string | null;
  department?: string | null;
  batch?: string | null;
  role?: string | null;
  is_clear?: boolean | null;
  active_services?: ApiActiveService[] | null;
  summary?: {
    total_active?: number | null;
    borrow_count?: number | null;
    booking_count?: number | null;
    use_count?: number | null;
    pengujian_count?: number | null;
  } | null;
};

function mapLabClearance(data: ApiLabClearanceResponse): LabClearanceResult {
  return {
    profileId: String(data.profile_id ?? ""),
    fullName: String(data.full_name ?? "-"),
    idNumber: data.id_number ? String(data.id_number) : null,
    email: String(data.email ?? "-"),
    department: data.department ? String(data.department) : null,
    batch: data.batch ? String(data.batch) : null,
    role: String(data.role ?? "-"),
    isClear: Boolean(data.is_clear),
    activeServices: Array.isArray(data.active_services)
      ? data.active_services.map((s) => ({
          id: String(s.id ?? ""),
          code: String(s.code ?? "-"),
          type: (s.type ?? "borrow") as LabClearanceActiveService["type"],
          label: String(s.label ?? "-"),
          status: String(s.status ?? "-"),
          startTime: String(s.start_time ?? ""),
          endTime: s.end_time ? String(s.end_time) : null,
        }))
      : [],
    summary: {
      totalActive: Number(data.summary?.total_active ?? 0),
      borrowCount: Number(data.summary?.borrow_count ?? 0),
      bookingCount: Number(data.summary?.booking_count ?? 0),
      useCount: Number(data.summary?.use_count ?? 0),
      pengujianCount: Number(data.summary?.pengujian_count ?? 0),
    },
  };
}

export const labClearanceService = {
  async searchUsers(search: string, signal?: AbortSignal): Promise<UserRow[]> {
    const url = new URL(API_AUTH_USERS, window.location.origin);
    if (search) url.searchParams.set("q", search);
    url.searchParams.set("page_size", "20");

    const response = await authFetch(url.toString(), { method: "GET", signal });
    if (!response.ok) {
      throw new Error(`Gagal mencari pengguna (${response.status})`);
    }
    const payload = await response.json();
    const list = Array.isArray(payload) ? payload : Array.isArray(payload.results) ? payload.results : [];
    return list.map(mapUser);
  },

  async getLabClearance(profileId: string, signal?: AbortSignal): Promise<LabClearanceResult> {
    const url = new URL(API_LAB_CLEARANCE_CHECK, window.location.origin);
    url.searchParams.set("profile_id", profileId);

    const response = await authFetch(url.toString(), { method: "GET", signal });
    if (!response.ok) {
      throw new Error(`Gagal mengambil data bebas tanggungan (${response.status})`);
    }
    const data = (await response.json()) as ApiLabClearanceResponse;
    return mapLabClearance(data);
  },
};
