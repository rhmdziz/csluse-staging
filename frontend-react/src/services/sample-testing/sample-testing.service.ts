import {
  API_PENGUJIAN_APPROVE,
  API_PENGUJIAN_CANCEL,
  API_PENGUJIAN_COMPLETE,
  API_PENGUJIAN_DELETE_DOCUMENT,
  API_PENGUJIAN_DETAIL,
  API_PENGUJIAN_REJECT,
  API_PENGUJIAN_UPLOAD_DOCUMENT,
  API_PENGUJIANS,
  API_PENGUJIANS_ALL,
  API_PENGUJIANS_LEGACY_BULK_IMPORT,
  API_PENGUJIANS_MY,
} from "@/constants/api";
import { authFetch } from "@/lib/auth";

export type SampleTestingServiceFilters = {
  q?: string;
  status?: string;
  requestedBy?: string;
  department?: string;
  createdAfter?: string;
  createdBefore?: string;
};

export type SampleTestingServiceListScope = "default" | "my" | "all";

export type CreateSampleTestingPayload = {
  name: string;
  institution?: string;
  institutionAddress?: string;
  email: string;
  phoneNumber?: string;
  sampleName?: string;
  sampleType: string;
  sampleBrand?: string;
  samplePackaging?: string;
  sampleWeight?: string;
  sampleQuantity?: string;
  sampleTestingServing?: string;
  sampleTestingMethod?: string;
  sampleTestingType?: string;
};

export type SampleTestingStatusActionType = "approve" | "reject" | "cancel" | "complete";

export type LegacySampleTestingImportRow = {
  index: number;
  code?: string;
  name: string;
  institution?: string;
  institutionAddress?: string;
  email: string;
  phoneNumber?: string;
  sampleName?: string;
  sampleType: string;
  sampleBrand?: string;
  samplePackaging?: string;
  sampleWeight?: string;
  sampleQuantity?: string;
  sampleTestingServing?: string;
  sampleTestingMethod?: string;
  sampleTestingType?: string;
  status?: string;
  requestedById?: string;
  requestedByEmail?: string;
  approvedById?: string;
  approvedByEmail?: string;
  createdAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  completedAt?: string;
};

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

