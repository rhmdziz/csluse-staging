"use client";

import { useEffect, useState } from "react";

import { borrowEquipmentService } from "@/services/borrow-equipment";

export type BorrowFilters = {
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

export type BorrowListScope = "default" | "my" | "all" | "admin-all";

export type BorrowRow = {
  id: string | number;
  code: string;
  equipmentId: string;
  equipmentName: string;
  roomName: string;
  roomPicName: string;
  roomPicIds: string[];
  requesterId: string;
  requesterName: string;
  requesterDepartment: string;
  requesterRole: string;
  approvedById: string;
  approvedByName: string;
  status: string;
  purpose: string;
  quantity: string;
  startTime: string;
  endTime: string;
  endTimeActual: string;
  createdAt: string;
  updatedAt: string;
  approvedAt: string;
  rejectedAt: string;
  rejectionNote: string;
  expiredAt: string;
  borrowedAt: string;
  returnedPendingInspectionAt: string;
  inspectedAt: string;
  returnedAt: string;
  overdueAt: string;
  lostDamagedAt: string;
  note: string;
  inspectionNote: string;
  requesterPhone: string;
  requesterMentor: string;
  requesterMentorProfileId: string;
  requesterMentorProfileName: string;
  isApprovedByMentor: boolean;
  mentorApprovedAt: string;
  institution: string;
  institutionAddress: string;
};

type ApiBorrow = {
  id?: string | number | null;
  code?: string | null;
  status?: string | null;
  purpose?: string | null;
  note?: string | null;
  inspection_note?: string | null;
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
  quantity?: number | string | null;
  start_time?: string | null;
  end_time?: string | null;
  end_time_actual?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  rejection_note?: string | null;
  expired_at?: string | null;
  borrowed_at?: string | null;
  returned_pending_inspection_at?: string | null;
  inspected_at?: string | null;
  returned_at?: string | null;
  overdue_at?: string | null;
  lost_damaged_at?: string | null;
  equipment?: string | number | null;
  equipment_detail?: {
    id?: string | number | null;
    name?: string | null;
    room_detail?: {
      id?: string | number | null;
      name?: string | null;
      pics_detail?: Array<{
        id?: string | number | null;
        full_name?: string | null;
        email?: string | null;
      }> | null;
    } | null;
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
};

type ApiBorrowsResponse = {
  count?: number;
  results?: ApiBorrow[];
  aggregates?: {
    total?: number;
    pending?: number;
    approved?: number;
    rejected?: number;
    expired?: number;
    borrowed?: number;
    returned_pending_inspection?: number;
    returned?: number;
    overdue?: number;
    lost_damaged?: number;
  } | null;
};

export type BorrowAggregates = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  borrowed: number;
  returned_pending_inspection: number;
  returned: number;
  overdue: number;
  lost_damaged: number;
};

export function mapBorrow(item: ApiBorrow): BorrowRow {
  const requesterName =
    item.requested_by_detail?.full_name ||
    item.requested_by_detail?.email ||
    "-";
  const approvedByName =
    item.approved_by_detail?.full_name ||
    item.approved_by_detail?.email ||
    "-";
  const roomPicName = Array.isArray(item.equipment_detail?.room_detail?.pics_detail)
    ? item.equipment_detail.room_detail.pics_detail
        .map((pic) => String(pic?.full_name ?? pic?.email ?? "").trim())
        .filter(Boolean)
        .join(", ") || "-"
    : "-";
  const roomPicIds = Array.isArray(item.equipment_detail?.room_detail?.pics_detail)
    ? item.equipment_detail.room_detail.pics_detail
        .map((pic) => String(pic?.id ?? "").trim())
        .filter(Boolean)
    : [];

  return {
    id: item.id ?? `borrow-${Math.random().toString(36).slice(2, 8)}`,
    code: String(item.code ?? "-"),
    equipmentId: String(item.equipment_detail?.id ?? item.equipment ?? ""),
    equipmentName: String(item.equipment_detail?.name ?? "-"),
    roomName: String(item.equipment_detail?.room_detail?.name ?? "-"),
    roomPicName,
    roomPicIds,
    requesterId: String(item.requested_by_detail?.id ?? item.requested_by ?? ""),
    requesterName: String(requesterName),
    requesterDepartment: String(item.requested_by_detail?.department ?? "-"),
    requesterRole: String(item.requested_by_detail?.role ?? "-"),
    approvedById: String(item.approved_by_detail?.id ?? item.approved_by ?? ""),
    approvedByName: String(approvedByName),
    status: String(item.status ?? "-"),
    purpose: String(item.purpose ?? "-"),
    quantity: String(item.quantity ?? "-"),
    startTime: String(item.start_time ?? "-"),
    endTime: String(item.end_time ?? "-"),
    endTimeActual: String(item.end_time_actual ?? "-"),
    createdAt: String(item.created_at ?? "-"),
    updatedAt: String(item.updated_at ?? "-"),
    approvedAt: String(item.approved_at ?? "-"),
    rejectedAt: String(item.rejected_at ?? "-"),
    rejectionNote: String(item.rejection_note ?? ""),
    expiredAt: String(item.expired_at ?? "-"),
    borrowedAt: String(item.borrowed_at ?? "-"),
    returnedPendingInspectionAt: String(item.returned_pending_inspection_at ?? "-"),
    inspectedAt: String(item.inspected_at ?? "-"),
    returnedAt: String(item.returned_at ?? "-"),
    overdueAt: String(item.overdue_at ?? "-"),
    lostDamagedAt: String(item.lost_damaged_at ?? "-"),
    note: String(item.note ?? ""),
    inspectionNote: String(item.inspection_note ?? ""),
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
  };
}

export function useBorrowDetail(
  id?: string | number | null,
  reloadKey = 0,
  options?: {
    enabled?: boolean;
    initialBorrow?: BorrowRow | null;
  },
) {
  const enabled = options?.enabled ?? true;
  const [borrow, setBorrow] = useState<BorrowRow | null>(
    options?.initialBorrow ?? null,
  );
  const [isLoading, setIsLoading] = useState(
    enabled && Boolean(id) && !options?.initialBorrow,
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof options?.initialBorrow === "undefined") return;
    setBorrow(options.initialBorrow ?? null);
  }, [options?.initialBorrow]);

  useEffect(() => {
    if (!enabled) {
      setError("");
      setIsLoading(false);
      return;
    }

    if (!id) {
      setBorrow(null);
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
        const payload = (await borrowEquipmentService.getDetail(
          id,
          controller.signal,
        )) as ApiBorrow;
        setBorrow(mapBorrow(payload));
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
    borrow,
    setBorrow,
    isLoading,
    error,
    setError,
  };
}

export function useBorrows(
  page: number,
  pageSize = 10,
  filters: BorrowFilters = {},
  reloadKey = 0,
  scope: BorrowListScope = "default",
  options?: {
    enabled?: boolean;
  },
) {
  const enabled = options?.enabled ?? true;
  const [borrows, setBorrows] = useState<BorrowRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState("");
  const [aggregates, setAggregates] = useState<BorrowAggregates>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    expired: 0,
    borrowed: 0,
    returned_pending_inspection: 0,
    returned: 0,
    overdue: 0,
    lost_damaged: 0,
  });

  useEffect(() => {
    if (!enabled) {
      setBorrows([]);
      setTotalCount(0);
      setAggregates({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        expired: 0,
        borrowed: 0,
        returned_pending_inspection: 0,
        returned: 0,
        overdue: 0,
        lost_damaged: 0,
      });
      setError("");
      setIsLoading(false);
      setHasLoadedOnce(true);
      return;
    }

    if (scope === "my" && !filters.requestedBy) {
      setBorrows([]);
      setTotalCount(0);
      setAggregates({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        expired: 0,
        borrowed: 0,
        returned_pending_inspection: 0,
        returned: 0,
        overdue: 0,
        lost_damaged: 0,
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
        const payload = (await borrowEquipmentService.getList(
          page,
          pageSize,
          filters,
          scope,
          controller.signal,
        )) as ApiBorrowsResponse | ApiBorrow[];
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.results)
            ? payload.results
            : [];
        const mapped = list.map(mapBorrow);

        setBorrows(mapped);
        setTotalCount(Array.isArray(payload) ? mapped.length : (payload.count ?? mapped.length));
        setAggregates({
          total: Array.isArray(payload) ? mapped.length : Number(payload.aggregates?.total ?? 0),
          pending: Array.isArray(payload) ? 0 : Number(payload.aggregates?.pending ?? 0),
          approved: Array.isArray(payload) ? 0 : Number(payload.aggregates?.approved ?? 0),
          rejected: Array.isArray(payload) ? 0 : Number(payload.aggregates?.rejected ?? 0),
          expired: Array.isArray(payload) ? 0 : Number(payload.aggregates?.expired ?? 0),
          borrowed: Array.isArray(payload) ? 0 : Number(payload.aggregates?.borrowed ?? 0),
          returned_pending_inspection: Array.isArray(payload)
            ? 0
            : Number(payload.aggregates?.returned_pending_inspection ?? 0),
          returned: Array.isArray(payload) ? 0 : Number(payload.aggregates?.returned ?? 0),
          overdue: Array.isArray(payload) ? 0 : Number(payload.aggregates?.overdue ?? 0),
          lost_damaged: Array.isArray(payload) ? 0 : Number(payload.aggregates?.lost_damaged ?? 0),
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
    filters.equipment,
    filters.createdAfter,
    filters.createdBefore,
    reloadKey,
    scope,
    enabled,
  ]);

  return {
    borrows,
    setBorrows,
    totalCount,
    setTotalCount,
    aggregates,
    isLoading,
    hasLoadedOnce,
    error,
    setError,
  };
}

export default useBorrows;
