import {
  API_BASE_URL,
  API_IMAGE_DETAIL,
  API_IMAGES,
  API_ROOM_DETAIL,
  API_ROOMS,
  API_ROOMS_BULK_CREATE,
  API_ROOMS_BULK_DELETE,
  API_ROOMS_DROPDOWN,
} from "@/constants/api";
import { authFetch } from "@/lib/auth";

export type RoomFilters = {
  floor?: string;
  pic?: string;
  search?: string;
};

export type RoomRow = {
  id: number | string;
  name: string;
  number: string;
  floor: string;
  capacity: string;
  description: string;
  picName: string;
  picIds: string[];
  picNames: string[];
  imageId: string | number | null;
  imageUrl: string;
};

export type RoomDetail = RoomRow;

type ApiRoom = {
  id?: number | string | null;
  name?: string | null;
  number?: string | null;
  floor?: number | string | null;
  capacity?: number | string | null;
  description?: string | null;
  image?: string | number | null;
  pics?: Array<string | number | null> | null;
  pics_detail?: Array<{
    id?: string | number | null;
    full_name?: string | null;
    email?: string | null;
  }> | null;
  image_detail?: { url?: string | null } | null;
};

type ApiRoomsResponse = {
  count?: number;
  results?: ApiRoom[];
};

export type CreateRoomPayload = {
  name: string;
  capacity: string;
  number: string;
  floor: string;
  description?: string;
  picIds?: string[];
};

export type UpdateRoomPayload = {
  name: string;
  number: string;
  floor: string;
  capacity: string;
  description?: string;
  picIds?: string[];
  imageId?: string | number | null;
  imageFile?: File | null;
};

export type BulkRoomRow = Omit<CreateRoomPayload, "picIds"> & {
  index: number;
  picId?: string;
};

export type BulkRoomResult = {
  index: number;
  status: "success" | "error";
  message: string;
};

export type RoomOption = {
  id: string;
  label: string;
  capacity: number;
};

type ApiRoomOption = {
  id?: string | number | null;
  name?: string | null;
  number?: string | null;
  capacity?: number | null;
};

type MutationResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; data?: unknown; text?: string };

function resolveAssetUrl(value?: string | null) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${API_BASE_URL}${value}`;
  return `${API_BASE_URL}/${value}`;
}

export function mapRoom(room: ApiRoom): RoomRow {
  const picIds = Array.isArray(room.pics)
    ? room.pics
        .filter((item): item is string | number => item !== null && item !== undefined)
        .map((item) => String(item))
    : [];
  const picNames = Array.isArray(room.pics_detail)
    ? room.pics_detail
        .map((item) => String(item?.full_name ?? item?.email ?? "").trim())
        .filter(Boolean)
    : [];

  return {
    id: room.id ?? `room-${Math.random().toString(36).slice(2, 8)}`,
    name: String(room.name ?? "-"),
    number: String(room.number ?? "-"),
    floor: String(room.floor ?? "-"),
    capacity: String(room.capacity ?? "-"),
    description: String(room.description ?? ""),
    picName: picNames.length ? picNames.join(", ") : "-",
    picIds,
    picNames,
    imageId: room.image ?? null,
    imageUrl: resolveAssetUrl(room.image_detail?.url ?? ""),
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

export const roomsService = {
  async getList(
    page: number,
    pageSize = 10,
    filters: RoomFilters = {},
    signal?: AbortSignal,
  ) {
    const url = new URL(API_ROOMS, window.location.origin);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));
    if (filters.floor) url.searchParams.set("floor", filters.floor);
    if (filters.pic) url.searchParams.set("pic", filters.pic);
    if (filters.search) url.searchParams.set("search", filters.search);

    const response = await authFetch(url.toString(), { method: "GET", signal });
    if (!response.ok) throw new Error(`Gagal memuat data ruangan (${response.status})`);

    return (await response.json()) as ApiRoomsResponse | ApiRoom[];
  },

  async getDetail(id: string | number, signal?: AbortSignal) {
    const response = await authFetch(API_ROOM_DETAIL(id), {
      method: "GET",
      signal,
    });
    if (!response.ok) {
      throw new Error(`Gagal memuat detail ruangan (${response.status})`);
    }

    return (await response.json()) as ApiRoom;
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

  async create(payload: CreateRoomPayload) {
    const body: Record<string, string | number | string[]> = {
      name: payload.name.trim(),
      capacity: Number(payload.capacity),
      number: payload.number.trim(),
      floor: payload.floor.trim(),
    };

    if (payload.description?.trim()) body.description = payload.description.trim();
    if (payload.picIds?.length) body.pics = payload.picIds;

    const response = await authFetch(API_ROOMS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return parseMutationResponse(response);
  },

  async update(roomId: string | number, payload: UpdateRoomPayload) {
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

    const body: Record<string, string | number | string[] | null> = {
      name: payload.name.trim(),
      number: payload.number.trim(),
      floor: payload.floor.trim(),
      capacity: Number(payload.capacity),
      description: payload.description?.trim() || "",
      pics: payload.picIds ?? [],
    };
    if (nextImageId) body.image = nextImageId;

    const response = await authFetch(API_ROOM_DETAIL(roomId), {
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

  async remove(roomId: string | number) {
    const response = await authFetch(API_ROOM_DETAIL(roomId), {
      method: "DELETE",
    });
    return parseMutationResponse(response);
  },

  async bulkRemove(roomIds: Array<string | number>) {
    const response = await authFetch(API_ROOMS_BULK_DELETE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: roomIds }),
    });
    return parseMutationResponse(response);
  },

  async bulkCreate(rows: BulkRoomRow[]) {
    const response = await authFetch(API_ROOMS_BULK_CREATE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: rows.map((row) => ({
          index: row.index,
          name: row.name.trim(),
          number: row.number.trim(),
          floor: row.floor.trim(),
          capacity: Number(row.capacity),
          description: row.description?.trim() || "",
          pics: row.picId ? [row.picId] : [],
        })),
      }),
    });
    return parseMutationResponse(response);
  },

  async getOptions(signal?: AbortSignal) {
    const response = await authFetch(API_ROOMS_DROPDOWN, {
      method: "GET",
      signal,
    });
    if (!response.ok) throw new Error(`Gagal memuat data ruangan (${response.status}).`);

    const list = (await response.json()) as ApiRoomOption[];
    return list
      .filter((room) => room.id)
      .map((room) => ({
        id: String(room.id),
        label: room.number ? `${room.name ?? "-"} (${room.number})` : String(room.name ?? "-"),
        capacity: Number(room.capacity ?? 0),
      }));
  },
};
