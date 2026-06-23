import {
  API_MATERIAL_DETAIL,
  API_MATERIALS,
  API_MATERIALS_BULK_CREATE,
  API_MATERIALS_BULK_DELETE,
  API_MATERIALS_DROPDOWN,
} from "@/constants/api";
import { authFetch } from "@/lib/auth";

export type MaterialFilters = {
  status?: string;
  category?: string;
  room?: string;
  search?: string;
};

export type MaterialRow = {
  id: number | string;
  name: string;
  description: string;
  category: string;
  status: string;
  quantity: string;
  unit: string;
  roomId: string;
  roomName: string;
  roomNumber: string;
};

export type MaterialDetail = MaterialRow;

type ApiMaterial = {
  id?: number | string | null;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  status?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  room_detail?: { name?: string | null; number?: string | null } | null;
  room?: string | number | null;
};

type ApiMaterialsResponse = {
  count?: number;
  results?: ApiMaterial[];
};

export type CreateMaterialPayload = {
  name: string;
  quantity: string;
  category: string;
  roomId?: string;
  unit?: string;
  description?: string;
};

export type UpdateMaterialPayload = {
  name: string;
  quantity: string;
  category: string;
  roomId?: string;
  status?: string;
  unit?: string;
  description?: string;
};

export type BulkMaterialRow = Omit<CreateMaterialPayload, "roomId"> & {
  index: number;
  roomId?: string;
};

export type BulkMaterialResult = {
  index: number;
  status: "success" | "error";
  message: string;
};

export type MaterialOption = {
  id: string;
  label: string;
  quantity: number;
  unit: string;
};

type ApiMaterialOption = {
  id?: string | number | null;
  name?: string | null;
  quantity?: number | null;
  unit?: string | null;
  room_detail?: {
    id?: string | number | null;
    name?: string | null;
  } | null;
};

type MutationResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; data?: unknown; text?: string };

export function mapMaterial(item: ApiMaterial): MaterialRow {
  return {
    id: item.id ?? `mat-${Math.random().toString(36).slice(2, 8)}`,
    name: String(item.name ?? "-"),
    description: String(item.description ?? ""),
    category: String(item.category ?? "-"),
    status: String(item.status ?? "-"),
    quantity: String(item.quantity ?? "-"),
    unit: String(item.unit ?? ""),
    roomId: String(item.room ?? ""),
    roomName: String(item.room_detail?.name ?? item.room ?? "-"),
    roomNumber: String(item.room_detail?.number ?? ""),
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

export const materialsService = {
  async getList(
    page: number,
    pageSize = 10,
    filters: MaterialFilters = {},
    signal?: AbortSignal,
  ) {
    const url = new URL(API_MATERIALS, window.location.origin);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));
    if (filters.status) url.searchParams.set("status", filters.status);
    if (filters.category) url.searchParams.set("category", filters.category);
    if (filters.room) url.searchParams.set("room", filters.room);
    if (filters.search) url.searchParams.set("search", filters.search);

    const response = await authFetch(url.toString(), { method: "GET", signal });
    if (!response.ok) throw new Error(`Gagal memuat data bahan (${response.status})`);

    return (await response.json()) as ApiMaterialsResponse | ApiMaterial[];
  },

  async getDetail(id: string | number, signal?: AbortSignal) {
    const response = await authFetch(API_MATERIAL_DETAIL(id), {
      method: "GET",
      signal,
    });
    if (!response.ok) {
      throw new Error(`Gagal memuat detail bahan (${response.status})`);
    }

    return (await response.json()) as ApiMaterial;
  },

  async create(payload: CreateMaterialPayload) {
    const body: Record<string, string | number | boolean | null> = {
      name: payload.name.trim(),
      quantity: Number(payload.quantity),
      category: payload.category,
    };

    if (payload.roomId?.trim()) body.room = payload.roomId.trim();
    if (payload.unit?.trim()) body.unit = payload.unit.trim();
    if (payload.description?.trim()) body.description = payload.description.trim();

    const response = await authFetch(API_MATERIALS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return parseMutationResponse(response);
  },

  async update(materialId: string | number, payload: UpdateMaterialPayload) {
    const body: Record<string, string | number | boolean | null> = {
      name: payload.name.trim(),
      quantity: Number(payload.quantity),
      category: payload.category,
      description: payload.description?.trim() || "",
      unit: payload.unit?.trim() || "",
    };
    if (payload.roomId?.trim()) body.room = payload.roomId.trim();
    if (payload.status?.trim()) body.status = payload.status.trim();

    const response = await authFetch(API_MATERIAL_DETAIL(materialId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return parseMutationResponse(response);
  },

  async remove(materialId: string | number) {
    const response = await authFetch(API_MATERIAL_DETAIL(materialId), {
      method: "DELETE",
    });
    return parseMutationResponse(response);
  },

  async bulkRemove(materialIds: Array<string | number>) {
    const response = await authFetch(API_MATERIALS_BULK_DELETE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: materialIds }),
    });
    return parseMutationResponse(response);
  },

  async bulkCreate(rows: BulkMaterialRow[], signal?: AbortSignal) {
    const response = await authFetch(API_MATERIALS_BULK_CREATE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        rows: rows.map((row) => ({
          index: row.index,
          name: row.name.trim(),
          quantity: Number(row.quantity),
          category: row.category,
          room: row.roomId || "",
          unit: row.unit?.trim() || "",
          description: row.description?.trim() || "",
        })),
      }),
    });
    return parseMutationResponse(response);
  },

  async getOptions(
    params: { status?: string; room?: string; category?: string } = {},
    signal?: AbortSignal,
  ) {
    const url = new URL(API_MATERIALS_DROPDOWN, window.location.origin);
    if (params.status) url.searchParams.set("status", params.status);
    if (params.room) url.searchParams.set("room", params.room);
    if (params.category) url.searchParams.set("category", params.category);

    const response = await authFetch(url.toString(), { method: "GET", signal });
    if (!response.ok) {
      throw new Error(`Gagal memuat opsi bahan (${response.status})`);
    }

    const payload = (await response.json()) as ApiMaterialOption[];
    return payload
      .map((item) => ({
        id: String(item.id ?? ""),
        label: item.room_detail?.name
          ? `${String(item.name ?? "-")} (${String(item.room_detail.name)})`
          : String(item.name ?? "-"),
        quantity: Number(item.quantity ?? 0),
        unit: String(item.unit ?? ""),
      }))
      .filter((item) => item.id);
  },
};
