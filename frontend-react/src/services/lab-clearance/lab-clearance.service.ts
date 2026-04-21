import {
  API_SURAT_BEBAS_LAB,
  API_SURAT_BEBAS_LAB_ALL,
  API_SURAT_BEBAS_LAB_APPROVE,
  API_SURAT_BEBAS_LAB_DELETE_DOCUMENT,
  API_SURAT_BEBAS_LAB_DETAIL,
  API_SURAT_BEBAS_LAB_MY,
  API_SURAT_BEBAS_LAB_REJECT,
} from "@/constants/api";
import { authFetch } from "@/lib/auth";

export type LabClearanceDocumentType =
  | "form_alat_kecil"
  | "form_alat_besar"
  | "form_permintaan_bahan";

export type LabClearanceDocument = {
  id: string;
  document_type: LabClearanceDocumentType;
  original_name: string;
  mime_type: string;
  size: number;
  document_url: string | null;
  created_at: string;
};

export type LabClearanceRequesterDetail = {
  id: string;
  full_name: string;
  id_number: string;
  email: string;
  department: string;
  batch: string;
};

export type LabClearanceListItem = {
  id: string;
  code: string;
  status: "Pending" | "Approved" | "Rejected";
  note: string;
  requested_by_detail: LabClearanceRequesterDetail | null;
  document_count: number;
  documents: LabClearanceDocument[];
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LabClearanceDetail = LabClearanceListItem & {
  documents: LabClearanceDocument[];
};

export type LabClearanceFilters = {
  search?: string;
  status?: string;
  requestedBy?: string;
  batch?: string;
  createdAfter?: string;
  createdBefore?: string;
  ordering?: string;
};

type MutationResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; data?: unknown; text?: string };

async function parseMutationResponse(response: Response): Promise<MutationResult> {
  const raw = await response.text();
  let data: unknown;
  if (raw) {
    try { data = JSON.parse(raw) as unknown; } catch { data = undefined; }
  }
  if (response.ok) return { ok: true, data };
  return { ok: false, status: response.status, data, text: raw || undefined };
}

export const labClearanceService = {
  async getList(
    page: number,
    pageSize: number,
    filters: LabClearanceFilters = {},
    scope: "my" | "all" = "my",
    signal?: AbortSignal,
  ) {
    const endpoint = scope === "all" ? API_SURAT_BEBAS_LAB_ALL : API_SURAT_BEBAS_LAB_MY;
    const url = new URL(endpoint, window.location.origin);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));
    if (filters.search) url.searchParams.set("search", filters.search);
    if (filters.status) url.searchParams.set("status", filters.status);
    if (filters.requestedBy) url.searchParams.set("requested_by", filters.requestedBy);
    if (filters.batch) url.searchParams.set("batch", filters.batch);
    if (filters.createdAfter) url.searchParams.set("created_after", filters.createdAfter);
    if (filters.createdBefore) url.searchParams.set("created_before", filters.createdBefore);
    if (filters.ordering) url.searchParams.set("ordering", filters.ordering);

    const response = await authFetch(url.toString(), { signal });
    if (!response.ok) return { ok: false as const, results: [], count: 0, aggregates: undefined };
    const data = (await response.json()) as {
      results: LabClearanceListItem[];
      count: number;
    };
    return { ok: true as const, results: data.results, count: data.count };
  },

  async submit(files: Partial<Record<LabClearanceDocumentType, File>>): Promise<MutationResult> {
    const formData = new FormData();
    for (const [key, file] of Object.entries(files)) {
      if (file) formData.append(key, file);
    }
    const response = await authFetch(API_SURAT_BEBAS_LAB, {
      method: "POST",
      body: formData,
    });
    return parseMutationResponse(response);
  },

  async updateDocuments(
    id: string,
    files: Partial<Record<LabClearanceDocumentType, File>>,
  ): Promise<MutationResult> {
    const formData = new FormData();
    for (const [key, file] of Object.entries(files)) {
      if (file) formData.append(key, file);
    }

    const response = await authFetch(API_SURAT_BEBAS_LAB_DETAIL(id), {
      method: "PATCH",
      body: formData,
    });
    return parseMutationResponse(response);
  },

  async getDetail(id: string, signal?: AbortSignal): Promise<LabClearanceDetail | null> {
    const response = await authFetch(API_SURAT_BEBAS_LAB_DETAIL(id), { signal });
    if (!response.ok) return null;
    return (await response.json()) as LabClearanceDetail;
  },

  async deleteDocument(id: string, documentType: LabClearanceDocumentType): Promise<MutationResult> {
    const response = await authFetch(API_SURAT_BEBAS_LAB_DELETE_DOCUMENT(id, documentType), {
      method: "DELETE",
    });
    return parseMutationResponse(response);
  },

  async approve(id: string): Promise<MutationResult> {
    const response = await authFetch(API_SURAT_BEBAS_LAB_APPROVE(id), { method: "POST" });
    return parseMutationResponse(response);
  },

  async reject(id: string, note: string): Promise<MutationResult> {
    const response = await authFetch(API_SURAT_BEBAS_LAB_REJECT(id), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    return parseMutationResponse(response);
  },
};
