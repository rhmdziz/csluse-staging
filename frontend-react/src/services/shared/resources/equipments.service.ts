import {
  API_BASE_URL,
  API_EQUIPMENT_DETAIL,
  API_EQUIPMENTS,
  API_EQUIPMENTS_BULK_CREATE,
  API_EQUIPMENTS_BULK_DELETE,
  API_EQUIPMENTS_BULK_SET_BORROWABLE,
  API_EQUIPMENTS_BULK_SET_SHAREABLE,
  API_EQUIPMENTS_DROPDOWN,
  API_IMAGE_DETAIL,
  API_IMAGES,
} from "@/constants/api";
import { authFetch } from "@/lib/auth";

export type EquipmentFilters = {
  status?: string;
  category?: string;
  room?: string;
  pic?: string;
  is_moveable?: string;
  is_borrowable?: string;
  search?: string;
};

export type EquipmentRow = {
  id: number | string;
  name: string;
  description: string;
  category: string;
  status: string;
  quantity: string;
  roomId: string;
  roomName: string;
  roomNumber: string;
  isMoveable: boolean;
  isShareable: boolean;
  isBorrowable: boolean;
  imageId: string | number | null;
  imageUrl: string;
};

export type EquipmentDetail = EquipmentRow;

type ApiEquipment = {
  id?: number | string | null;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  status?: string | null;
  quantity?: number | string | null;
  is_moveable?: boolean | null;
  is_shareable?: boolean | null;
  is_borrowable?: boolean | null;
  room_detail?: { name?: string | null; number?: string | null } | null;
  room?: string | number | null;
  image?: string | number | null;
  image_detail?: { url?: string | null } | null;
};

type ApiEquipmentsResponse = {
  count?: number;
  results?: ApiEquipment[];
};

export type CreateEquipmentPayload = {
  name: string;
  quantity: string;
  category: string;
  roomId: string;
  isMoveable: boolean;
  isShareable: boolean;
  isBorrowable: boolean;
  description?: string;
};

export type UpdateEquipmentPayload = {
  name: string;
  quantity: string;
  category: string;
  roomId: string;
  status?: string;
  isMoveable: boolean;
  isShareable: boolean;
  isBorrowable: boolean;
  description?: string;
  imageId?: string | number | null;
  imageFile?: File | null;
};

export type BulkEquipmentRow = Omit<CreateEquipmentPayload, "roomId" | "isShareable" | "isBorrowable"> & {
  index: number;
  roomId?: string;
  isShareable?: boolean;
  isBorrowable?: boolean;
};

export type BulkEquipmentResult = {
  index: number;
  status: "success" | "error";
  message: string;
};

export type EquipmentOption = {
  id: string;
  label: string;
  category: string;
  quantity: number;
};

type ApiEquipmentOption = {
  id?: string | number | null;
  name?: string | null;
  category?: string | null;
  quantity?: number | null;
  room_detail?: {
    id?: string | number | null;
    name?: string | null;
  } | null;
};

type MutationResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; data?: unknown; text?: string };

