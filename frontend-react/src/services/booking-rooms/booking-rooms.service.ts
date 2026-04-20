import {
  API_BOOKINGS,
  API_BOOKINGS_ALL,
  API_BOOKINGS_MY,
  API_BOOKING_APPROVE,
  API_BOOKING_CANCEL,
  API_BOOKING_COMPLETE,
  API_BOOKING_DETAIL,
  API_BOOKING_REJECT,
} from "@/constants/api";
import { authFetch } from "@/lib/auth";

export type BookingServiceFilters = {
  q?: string;
  status?: string;
  purpose?: string;
  requestedBy?: string;
  department?: string;
  room?: string;
  createdAfter?: string;
  createdBefore?: string;
};

export type BookingServiceListScope = "default" | "my" | "all" | "admin-all";

export type CreateBookingRoomPayload = {
  roomId: string;
  purpose: string;
  startTime: string;
  endTime: string;
  attendeeCount: number;
  attendeeNames?: string;
  note?: string;
  requesterPhone?: string;
  requesterMentor?: string;
  requesterMentorProfileId?: string;
  institution?: string;
  institutionAddress?: string;
  workshopTitle?: string;
  workshopPic?: string;
  workshopInstitution?: string;
  equipmentItems?: Array<{
    equipmentId: string;
    quantity: number;
  }>;
};

export type BookingStatusActionType = "approve" | "reject" | "complete" | "cancel";

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

export const bookingRoomsService = {
  async getList(
    page: number,
    pageSize: number,
    filters: BookingServiceFilters = {},
    scope: BookingServiceListScope = "default",
    signal?: AbortSignal,
  ) {
    const listEndpoint =
      scope === "my" ? API_BOOKINGS_MY : (scope === "all" || scope === "admin-all") ? API_BOOKINGS_ALL : API_BOOKINGS;
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
    if (filters.department) url.searchParams.set("department", filters.department);
    if (filters.room) url.searchParams.set("room", filters.room);
    if (filters.createdAfter) {
      url.searchParams.set("created_after", filters.createdAfter);
    }
    if (filters.createdBefore) {
      url.searchParams.set("created_before", filters.createdBefore);
    }

    const response = await authFetch(url.toString(), { method: "GET", signal });
    if (!response.ok) {
      throw new Error(`Gagal memuat data booking (${response.status})`);
    }

    return (await response.json()) as unknown;
  },

  async getDetail(id: string | number, signal?: AbortSignal) {
    const response = await authFetch(API_BOOKING_DETAIL(id), {
      method: "GET",
      signal,
    });
    if (!response.ok) {
      throw new Error(`Gagal memuat detail booking (${response.status})`);
    }

    return (await response.json()) as unknown;
  },

  async create(payload: CreateBookingRoomPayload) {
    const body = buildBookingPayload(payload);

    const response = await authFetch(API_BOOKINGS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return parseMutationResponse(response);
  },

  async update(bookingId: string | number, payload: CreateBookingRoomPayload) {
    const body = buildBookingPayload(payload);

    const response = await authFetch(API_BOOKING_DETAIL(bookingId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return parseMutationResponse(response);
  },

  async remove(bookingId: string | number) {
    const response = await authFetch(API_BOOKING_DETAIL(bookingId), {
      method: "DELETE",
    });

    return parseMutationResponse(response);
  },

  async updateStatus(
    bookingId: string | number,
    type: BookingStatusActionType,
    payload?: { rejectionNote?: string },
  ) {
    const response = await authFetch(
      type === "approve"
        ? API_BOOKING_APPROVE(bookingId)
        : type === "reject"
          ? API_BOOKING_REJECT(bookingId)
          : type === "complete"
            ? API_BOOKING_COMPLETE(bookingId)
            : API_BOOKING_CANCEL(bookingId),
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

function buildBookingPayload(payload: CreateBookingRoomPayload) {
    const body: Record<string, unknown> = {
      room: payload.roomId,
      purpose: payload.purpose.trim(),
      start_time: payload.startTime,
      end_time: payload.endTime,
      attendee_count: payload.attendeeCount,
    };

    if (payload.attendeeNames?.trim()) body.attendee_names = payload.attendeeNames.trim();
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
    if (payload.workshopTitle?.trim()) body.workshop_title = payload.workshopTitle.trim();
    if (payload.workshopPic?.trim()) body.workshop_pic = payload.workshopPic.trim();
    if (payload.workshopInstitution?.trim()) {
      body.workshop_institution = payload.workshopInstitution.trim();
    }
    if (Array.isArray(payload.equipmentItems) && payload.equipmentItems.length > 0) {
      body.equipment_items = payload.equipmentItems.map((item) => ({
        equipment: item.equipmentId.trim(),
        quantity: item.quantity,
      }));
    }
    return body;
}
