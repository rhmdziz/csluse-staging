"use client";

import { useEffect, useState } from "react";

import { isLegacyImportedCode } from "@/lib/request";
import { sampleTestingService } from "@/services/sample-testing";

export type SampleTestingFilters = {
  q?: string;
  status?: string;
  requestedBy?: string;
  department?: string;
  createdAfter?: string;
  createdBefore?: string;
};

export type SampleTestingListScope = "default" | "my" | "all" | "admin-all";

export type SampleTestingRow = {
  id: string | number;
  code: string;
  name: string;
  institution: string;
  institutionAddress: string;
  email: string;
  phoneNumber: string;
  sampleName: string;
  sampleType: string;
  sampleBrand: string;
  samplePackaging: string;
  sampleWeight: string;
  sampleQuantity: string;
  sampleTestingServing: string;
  sampleTestingMethod: string;
  sampleTestingType: string;
  status: string;
  requesterId: string;
  requesterName: string;
  requesterDepartment: string;
  requesterRole: string;
  approvedById: string;
  approvedByName: string;
  createdAt: string;
  updatedAt: string;
  approvedAt: string;
  rejectedAt: string;
  completedAt: string;
  documents: SampleTestingDocument[];
};

export type SampleTestingDocumentType =
  | "testing_agreement"
  | "signed_testing_agreement"
  | "invoice"
  | "payment_proof"
  | "receipt"
  | "test_result_letter";

export type SampleTestingDocument = {
  id: string;
  documentType: SampleTestingDocumentType;
  documentLabel: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
  updatedAt: string;
};

type ApiSampleTesting = {
  id?: string | number | null;
  code?: string | null;
  name?: string | null;
  institution?: string | null;
  institution_address?: string | null;
  email?: string | null;
  phone_number?: string | null;
  sample_name?: string | null;
  sample_type?: string | null;
  sample_brand?: string | null;
  sample_packaging?: string | null;
  sample_weight?: string | null;
  sample_quantity?: string | null;
  sample_testing_serving?: string | null;
  sample_testing_method?: string | null;
  sample_testing_type?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  completed_at?: string | null;
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
  documents?: Array<{
    id?: string | number | null;
    document_type?: SampleTestingDocumentType | null;
    document_label?: string | null;
    original_name?: string | null;
    mime_type?: string | null;
    size?: number | null;
    url?: string | null;
    uploaded_by?: string | number | null;
    uploaded_by_name?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  }> | null;
};

type ApiSampleTestingsResponse = {
  count?: number;
  results?: ApiSampleTesting[];
  aggregates?: {
    total?: number;
    pending?: number;
    approved?: number;
    diproses?: number;
    completed?: number;
    rejected?: number;
  } | null;
};

export type SampleTestingAggregates = {
  total: number;
  pending: number;
  approved: number;
  diproses: number;
  completed: number;
  rejected: number;
};

export function mapSampleTesting(item: ApiSampleTesting): SampleTestingRow {
  const requesterName =
    item.requested_by_detail?.full_name ||
    item.requested_by_detail?.email ||
    "-";
  const approvedByName =
    item.approved_by_detail?.full_name ||
    item.approved_by_detail?.email ||
    "-";

  return {
    id: item.id ?? `sample-testing-${Math.random().toString(36).slice(2, 8)}`,
    code: String(item.code ?? "-"),
    name: String(item.name ?? "-"),
    institution: String(item.institution ?? "-"),
    institutionAddress: String(item.institution_address ?? "-"),
    email: String(item.email ?? "-"),
    phoneNumber: String(item.phone_number ?? "-"),
    sampleName: String(item.sample_name ?? "-"),
    sampleType: String(item.sample_type ?? "-"),
    sampleBrand: String(item.sample_brand ?? "-"),
    samplePackaging: String(item.sample_packaging ?? "-"),
    sampleWeight: String(item.sample_weight ?? "-"),
    sampleQuantity: String(item.sample_quantity ?? "-"),
    sampleTestingServing: String(item.sample_testing_serving ?? "-"),
    sampleTestingMethod: String(item.sample_testing_method ?? "-"),
    sampleTestingType: String(item.sample_testing_type ?? "-"),
    status: String(item.status ?? "-"),
    requesterId: String(item.requested_by_detail?.id ?? item.requested_by ?? ""),
    requesterName: String(requesterName),
    requesterDepartment: String(item.requested_by_detail?.department ?? "-"),
    requesterRole: String(item.requested_by_detail?.role ?? "-"),
    approvedById: String(item.approved_by_detail?.id ?? item.approved_by ?? ""),
    approvedByName: String(approvedByName),
    createdAt: String(item.created_at ?? "-"),
    updatedAt: String(item.updated_at ?? "-"),
    approvedAt: String(item.approved_at ?? "-"),
    rejectedAt: String(item.rejected_at ?? "-"),
    completedAt: String(item.completed_at ?? "-"),
    documents: Array.isArray(item.documents)
      ? item.documents.map((document) => ({
          id: String(document.id ?? ""),
          documentType: (document.document_type ?? "testing_agreement") as SampleTestingDocumentType,
          documentLabel: String(document.document_label ?? "-"),
          originalName: String(document.original_name ?? "-"),
          mimeType: String(document.mime_type ?? ""),
          size: Number(document.size ?? 0),
          url: String(document.url ?? ""),
          uploadedById: String(document.uploaded_by ?? ""),
          uploadedByName: String(document.uploaded_by_name ?? "-"),
          createdAt: String(document.created_at ?? "-"),
          updatedAt: String(document.updated_at ?? "-"),
        }))
      : [],
  };
}

