"use client";

import { useEffect, useState } from "react";

import { isLegacyImportedCode } from "@/lib/request";
import { bookingRoomsService } from "@/services/booking-rooms";

export type BookingFilters = {
  q?: string;
  status?: string;
  purpose?: string;
  requestedBy?: string;
  reviewerScope?: "mentor" | "all";
  department?: string;
  room?: string;
  createdAfter?: string;
  createdBefore?: string;
};

export type BookingListScope = "default" | "my" | "all" | "admin-all";

export type BookingRow = {
  id: string | number;
  code: string;
  roomId: string;
  roomName: string;
  roomNumber: string;
  roomPicName: string;
  roomPicIds: string[];
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  requesterDepartment: string;
  requesterRole: string;
  status: string;
  purpose: string;
  startTime: string;
  endTime: string;
  attendeeCount: string;
  attendeeNames: string;
  requesterPhone: string;
  requesterMentor: string;
  requesterMentorProfileId: string;
  requesterMentorProfileName: string;
  isApprovedByMentor: boolean;
  mentorApprovedAt: string;
  institution: string;
  institutionAddress: string;
  workshopTitle: string;
  workshopPic: string;
  workshopInstitution: string;
  createdAt: string;
  updatedAt: string;
  approvedAt: string;
  rejectedAt: string;
  rejectionNote: string;
  expiredAt: string;
  completedAt: string;
  approvedById: string;
  approvedByName: string;
  approvedByEmail: string;
  equipmentId: string;
  equipmentName: string;
  equipmentQty: string;
  equipmentItems: Array<{
    id: string;
    equipmentId: string;
    equipmentName: string;
    quantity: string;
  }>;
  note: string;
};

type ApiBooking = {
  id?: string | number | null;
  code?: string | null;
  requester_name?: string | null;
  room_name?: string | null;
  status?: string | null;
  purpose?: string | null;
  note?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  attendee_count?: number | string | null;
  attendee_names?: string | null;
  requester_phone?: string | null;
  requester_mentor?: string | null;
  requester_mentor_profile_detail?: {
    id?: string | number | null;
    full_name?: string | null;
    email?: string | null;
  } | null;
  is_approved_by_mentor?: boolean | null;
  mentor_approved_at?: string | null;
  institution?: string | null;
  institution_address?: string | null;
  workshop_title?: string | null;
  workshop_pic?: string | null;
  workshop_institution?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  rejection_note?: string | null;
  expired_at?: string | null;
  completed_at?: string | null;
  room?: string | number | null;
  room_detail?: {
    id?: string | number | null;
    name?: string | null;
    number?: string | null;
      pics_detail?: Array<{
        id?: string | number | null;
        full_name?: string | null;
        email?: string | null;
      }> | null;
  } | null;
  requested_by?: string | number | null;
  requested_by_detail?: {
    id?: string | number | null;
    full_name?: string | null;
    email?: string | null;
    role?: string | null;
    department?: string | null;
  } | null;
  approved_by?: string | number | null;
  approved_by_detail?: {
    id?: string | number | null;
    full_name?: string | null;
    email?: string | null;
  } | null;
  equipment_items_detail?: Array<{
    id?: string | number | null;
    quantity?: number | string | null;
    equipment?: string | number | null;
    equipment_detail?: {
      id?: string | number | null;
      name?: string | null;
    } | null;
  }> | null;
};

type ApiBookingsResponse = {
  count?: number;
  results?: ApiBooking[];
  aggregates?: {
    total?: number;
    pending?: number;
    approved?: number;
    completed?: number;
    rejected?: number;
    expired?: number;
  } | null;
};

export type BookingAggregates = {
  total: number;
  pending: number;
  approved: number;
  completed: number;
  rejected: number;
  expired: number;
};

