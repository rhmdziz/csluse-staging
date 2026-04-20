import {
  API_BORROW_APPROVE,
  API_BORROW_CANCEL,
  API_BORROW_DETAIL,
  API_BORROW_FINALIZE_RETURN,
  API_BORROW_HANDOVER,
  API_BORROW_MARK_DAMAGED,
  API_BORROW_MARK_LOST,
  API_BORROW_RECEIVE_RETURN,
  API_BORROW_REJECT,
  API_BORROWS,
  API_BORROWS_ALL,
  API_BORROWS_MY,
} from "@/constants/api";
import { authFetch } from "@/lib/auth";

export type BorrowServiceFilters = {
  q?: string;
  status?: string;
  purpose?: string;
  requestedBy?: string;
  reviewerScope?: "mentor" | "all";
  department?: string;
  equipment?: string;
  createdAfter?: string;
  createdBefore?: string;
};

export type BorrowServiceListScope = "default" | "my" | "all" | "admin-all";

export type CreateBorrowPayload = {
  equipmentId: string;
  quantity: number;
  startTime: string;
  endTime: string;
  purpose: string;
  note?: string;
  requesterPhone?: string;
  requesterMentor?: string;
  requesterMentorProfileId?: string;
  institution?: string;
  institutionAddress?: string;
};

export type BorrowStatusActionType =
  | "approve"
  | "reject"
  | "cancel"
  | "handover"
  | "receive_return"
  | "finalize_return"
  | "mark_damaged"
  | "mark_lost";

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

export const borrowEquipmentService = {
  async getList(
    page: number,
    pageSize: number,
    filters: BorrowServiceFilters = {},
    scope: BorrowServiceListScope = "default",
    signal?: AbortSignal,
  ) {
    const listEndpoint =
      scope === "my" ? API_BORROWS_MY : (scope === "all" || scope === "admin-all") ? API_BORROWS_ALL : API_BORROWS;
    const url = new URL(listEndpoint, window.location.origin);

    if (scope === "admin-all") url.searchParams.set("unscoped", "1");

    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));
    if (filters.q) url.searchParams.set("q", filters.q);
    if (filters.status) url.searchParams.set("status", filters.status);
    if (filters.purpose) url.searchParams.set("purpose", filters.purpose);
    if (filters.requestedBy && scope !== "my") {
      url.searchParams.set("requested_by", filters.requestedBy);
    }
    if (filters.reviewerScope) {
      url.searchParams.set("reviewer_scope", filters.reviewerScope);
    }
    if (filters.department) url.searchParams.set("department", filters.department);
    if (filters.equipment) url.searchParams.set("equipment", filters.equipment);
    if (filters.createdAfter) {
      url.searchParams.set("created_after", filters.createdAfter);
    }
    if (filters.createdBefore) {
      url.searchParams.set("created_before", filters.createdBefore);
    }

    const response = await authFetch(url.toString(), { method: "GET", signal });
    if (!response.ok) {
      throw new Error(`Gagal memuat data peminjaman alat (${response.status})`);
    }

    return (await response.json()) as unknown;
  },

  async getDetail(id: string | number, signal?: AbortSignal) {
    const response = await authFetch(API_BORROW_DETAIL(id), {
      method: "GET",
      signal,
    });
    if (!response.ok) {
      throw new Error(`Gagal memuat detail peminjaman alat (${response.status})`);
    }

    return (await response.json()) as unknown;
  },

  async create(payload: CreateBorrowPayload) {
    const body = buildBorrowPayload(payload);

    const response = await authFetch(API_BORROWS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return parseMutationResponse(response);
  },

  async update(borrowId: string | number, payload: CreateBorrowPayload) {
    const body = buildBorrowPayload(payload);

    const response = await authFetch(API_BORROW_DETAIL(borrowId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return parseMutationResponse(response);
  },

  async remove(borrowId: string | number) {
    const response = await authFetch(API_BORROW_DETAIL(borrowId), {
      method: "DELETE",
    });

    return parseMutationResponse(response);
  },

  async updateStatus(
    borrowId: string | number,
    type: BorrowStatusActionType,
    payload?: { endTimeActual?: string; inspectionNote?: string; rejectionNote?: string },
  ) {
    const targetUrl =
      type === "approve"
        ? API_BORROW_APPROVE(borrowId)
        : type === "reject"
          ? API_BORROW_REJECT(borrowId)
          : type === "cancel"
            ? API_BORROW_CANCEL(borrowId)
          : type === "handover"
            ? API_BORROW_HANDOVER(borrowId)
            : type === "receive_return"
              ? API_BORROW_RECEIVE_RETURN(borrowId)
              : type === "finalize_return"
                ? API_BORROW_FINALIZE_RETURN(borrowId)
                : type === "mark_damaged"
                  ? API_BORROW_MARK_DAMAGED(borrowId)
                  : API_BORROW_MARK_LOST(borrowId);

    const body: Record<string, string> = {};
    if (type === "receive_return" && payload?.endTimeActual) {
      body.end_time_actual = payload.endTimeActual;
    }
    if (
      (type === "mark_damaged" || type === "mark_lost") &&
      payload?.inspectionNote?.trim()
    ) {
      body.inspection_note = payload.inspectionNote.trim();
    }
    if (type === "reject" && payload?.rejectionNote?.trim()) {
      body.rejection_note = payload.rejectionNote.trim();
    }

    const response = await authFetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return parseMutationResponse(response);
  },
};

function buildBorrowPayload(payload: CreateBorrowPayload) {
    const body: Record<string, string | number> = {
      equipment: payload.equipmentId,
      quantity: payload.quantity,
      start_time: payload.startTime,
      end_time: payload.endTime,
      purpose: payload.purpose.trim(),
      note: payload.note?.trim() ?? "",
    };

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