export function useSampleTestingDetail(
  id?: string | number | null,
  reloadKeyOrOptions?:
    | number
    | {
        enabled?: boolean;
        initialSampleTesting?: SampleTestingRow | null;
      },
  maybeOptions?: {
    enabled?: boolean;
    initialSampleTesting?: SampleTestingRow | null;
  },
) {
  const reloadKey =
    typeof reloadKeyOrOptions === "number" ? reloadKeyOrOptions : 0;
  const options =
    typeof reloadKeyOrOptions === "number"
      ? maybeOptions
      : reloadKeyOrOptions;
  const enabled = options?.enabled ?? true;
  const [sampleTesting, setSampleTesting] = useState<SampleTestingRow | null>(
    options?.initialSampleTesting ?? null,
  );
  const [isLoading, setIsLoading] = useState(
    enabled && Boolean(id) && !options?.initialSampleTesting,
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof options?.initialSampleTesting === "undefined") return;
    setSampleTesting(options.initialSampleTesting ?? null);
  }, [options?.initialSampleTesting]);

  useEffect(() => {
    if (!enabled) {
      setError("");
      setIsLoading(false);
      return;
    }

    if (!id) {
      setSampleTesting(null);
      setError("ID pengujian tidak ditemukan.");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    let isAborted = false;

    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const payload = (await sampleTestingService.getDetail(
          id,
          controller.signal,
        )) as ApiSampleTesting;
        setSampleTesting(mapSampleTesting(payload));
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
    sampleTesting,
    setSampleTesting,
    isLoading,
    error,
    setError,
  };
}

export function useSampleTestingList(
  page: number,
  pageSize = 10,
  filters: SampleTestingFilters = {},
  reloadKey = 0,
  scope: SampleTestingListScope = "default",
) {
  const [sampleTestings, setSampleTestings] = useState<SampleTestingRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState("");
  const [aggregates, setAggregates] = useState<SampleTestingAggregates>({
    total: 0,
    pending: 0,
    approved: 0,
    diproses: 0,
    completed: 0,
    rejected: 0,
  });

  useEffect(() => {
    const controller = new AbortController();
    let isAborted = false;

    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const payload = (await sampleTestingService.getList(
          page,
          pageSize,
          filters,
          scope,
          controller.signal,
        )) as ApiSampleTestingsResponse | ApiSampleTesting[];
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.results)
            ? payload.results
            : [];
        const mapped = list
          .map(mapSampleTesting)
          .filter(
            (sampleTesting) =>
              scope === "admin-all" || !isLegacyImportedCode(sampleTesting.code),
          );

        setSampleTestings(mapped);
        setTotalCount(Array.isArray(payload) ? mapped.length : (payload.count ?? mapped.length));
        setAggregates({
          total: Array.isArray(payload) ? mapped.length : Number(payload.aggregates?.total ?? 0),
          pending: Array.isArray(payload) ? 0 : Number(payload.aggregates?.pending ?? 0),
          approved: Array.isArray(payload) ? 0 : Number(payload.aggregates?.approved ?? 0),
          diproses: Array.isArray(payload) ? 0 : Number(payload.aggregates?.diproses ?? 0),
          completed: Array.isArray(payload) ? 0 : Number(payload.aggregates?.completed ?? 0),
          rejected: Array.isArray(payload) ? 0 : Number(payload.aggregates?.rejected ?? 0),
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
    filters.requestedBy,
    filters.department,
    filters.createdAfter,
    filters.createdBefore,
    reloadKey,
    scope,
  ]);

  return {
    sampleTestings,
    setSampleTestings,
    totalCount,
    setTotalCount,
    aggregates,
    isLoading,
    hasLoadedOnce,
    error,
    setError,
  };
}

export default useSampleTestingList;