export const sampleTestingService = {
  async getList(
    page: number,
    pageSize: number,
    filters: SampleTestingServiceFilters = {},
    scope: SampleTestingServiceListScope = "default",
    signal?: AbortSignal,
  ) {
    const listEndpoint =
      scope === "my" ? API_PENGUJIANS_MY : scope === "all" ? API_PENGUJIANS_ALL : API_PENGUJIANS;
    const url = new URL(listEndpoint, window.location.origin);

    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));
    if (filters.q) url.searchParams.set("q", filters.q);
    if (filters.status) url.searchParams.set("status", filters.status);
    if (filters.requestedBy && scope !== "my") {
      url.searchParams.set("requested_by", filters.requestedBy);
    }
    if (filters.department) url.searchParams.set("department", filters.department);
    if (filters.createdAfter) {
      url.searchParams.set("created_after", filters.createdAfter);
    }
    if (filters.createdBefore) {
      url.searchParams.set("created_before", filters.createdBefore);
    }

    const response = await authFetch(url.toString(), { method: "GET", signal });
    if (!response.ok) {
      throw new Error(`Gagal memuat data pengujian sampel (${response.status})`);
    }

    return (await response.json()) as unknown;
  },

  async getDetail(id: string | number, signal?: AbortSignal) {
    const response = await authFetch(API_PENGUJIAN_DETAIL(id), {
      method: "GET",
      signal,
    });
    if (!response.ok) {
      throw new Error(`Gagal memuat detail pengujian sampel (${response.status})`);
    }

    return (await response.json()) as unknown;
  },

  async create(payload: CreateSampleTestingPayload) {
    const body = buildSampleTestingPayload(payload);

    const response = await authFetch(API_PENGUJIANS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return parseMutationResponse(response);
  },

  async update(
    sampleTestingId: string | number,
    payload: CreateSampleTestingPayload,
  ) {
    const body = buildSampleTestingPayload(payload);

    const response = await authFetch(API_PENGUJIAN_DETAIL(sampleTestingId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return parseMutationResponse(response);
  },

  async remove(sampleTestingId: string | number) {
    const response = await authFetch(API_PENGUJIAN_DETAIL(sampleTestingId), {
      method: "DELETE",
    });

    return parseMutationResponse(response);
  },

  async updateStatus(
    sampleTestingId: string | number,
    type: SampleTestingStatusActionType,
  ) {
    const response = await authFetch(
      type === "approve"
        ? API_PENGUJIAN_APPROVE(sampleTestingId)
        : type === "reject"
          ? API_PENGUJIAN_REJECT(sampleTestingId)
          : type === "complete"
            ? API_PENGUJIAN_COMPLETE(sampleTestingId)
            : API_PENGUJIAN_CANCEL(sampleTestingId),
      { method: "POST" },
    );

    return parseMutationResponse(response);
  },

  async uploadDocument(
    sampleTestingId: string | number,
    documentType: string,
    file: File,
  ) {
    const formData = new FormData();
    formData.set("document_type", documentType);
    formData.set("file", file);

    const response = await authFetch(API_PENGUJIAN_UPLOAD_DOCUMENT(sampleTestingId), {
      method: "POST",
      body: formData,
    });

    return parseMutationResponse(response);
  },

  async deleteDocument(
    sampleTestingId: string | number,
    documentType: string,
  ) {
    const response = await authFetch(
      API_PENGUJIAN_DELETE_DOCUMENT(sampleTestingId, documentType),
      { method: "DELETE" },
    );

    return parseMutationResponse(response);
  },

  async legacyBulkImport(rows: LegacySampleTestingImportRow[]) {
    const body = {
      rows: rows.map((row) => ({
        index: row.index,
        code: row.code?.trim() || undefined,
        name: row.name.trim(),
        institution: row.institution?.trim() || undefined,
        institution_address: row.institutionAddress?.trim() || undefined,
        email: row.email.trim(),
        phone_number: row.phoneNumber?.trim() || undefined,
        sample_name: row.sampleName?.trim() || undefined,
        sample_type: row.sampleType.trim(),
        sample_brand: row.sampleBrand?.trim() || undefined,
        sample_packaging: row.samplePackaging?.trim() || undefined,
        sample_weight: row.sampleWeight?.trim() || undefined,
        sample_quantity: row.sampleQuantity?.trim() || undefined,
        sample_testing_serving: row.sampleTestingServing?.trim() || undefined,
        sample_testing_method: row.sampleTestingMethod?.trim() || undefined,
        sample_testing_type: row.sampleTestingType?.trim() || undefined,
        status: row.status?.trim() || undefined,
        requested_by: row.requestedById?.trim() || undefined,
        requested_by_email: row.requestedByEmail?.trim() || undefined,
        approved_by: row.approvedById?.trim() || undefined,
        approved_by_email: row.approvedByEmail?.trim() || undefined,
        created_at: row.createdAt || undefined,
        approved_at: row.approvedAt || undefined,
        rejected_at: row.rejectedAt || undefined,
        completed_at: row.completedAt || undefined,
      })),
    };

    const response = await authFetch(API_PENGUJIANS_LEGACY_BULK_IMPORT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return parseMutationResponse(response);
  },
};

function buildSampleTestingPayload(payload: CreateSampleTestingPayload) {
    const body: Record<string, string> = {
      name: payload.name.trim(),
      email: payload.email.trim(),
      sample_type: payload.sampleType.trim(),
    };

    if (payload.institution?.trim()) body.institution = payload.institution.trim();
    if (payload.institutionAddress?.trim()) {
      body.institution_address = payload.institutionAddress.trim();
    }
    if (payload.phoneNumber?.trim()) body.phone_number = payload.phoneNumber.trim();
    if (payload.sampleName?.trim()) body.sample_name = payload.sampleName.trim();
    if (payload.sampleBrand?.trim()) body.sample_brand = payload.sampleBrand.trim();
    if (payload.samplePackaging?.trim()) {
      body.sample_packaging = payload.samplePackaging.trim();
    }
    if (payload.sampleWeight?.trim()) body.sample_weight = payload.sampleWeight.trim();
    if (payload.sampleQuantity?.trim()) {
      body.sample_quantity = payload.sampleQuantity.trim();
    }
    if (payload.sampleTestingServing?.trim()) {
      body.sample_testing_serving = payload.sampleTestingServing.trim();
    }
    if (payload.sampleTestingMethod?.trim()) {
      body.sample_testing_method = payload.sampleTestingMethod.trim();
    }
    if (payload.sampleTestingType?.trim()) {
      body.sample_testing_type = payload.sampleTestingType.trim();
    }
    return body;
}
