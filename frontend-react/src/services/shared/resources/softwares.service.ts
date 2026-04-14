import {
  API_SOFTWARE_DETAIL,
  API_SOFTWARES,
  API_SOFTWARES_BULK_CREATE,
  API_SOFTWARES_BULK_DELETE,
} from "@/constants/api";
import { authFetch } from "@/lib/auth";

export type SoftwareFilters = {
  equipment?: string;
  room?: string;
  pic?: string;
  search?: string;
};

export type SoftwareRow = {
  id: number | string;
  name: string;
  description: string;
  version: string;
  licenseInfo: string;
  licenseExpiration: string;
  equipmentId: string;
  equipmentName: string;
  roomName: string;
  roomNumber: string;
};

export type SoftwareDetail = SoftwareRow;

type ApiSoftware = {
  id?: number | string | null;
  name?: string | null;
  description?: string | null;
  version?: string | null;
  license_info?: string | null;
  license_expiration?: string | null;
  equipment?: string | number | null;
  equipment_detail?: {
    name?: string | null;
    room_detail?: { name?: string | null; number?: string | null } | null;
  } | null;
};

type ApiSoftwaresResponse = {
  count?: number;
  results?: ApiSoftware[];
};

export type CreateSoftwarePayload = {
  name: string;
  version?: string;
  licenseInfo?: string;
  licenseExpiration?: string;
  equipmentId: string;
  description?: string;
};

export type UpdateSoftwarePayload = {
  name: string;
  version?: string;
  licenseInfo?: string;
  licenseExpiration?: string;
  equipmentId: string;
  description?: string;
};

export type BulkSoftwareRow = Omit<CreateSoftwarePayload, "equipmentId"> & {
  index: number;
  equipmentId?: string;
};

export type BulkSoftwareResult = {
  index: number;
  status: "success" | "error";
  message: string;
};

type MutationResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; data?: unknown; text?: string };

export function mapSoftware(item: ApiSoftware): SoftwareRow {
  return {
    id: item.id ?? `sw-${Math.random().toString(36).slice(2, 8)}`,
    name: String(item.name ?? "-"),
    description: String(item.description ?? ""),
    version: String(item.version ?? ""),
    licenseInfo: String(item.license_info ?? ""),
    licenseExpiration: String(item.license_expiration ?? ""),
    equipmentId: String(item.equipment ?? ""),
    equipmentName: String(item.equipment_detail?.name ?? item.equipment ?? "-"),
    roomName: String(item.equipment_detail?.room_detail?.name ?? "-"),
    roomNumber: String(item.equipment_detail?.room_detail?.number ?? ""),
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

export const softwaresService = {
  async getList(
    page: number,
    pageSize = 10,
    filters: SoftwareFilters = {},
    signal?: AbortSignal,
  ) {
    const url = new URL(API_SOFTWARES, window.location.origin);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));
    if (filters.equipment) url.searchParams.set("equipment", filters.equipment);
    if (filters.room) url.searchParams.set("room", filters.room);
    if (filters.pic) url.searchParams.set("pic", filters.pic);
    if (filters.search) url.searchParams.set("search", filters.search);

    const response = await authFetch(url.toString(), { method: "GET", signal });
    if (!response.ok) throw new Error(`Gagal memuat data software (${response.status})`);

    return (await response.json()) as ApiSoftwaresResponse | ApiSoftware[];
  },

  async getDetail(id: string | number, signal?: AbortSignal) {
    const response = await authFetch(API_SOFTWARE_DETAIL(id), {
      method: "GET",
      signal,
    });
    if (!response.ok) {
      throw new Error(`Gagal memuat detail software (${response.status})`);
    }

    return (await response.json()) as ApiSoftware;
  },

  async create(payload: CreateSoftwarePayload) {
    const body: Record<string, string> = {
      name: payload.name.trim(),
      equipment: payload.equipmentId,
    };

    if (payload.version?.trim()) body.version = payload.version.trim();
    if (payload.licenseInfo?.trim()) body.license_info = payload.licenseInfo.trim();
    if (payload.licenseExpiration?.trim()) body.license_expiration = payload.licenseExpiration.trim();
    if (payload.description?.trim()) body.description = payload.description.trim();

    const response = await authFetch(API_SOFTWARES, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return parseMutationResponse(response);
  },

  async update(softwareId: string | number, payload: UpdateSoftwarePayload) {
    const body: Record<string, string> = {
      name: payload.name.trim(),
      equipment: payload.equipmentId,
      description: payload.description?.trim() || "",
    };
    if (payload.version?.trim()) body.version = payload.version.trim();
    if (payload.licenseInfo?.trim()) body.license_info = payload.licenseInfo.trim();
    if (payload.licenseExpiration?.trim()) {
      body.license_expiration = payload.licenseExpiration.trim();
    }

    const response = await authFetch(API_SOFTWARE_DETAIL(softwareId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return parseMutationResponse(response);
  },

  async remove(softwareId: string | number) {
    const response = await authFetch(API_SOFTWARE_DETAIL(softwareId), {
      method: "DELETE",
    });
    return parseMutationResponse(response);
  },

  async bulkRemove(softwareIds: Array<string | number>) {
    const response = await authFetch(API_SOFTWARES_BULK_DELETE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: softwareIds }),
    });
    return parseMutationResponse(response);
  },

  async bulkCreate(rows: BulkSoftwareRow[]) {
    const response = await authFetch(API_SOFTWARES_BULK_CREATE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: rows.map((row) => ({
          index: row.index,
          name: row.name.trim(),
          version: row.version?.trim() || "",
          license_info: row.licenseInfo?.trim() || "",
          license_expiration: row.licenseExpiration?.trim() || "",
          equipment: row.equipmentId || "",
          description: row.description?.trim() || "",
        })),
      }),
    });
    return parseMutationResponse(response);
  },
};