function resolveAssetUrl(value: string | null | undefined) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${API_BASE_URL}${value}`;
  return `${API_BASE_URL}/${value}`;
}

export function mapEquipment(item: ApiEquipment): EquipmentRow {
  return {
    id: item.id ?? `eq-${Math.random().toString(36).slice(2, 8)}`,
    name: String(item.name ?? "-"),
    description: String(item.description ?? ""),
    category: String(item.category ?? "-"),
    status: String(item.status ?? "-"),
    quantity: String(item.quantity ?? "-"),
    roomId: String(item.room ?? ""),
    roomName: String(item.room_detail?.name ?? item.room ?? "-"),
    roomNumber: String(item.room_detail?.number ?? ""),
    isMoveable: Boolean(item.is_moveable),
    isShareable: Boolean(item.is_shareable),
    isBorrowable: Boolean(item.is_borrowable),
    imageId: item.image ?? null,
    imageUrl: resolveAssetUrl(item.image_detail?.url ?? ""),
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

export const equipmentsService = {
  async getList(
    page: number,
    pageSize = 10,
    filters: EquipmentFilters = {},
    signal?: AbortSignal,
  ) {
    const url = new URL(API_EQUIPMENTS, window.location.origin);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));
    if (filters.status) url.searchParams.set("status", filters.status);
    if (filters.category) url.searchParams.set("category", filters.category);
    if (filters.room) url.searchParams.set("room", filters.room);
    if (filters.pic) url.searchParams.set("pic", filters.pic);
    if (filters.is_moveable !== undefined && filters.is_moveable !== "") {
      url.searchParams.set("is_moveable", filters.is_moveable);
    }
    if (filters.is_borrowable !== undefined && filters.is_borrowable !== "") {
      url.searchParams.set("is_borrowable", filters.is_borrowable);
    }
    if (filters.search) url.searchParams.set("search", filters.search);

    const response = await authFetch(url.toString(), { method: "GET", signal });
    if (!response.ok) throw new Error(`Gagal memuat data peralatan (${response.status})`);

    return (await response.json()) as ApiEquipmentsResponse | ApiEquipment[];
  },

  async getDetail(id: string | number, signal?: AbortSignal) {
    const response = await authFetch(API_EQUIPMENT_DETAIL(id), {
      method: "GET",
      signal,
    });
    if (!response.ok) {
      throw new Error(`Gagal memuat detail peralatan (${response.status})`);
    }

    return (await response.json()) as ApiEquipment;
  },

  async uploadImage(file: File) {
    const formData = new FormData();
    formData.append("image", file);

    const response = await authFetch(API_IMAGES, {
      method: "POST",
      body: formData,
    });

    return parseMutationResponse(response);
  },

  async create(payload: CreateEquipmentPayload) {
    const body: Record<string, string | number | boolean> = {
      name: payload.name.trim(),
      quantity: Number(payload.quantity),
      category: payload.category,
      room: payload.roomId,
      is_moveable: payload.isMoveable,
      is_shareable: payload.isShareable,
      is_borrowable: payload.isBorrowable,
    };

    if (payload.description?.trim()) body.description = payload.description.trim();

    const response = await authFetch(API_EQUIPMENTS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return parseMutationResponse(response);
  },

  async update(equipmentId: string | number, payload: UpdateEquipmentPayload) {
    let nextImageId = payload.imageId ?? null;
    if (payload.imageFile) {
      const upload = await this.uploadImage(payload.imageFile);
      if (!upload.ok) return upload;
      const imagePayload = (upload.data ?? {}) as { id?: string | number };
      if (!imagePayload.id) {
        return { ok: false as const, status: 500, data: { detail: "Response gambar tidak valid." } };
      }
      nextImageId = imagePayload.id;
    }

    const body: Record<string, string | number | boolean | null> = {
      name: payload.name.trim(),
      quantity: Number(payload.quantity),
      category: payload.category,
      room: payload.roomId,
      is_moveable: payload.isMoveable,
      is_shareable: payload.isShareable,
      is_borrowable: payload.isBorrowable,
      description: payload.description?.trim() || "",
    };
    if (payload.status?.trim()) body.status = payload.status.trim();
    if (nextImageId) body.image = nextImageId;

    const response = await authFetch(API_EQUIPMENT_DETAIL(equipmentId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await parseMutationResponse(response);

    if (
      result.ok &&
      payload.imageFile &&
      payload.imageId &&
      nextImageId &&
      String(payload.imageId) !== String(nextImageId)
    ) {
      try {
        await authFetch(API_IMAGE_DETAIL(payload.imageId), { method: "DELETE" });
      } catch {
        // ignore cleanup errors
      }
    }

    return result;
  },

  async remove(equipmentId: string | number) {
    const response = await authFetch(API_EQUIPMENT_DETAIL(equipmentId), {
      method: "DELETE",
    });
    return parseMutationResponse(response);
  },

  async bulkRemove(equipmentIds: Array<string | number>) {
    const response = await authFetch(API_EQUIPMENTS_BULK_DELETE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: equipmentIds }),
    });
    return parseMutationResponse(response);
  },

  async bulkSetShareable(equipmentIds: Array<string | number>, value: boolean) {
    const response = await authFetch(API_EQUIPMENTS_BULK_SET_SHAREABLE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: equipmentIds, value }),
    });
    return parseMutationResponse(response);
  },

  async bulkSetBorrowable(equipmentIds: Array<string | number>, value: boolean) {
    const response = await authFetch(API_EQUIPMENTS_BULK_SET_BORROWABLE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: equipmentIds, value }),
    });
    return parseMutationResponse(response);
  },

  async bulkCreate(rows: BulkEquipmentRow[]) {
    const response = await authFetch(API_EQUIPMENTS_BULK_CREATE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: rows.map((row) => ({
          index: row.index,
          name: row.name.trim(),
          quantity: Number(row.quantity),
          category: row.category,
          room: row.roomId || "",
          is_moveable: row.isMoveable,
          is_shareable: row.isShareable ?? false,
          is_borrowable: row.isBorrowable ?? false,
          description: row.description?.trim() || "",
        })),
      }),
    });
    return parseMutationResponse(response);
  },

  async getOptions(
    params: { status?: string; room?: string; isMoveable?: boolean; isBorrowable?: boolean; category?: string } = {},
    signal?: AbortSignal,
  ) {
    const url = new URL(API_EQUIPMENTS_DROPDOWN, window.location.origin);
    if (params.status) url.searchParams.set("status", params.status);
    if (params.room) url.searchParams.set("room", params.room);
    if (params.category) url.searchParams.set("category", params.category);
    if (typeof params.isMoveable === "boolean") {
      url.searchParams.set("is_moveable", String(params.isMoveable));
    }
    if (typeof params.isBorrowable === "boolean") {
      url.searchParams.set("is_borrowable", String(params.isBorrowable));
    }

    const response = await authFetch(url.toString(), { method: "GET", signal });
    if (!response.ok) {
      throw new Error(`Gagal memuat opsi peralatan (${response.status})`);
    }

    const payload = (await response.json()) as ApiEquipmentOption[];
    return payload
      .map((item) => ({
        id: String(item.id ?? ""),
        label: item.room_detail?.name
          ? `${String(item.name ?? "-")} (${String(item.room_detail.name)})`
          : String(item.name ?? "-"),
        category: String(item.category ?? ""),
        quantity: Number(item.quantity ?? 0),
      }))
      .filter((item) => item.id);
  },
};