export function mapBooking(item: ApiBooking): BookingRow {
  const requesterName =
    item.requested_by_detail?.full_name ||
    item.requested_by_detail?.email ||
    item.requester_name ||
    "-";
  const approvedByName =
    item.approved_by_detail?.full_name ||
    item.approved_by_detail?.email ||
    "-";
  const roomPicName = Array.isArray(item.room_detail?.pics_detail)
    ? item.room_detail.pics_detail
        .map((pic) => String(pic?.full_name ?? pic?.email ?? "").trim())
        .filter(Boolean)
        .join(", ") || "-"
    : "-";
  const roomPicIds = Array.isArray(item.room_detail?.pics_detail)
    ? item.room_detail.pics_detail
        .map((pic) => String(pic?.id ?? "").trim())
        .filter(Boolean)
    : [];

  const equipmentItems = Array.isArray(item.equipment_items_detail)
    ? item.equipment_items_detail.map((equipmentItem) => ({
        id: String(equipmentItem.id ?? ""),
        equipmentId: String(
          equipmentItem.equipment_detail?.id ?? equipmentItem.equipment ?? "",
        ),
        equipmentName: String(equipmentItem.equipment_detail?.name ?? "-"),
        quantity: String(equipmentItem.quantity ?? "-"),
      }))
    : [];
  const primaryEquipment = equipmentItems[0];
  const equipmentSummary = equipmentItems.length
    ? equipmentItems
        .map((equipmentItem) => `${equipmentItem.equipmentName} (${equipmentItem.quantity})`)
        .join(", ")
    : "-";

  return {
    id: item.id ?? `booking-${Math.random().toString(36).slice(2, 8)}`,
    code: String(item.code ?? "-"),
    roomId: String(item.room_detail?.id ?? item.room ?? ""),
    roomName: String(item.room_detail?.name ?? item.room_name ?? "-"),
    roomNumber: String(item.room_detail?.number ?? "-"),
    roomPicName,
    roomPicIds,
    requesterId: String(item.requested_by_detail?.id ?? item.requested_by ?? ""),
    requesterName: String(requesterName),
    requesterEmail: String(item.requested_by_detail?.email ?? "-"),
    requesterDepartment: String(item.requested_by_detail?.department ?? "-"),
    requesterRole: String(item.requested_by_detail?.role ?? "-"),
    status: String(item.status ?? "-"),
    purpose: String(item.purpose ?? "-"),
    startTime: String(item.start_time ?? "-"),
    endTime: String(item.end_time ?? "-"),
    attendeeCount: String(item.attendee_count ?? "-"),
    attendeeNames: String(item.attendee_names ?? "-"),
    requesterPhone: String(item.requester_phone ?? "-"),
    requesterMentor: String(item.requester_mentor ?? "-"),
    requesterMentorProfileId: String(item.requester_mentor_profile_detail?.id ?? ""),
    requesterMentorProfileName: String(
      item.requester_mentor_profile_detail?.full_name ??
        item.requester_mentor_profile_detail?.email ??
        "-",
    ),
    isApprovedByMentor: Boolean(item.is_approved_by_mentor ?? false),
    mentorApprovedAt: String(item.mentor_approved_at ?? "-"),
    institution: String(item.institution ?? "-"),
    institutionAddress: String(item.institution_address ?? "-"),
    workshopTitle: String(item.workshop_title ?? "-"),
    workshopPic: String(item.workshop_pic ?? "-"),
    workshopInstitution: String(item.workshop_institution ?? "-"),
    createdAt: String(item.created_at ?? "-"),
    updatedAt: String(item.updated_at ?? "-"),
    approvedAt: String(item.approved_at ?? "-"),
    rejectedAt: String(item.rejected_at ?? "-"),
    rejectionNote: String(item.rejection_note ?? ""),
    expiredAt: String(item.expired_at ?? "-"),
    completedAt: String(item.completed_at ?? "-"),
    approvedById: String(item.approved_by_detail?.id ?? item.approved_by ?? ""),
    approvedByName: String(approvedByName),
    approvedByEmail: String(item.approved_by_detail?.email ?? "-"),
    equipmentId: primaryEquipment?.equipmentId ?? "",
    equipmentName: equipmentSummary,
    equipmentQty: equipmentItems.length
      ? equipmentItems.map((equipmentItem) => equipmentItem.quantity).join(", ")
      : "-",
    equipmentItems,
    note: String(item.note ?? ""),
  };
}

