import {
  API_BASE_URL,
  API_IMAGE_DETAIL,
  API_IMAGES,
} from "@/constants/api";
import { authFetch } from "@/lib/auth";
import {
  buildFaqUrl,
  FAQS_BULK_DELETE_ENDPOINT,
  FAQS_ENDPOINT,
} from "@/hooks/information/faq/utils";

export type Faq = {
  id: string | number;
  question: string;
  answer: string;
  image?: string | number | null;
  image_detail?: {
    id?: string | number;
    url?: string | null;
    name?: string | null;
  } | null;
  imageUrl?: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type FaqFilters = {
  search?: string;
  ordering?: "created_at" | "-created_at";
};

type FaqListResponse = {
  count?: number;
  results?: Faq[];
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

function mapFaq(item: Faq): Faq {
  return {
    ...item,
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

export const faqService = {
  async getList(
    page = 1,
    pageSize = 10,
    filters: FaqFilters = {},
    signal?: AbortSignal,
  ) {
    const url = new URL(FAQS_ENDPOINT, window.location.origin);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));
    if (filters.search) url.searchParams.set("search", filters.search);
    if (filters.ordering) url.searchParams.set("ordering", filters.ordering);

    const response = await authFetch(url.toString(), { signal });
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const detail =
        typeof (errorPayload as { detail?: string })?.detail === "string"
          ? (errorPayload as { detail?: string }).detail
          : "Gagal memuat FAQ.";
      throw new Error(detail || "Gagal memuat FAQ.");
    }

    const payload = (await response.json().catch(() => null)) as
      | FaqListResponse
      | Faq[]
      | null;

    if (Array.isArray(payload)) {
      return payload.map(mapFaq);
    }
    if (Array.isArray(payload?.results)) {
      return {
        ...payload,
        results: payload.results.map(mapFaq),
      };
    }

    return payload;
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

  async create(payload: { question: string; answer: string; image?: string | number | null }) {
    const response = await authFetch(FAQS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return parseMutationResponse(response);
  },

  async update(
    id: string | number,
    payload: { question: string; answer: string; image?: string | number | null },
  ) {
    const response = await authFetch(buildFaqUrl(FAQS_ENDPOINT, id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return parseMutationResponse(response);
  },

  async remove(id: string | number) {
    const response = await authFetch(buildFaqUrl(FAQS_ENDPOINT, id), {
      method: "DELETE",
    });

    return parseMutationResponse(response);
  },

  async bulkRemove(ids: Array<string | number>) {
    const response = await authFetch(FAQS_BULK_DELETE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });

    return parseMutationResponse(response);
  },

  async deleteImage(id: string | number) {
    try {
      await authFetch(API_IMAGE_DETAIL(id), { method: "DELETE" });
    } catch {
      // ignore cleanup errors
    }
  },
};
