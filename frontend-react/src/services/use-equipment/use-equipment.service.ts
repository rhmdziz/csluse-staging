import {
  API_USE_APPROVE,
  API_USE_COMPLETE,
  API_USE_DETAIL,
  API_USE_REJECT,
  API_USES,
  API_USES_ALL,
  API_USES_MY,
} from "@/constants/api";
import { authFetch } from "@/lib/auth";

export type UseServiceFilters = {
  q?: string;
  status?: string;
  department?: string;
  equipment?: string;
  room?: string;
  createdAfter?: string;
  createdBefore?: string;
  requestedBy?: string;
};

export type UseServiceListScope = "default" | "my" | "all" | "admin-all";

export type CreateUsePayload = {
  equipmentId: string;
  quantity: number;
  startTime: string;
  endTime?: string;
  purpose: string;
  note?: string;
  requesterPhone?: string;
  requesterMentor?: string;
  requesterMentorProfileId?: string;
  institution?: string;
  institutionAddress?: string;
};

export type UseStatusActionType = "approve" | "reject" | "complete";

type MutationResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; data?: unknown; text?: string };

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

export const useEquipmentService = {
  async getList(
    page: number,
    pageSize: number,
    filters: UseServiceFilters = {},
    scope: UseServiceListScope = "default",
    signal?: AbortSignal,
  ) {
    const listEndpoint =
      scope === "my" ? API_USES_MY : (scope === "all" || scope === "admin-all") ? API_USES_ALL : API_USES;
    const url = new URL(listEndpoint, window.location.origin);

    if (scope === "admin-all") url.searchParams.set("unscoped", "1");

    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));
    if (filters.q) url.searchParams.set("q", filters.q);
    if (filters.status) url.searchParams.set("status", filters.status);
    if (filters.requestedBy && scope !== "my") {
      url.searchParams.set("requested_by", filters.requestedBy);
    }
    if (filters.department) url.searchParams.set("department", filters.department);
    if (filters.equipment) url.searchParams.set("equipment", filters.equipment);
    if (filters.room) url.searchParams.set("room", filters.room);
    if (filters.createdAfter) {
      url.searchParams.set("created_after", filters.createdAfter);
    }
    if (filters.createdBefore) {
      url.searchParams.set("created_before", filters.createdBefore);
    }

    const response = await authFetch(url.toString(), { method: "GET", signal });
    if (!response.ok) {
      throw new Error(`Gagal memuat data penggunaan alat (${response.status})`);
    }

    return (await response.json()) as unknown;
  },

  async getDetail(id: string | number, signal?: AbortSignal) {
    const response = await authFetch(API_USE_DETAIL(id), {
      method: "GET",
      signal,
    });
    if (!response.ok) {
      throw new Error(`Gagal memuat detail penggunaan alat (${response.status})`);
    }

    return (await response.json()) as unknown;
  },

  async create(payload: CreateUsePayload) {
    const body = buildUsePayload(payload);

    const response = await authFetch(API_USES, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return parseMutationResponse(response);
  },

  async update(useId: string | number, payload: CreateUsePayload) {
    const body = buildUsePayload(payload);

    const response = await authFetch(API_USE_DETAIL(useId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return parseMutationResponse(response);
  },

  async remove(useId: string | number) {
    const response = await authFetch(API_USE_DETAIL(useId), {
      method: "DELETE",
    });

    return parseMutationResponse(response);
  },

  async updateStatus(
    useId: string | number,
    type: UseStatusActionType,
    payload?: { rejectionNote?: string },
  ) {
    const response = await authFetch(
      type === "approve"
        ? API_USE_APPROVE(useId)
        : type === "reject"
          ? API_USE_REJECT(useId)
          : API_USE_COMPLETE(useId),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          type === "reject" && payload?.rejectionNote?.trim()
            ? { rejection_note: payload.rejectionNote.trim() }
            : {},
        ),
      },
    );

    return parseMutationResponse(response);
  },
};

function buildUsePayload(payload: CreateUsePayload) {
    const body: Record<string, string | number> = {
      equipment: payload.equipmentId,
      quantity: payload.quantity,
      start_time: payload.startTime,
      purpose: payload.purpose.trim(),
    };

    if (payload.endTime?.trim()) body.end_time = payload.endTime.trim();
    if (payload.note?.trim()) body.note = payload.note.trim();
    if (payload.requesterPhone?.trim()) body.requester_phone = payload.requesterPhone.trim();
    if (payload.requesterMentor?.trim()) body.requester_mentor = payload.requesterMentor.trim();
    if (payload.requesterMentorProfileId?.trim()) {
      body.requester_mentor_profile = payload.requesterMentorProfileId.trim();
    }
    if (payload.institution?.trim()) body.institution = payload.institution.trim();
    if (payload.institutionAddress?.trim()) {
      body.institution_address = payload.institutionAddress.trim();
    }
    return body;
}