export function useBookingDetail(
  id?: string | number | null,
  reloadKey = 0,
  options?: {
    enabled?: boolean;
    initialBooking?: BookingRow | null;
  },
) {
  const enabled = options?.enabled ?? true;
  const [booking, setBooking] = useState<BookingRow | null>(
    options?.initialBooking ?? null,
  );
  const [isLoading, setIsLoading] = useState(
    enabled && Boolean(id) && !options?.initialBooking,
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof options?.initialBooking === "undefined") return;
    setBooking(options.initialBooking ?? null);
  }, [options?.initialBooking]);

  useEffect(() => {
    if (!enabled) {
      setError("");
      setIsLoading(false);
      return;
    }

    if (!id) {
      setBooking(null);
      setError("");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    let isAborted = false;

    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const payload = (await bookingRoomsService.getDetail(
          id,
          controller.signal,
        )) as ApiBooking;
        setBooking(mapBooking(payload));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
      } finally {
        if (isAborted || controller.signal.aborted) return;
        setIsLoading(false);
      }
    };

    void load();

    return () => {
      isAborted = true;
      controller.abort();
    };
  }, [enabled, id, reloadKey]);

  return {
    booking,
    setBooking,
    isLoading,
    error,
    setError,
  };
}

export function useBookings(
  page: number,
  pageSize = 10,
  filters: BookingFilters = {},
  reloadKey = 0,
  scope: BookingListScope = "default",
  options?: {
    enabled?: boolean;
  },
) {
  const enabled = options?.enabled ?? true;
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState("");
  const [aggregates, setAggregates] = useState<BookingAggregates>({
    total: 0,
    pending: 0,
    approved: 0,
    completed: 0,
    rejected: 0,
    expired: 0,
  });

  useEffect(() => {
    if (!enabled) {
      setBookings([]);
      setTotalCount(0);
      setAggregates({
        total: 0,
        pending: 0,
        approved: 0,
        completed: 0,
        rejected: 0,
        expired: 0,
      });
      setError("");
      setIsLoading(false);
      setHasLoadedOnce(true);
      return;
    }

    const controller = new AbortController();
    let isAborted = false;

    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const payload = (await bookingRoomsService.getList(
          page,
          pageSize,
          filters,
          scope,
          controller.signal,
        )) as ApiBookingsResponse | ApiBooking[];
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.results)
            ? payload.results
            : [];
        const mapped = list
          .map(mapBooking)
          .filter((booking) => scope === "admin-all" || !isLegacyImportedCode(booking.code));

        setBookings(mapped);
        setTotalCount(Array.isArray(payload) ? mapped.length : (payload.count ?? mapped.length));
        setAggregates({
          total: Array.isArray(payload) ? mapped.length : Number(payload.aggregates?.total ?? 0),
          pending: Array.isArray(payload) ? 0 : Number(payload.aggregates?.pending ?? 0),
          approved: Array.isArray(payload) ? 0 : Number(payload.aggregates?.approved ?? 0),
          completed: Array.isArray(payload) ? 0 : Number(payload.aggregates?.completed ?? 0),
          rejected: Array.isArray(payload) ? 0 : Number(payload.aggregates?.rejected ?? 0),
          expired: Array.isArray(payload) ? 0 : Number(payload.aggregates?.expired ?? 0),
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
      } finally {
        if (isAborted || controller.signal.aborted) return;
        setIsLoading(false);
        setHasLoadedOnce(true);
      }
    };

    void load();

    return () => {
      isAborted = true;
      controller.abort();
    };
  }, [
    page,
    pageSize,
    filters.q,
    filters.status,
    filters.purpose,
    filters.requestedBy,
    filters.reviewerScope,
    filters.department,
    filters.room,
    filters.createdAfter,
    filters.createdBefore,
    reloadKey,
    scope,
    enabled,
  ]);

  return {
    bookings,
    setBookings,
    totalCount,
    setTotalCount,
    aggregates,
    isLoading,
    hasLoadedOnce,
    error,
    setError,
  };
}

export default useBookings;
