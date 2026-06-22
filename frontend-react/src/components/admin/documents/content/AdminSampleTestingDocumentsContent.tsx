"use client";


import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import type { DateRange } from "react-day-picker";

import { ChevronDown, Eye, ExternalLink, FileText } from "lucide-react";

import { useRouter } from "next/navigation";

import { AdminPageHeader, AdminFilterCard } from "@/components/admin/shared";

import { AdminHistorySummaryCards, AdminHistoryTable } from "@/components/admin/history";

import { DataPagination, DocumentPreviewDialog, InlineErrorAlert } from "@/components/shared";

import { Button, DateRangePicker, Input } from "@/components/ui";

import { useAdminSampleTestingDocuments } from "@/hooks/admin/documents";

import { useHistoryRequesterOptions } from "@/hooks/admin/history";
import { useDepartmentOptions } from "@/hooks/shared/resources/departments";

import {
  type SampleTestingDocument,
  type SampleTestingDocumentType,
} from "@/hooks/sample-testing";

import { API_PENGUJIANS_ALL_REQUESTERS } from "@/constants/api";

import { formatDateKey, toEndOfDay, toStartOfDay } from "@/lib/date";

import { formatDateTimeWib } from "@/lib/date";
import { downloadDocumentFile, isPreviewableDocumentFile } from "@/lib/core";

import { getStatusBadgeClass, getStatusDisplayLabel } from "@/lib/request";

const PAGE_SIZE = 20;
const ORDERING_OPTIONS = [
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
];

function getDocumentTypeLabel(value: SampleTestingDocumentType) {
  if (value === "testing_agreement") return "Surat Perjanjian Pengujian";
  if (value === "signed_testing_agreement") return "Surat Perjanjian Ditandatangani";
  if (value === "invoice") return "Invoice";
  if (value === "payment_proof") return "Bukti Bayar";
  if (value === "receipt") return "Kuitansi";
  return "Surat Hasil Uji";
}

type SupportedDocumentConfig = {
  title: string;
  description: string;
  documentTypes: SampleTestingDocumentType[];
  emptyMessage: string;
};

export default function AdminSampleTestingDocumentsContent({
  config,
}: {
  config: SupportedDocumentConfig;
}) {
  const router = useRouter();
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const { departmentNames } = useDepartmentOptions();
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [department, setDepartment] = useState("");
  const [documentTypeFilter, setDocumentTypeFilter] = useState("");
  const [ordering, setOrdering] = useState("newest");
  const [createdRange, setCreatedRange] = useState<DateRange | undefined>();
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [previewDocument, setPreviewDocument] = useState<SampleTestingDocument | null>(
    null,
  );
  const createdAfter = createdRange?.from ? formatDateKey(createdRange.from) : "";
  const createdBefore = createdRange?.to
    ? formatDateKey(createdRange.to)
    : createdRange?.from
      ? formatDateKey(createdRange.from)
      : "";

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(search.trim()), 500);
    return () => clearTimeout(timeoutId);
  }, [search]);

  const { requesters } = useHistoryRequesterOptions(API_PENGUJIANS_ALL_REQUESTERS);
  const activeDocumentTypes =
    documentTypeFilter
      ? [documentTypeFilter as SampleTestingDocumentType]
      : config.documentTypes;
  const {
    groups,
    totalCount,
    isLoading,
    hasLoadedOnce,
    error,
  } = useAdminSampleTestingDocuments({
    page,
    pageSize: PAGE_SIZE,
    documentTypes: activeDocumentTypes,
    search: debouncedSearch,
    status,
    requestedBy,
    department,
    createdAfter: createdAfter ? toStartOfDay(createdAfter) : "",
    createdBefore: createdBefore ? toEndOfDay(createdBefore) : "",
    enabled: true,
    ordering,
  });

  const groupedItems = useMemo(
    () =>
      groups.map((group) => ({
        groupKey: String(group.sampleTestingId),
        sampleTestingId: String(group.sampleTestingId),
        code: group.code,
        requesterName: group.requesterName,
        institution: group.institution,
        status: group.status,
        documents: group.documents,
      })),
    [groups],
  );

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), [totalCount]);
  const allVisibleSelected =
    groupedItems.length > 0 &&
    groupedItems.every((item) => selectedIds.includes(item.sampleTestingId));
  const someVisibleSelected =
    groupedItems.some((item) => selectedIds.includes(item.sampleTestingId)) &&
    !allVisibleSelected;

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next: Record<string, boolean> = {};
      groupedItems.forEach((group) => {
        next[group.groupKey] = prev[group.groupKey] ?? false;
      });
      return next;
    });
  }, [groupedItems]);

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) => groupedItems.some((item) => String(item.sampleTestingId) === String(id))),
    );
  }, [groupedItems]);

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("");
    setRequestedBy("");
    setDepartment("");
    setDocumentTypeFilter("");
    setOrdering("newest");
    setCreatedRange(undefined);
    setPage(1);
  };

  const documentTypeOptions =
    config.documentTypes.map((value) => ({
      value,
      label: getDocumentTypeLabel(value),
    }));

  const totalDocumentsOnPage = groupedItems.reduce(
    (acc, item) => acc + item.documents.length,
    0,
  );
  const totalRelatedRequests = totalCount;
  const totalRequesters = new Set(groups.map((item) => item.requesterName)).size;

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const toggleItemSelection = (id: string | number) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((itemId) => itemId !== id)
        : [...prev, id],
    );
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    if (!checked) {
      setSelectedIds((prev) =>
        prev.filter((id) => !groupedItems.some((item) => item.sampleTestingId === id)),
      );
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      groupedItems.forEach((item) => next.add(item.sampleTestingId));
      return Array.from(next);
    });
  };

  return (
    <section className="w-full min-w-0 space-y-4 px-4 pb-6">
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 space-y-4">
          <AdminPageHeader
            title={config.title}
            description={config.description}
            icon={<FileText className="h-5 w-5 text-sky-200" />}
          />

          <AdminHistorySummaryCards
            items={[
              { label: "Pengujian", value: totalRelatedRequests, tone: "blue" },
              { label: "Dokumen di Halaman", value: totalDocumentsOnPage, tone: "sky" },
              { label: "Pemohon di Halaman", value: totalRequesters, tone: "emerald" },
            ]}
          />

          <AdminFilterCard
            open={filterOpen}
            onToggle={() => setFilterOpen((prev) => !prev)}
            onReset={resetFilters}
          >
            <form
              className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
              }}
            >
              <div className="min-w-0">
                <label className="mb-0.5 block text-[11px] font-semibold text-slate-900/90">
                  Cari
                </label>
                <Input
                  type="search"
                  value={search}
                  placeholder="Kode, pemohon, institusi, file, atau uploader"
                  className="h-8 border-slate-400 bg-white px-2 py-0 text-xs placeholder:text-xs md:text-xs shadow-xs focus-visible:border-sky-600 focus-visible:ring-sky-100"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="min-w-0">
                <label className="mb-0.5 block text-[11px] font-semibold text-slate-900/90">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                  className="h-8 w-full rounded-md border border-slate-400 bg-white px-2 text-xs outline-none shadow-xs focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-100"
                >
                  <option value="">Semua status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="diproses">Diproses</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="min-w-0">
                <label className="mb-0.5 block text-[11px] font-semibold text-slate-900/90">
                  Nama Pemohon
                </label>
                <select
                  value={requestedBy}
                  onChange={(event) => {
                    setRequestedBy(event.target.value);
                    setPage(1);
                  }}
                  className="h-8 w-full rounded-md border border-slate-400 bg-white px-2 text-xs outline-none shadow-xs focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-100"
                >
                  <option value="">Semua pemohon</option>
                  {requesters.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className="mb-0.5 block text-[11px] font-semibold text-slate-900/90">
                  Prodi Pemohon
                </label>
                <select
                  value={department}
                  onChange={(event) => {
                    setDepartment(event.target.value);
                    setPage(1);
                  }}
                  className="h-8 w-full rounded-md border border-slate-400 bg-white px-2 text-xs outline-none shadow-xs focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-100"
                >
                  <option value="">Semua prodi</option>
                  {departmentNames.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className="mb-0.5 block text-[11px] font-semibold text-slate-900/90">
                  Jenis Dokumen
                </label>
                <select
                  value={documentTypeFilter}
                  onChange={(event) => {
                    setDocumentTypeFilter(event.target.value);
                    setPage(1);
                  }}
                  className="h-8 w-full rounded-md border border-slate-400 bg-white px-2 text-xs outline-none shadow-xs focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-100"
                >
                  <option value="">Semua jenis dokumen</option>
                  {documentTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className="mb-0.5 block text-[11px] font-semibold text-slate-900/90">
                  Urutkan
                </label>
                <select
                  value={ordering}
                  onChange={(event) => {
                    setOrdering(event.target.value);
                    setPage(1);
                  }}
                  className="h-8 w-full rounded-md border border-slate-400 bg-white px-2 text-xs outline-none shadow-xs focus-visible:border-sky-600 focus-visible:ring-[3px] focus-visible:ring-sky-100"
                >
                  {ORDERING_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0 xl:col-span-2">
                <label className="mb-0.5 block text-[11px] font-semibold text-slate-900/90">
                  Tanggal Dibuat
                </label>
                <DateRangePicker
                  value={createdRange}
                  onChange={(value) => {
                    setCreatedRange(value);
                    setPage(1);
                  }}
                  clearable
                  buttonClassName="h-8 w-full rounded-md border-slate-400 bg-white px-2 text-xs shadow-xs focus-visible:border-sky-600 focus-visible:ring-sky-100"
                />
              </div>
            </form>
          </AdminFilterCard>

          {error ? <InlineErrorAlert>{error}</InlineErrorAlert> : null}

          <AdminHistoryTable
            columns={[
              { label: "Kode" },
              { label: "Pemohon" },
              { label: "Institusi" },
              { label: "Status" },
              { label: "Jumlah Dokumen" },
              {
                label: "Aksi",
                className:
                  "sticky right-0 z-10 relative whitespace-nowrap bg-slate-900 px-3 py-3 text-center font-medium text-slate-50 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-700",
              },
            ]}
            colSpan={7}
            hasRows={groupedItems.length > 0}
            isLoading={isLoading}
            hasLoadedOnce={hasLoadedOnce}
            emptyMessage={config.emptyMessage}
            allVisibleSelected={allVisibleSelected}
            onToggleSelectAll={toggleSelectAllVisible}
            selectAllRef={selectAllRef}
            selectAllAriaLabel="Pilih semua pengujian pada halaman ini"
          >
            {groupedItems.map((group) => {
              const isExpanded = expandedGroups[group.groupKey] ?? false;

              return (
                <Fragment key={group.groupKey}>
                  <tr className="border-b bg-slate-50/70">
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Pilih pengujian ${group.code}`}
                        className="h-4 w-4 rounded border-slate-300 align-middle"
                        checked={selectedIds.includes(group.sampleTestingId)}
                        onChange={() => toggleItemSelection(group.sampleTestingId)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-medium">{group.code}</td>
                    <td className="whitespace-nowrap px-3 py-2">{group.requesterName}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {group.institution || "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusBadgeClass(
                          group.status,
                        )}`}
                      >
                        {getStatusDisplayLabel(group.status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {group.documents.length} dokumen
                    </td>
                    <td className="sticky right-0 z-10 relative bg-slate-50/70 px-3 py-2 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200">
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="border-slate-200 text-slate-700 hover:bg-slate-100"
                          onClick={() => toggleGroup(group.groupKey)}
                          aria-label={`${isExpanded ? "Sembunyikan" : "Lihat"} dokumen ${group.code}`}
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                          onClick={() =>
                            router.push(
                              `/admin/history/sample-testing?q=${encodeURIComponent(group.code)}`,
                            )
                          }
                          aria-label={`Buka riwayat pengujian sampel untuk ${group.code}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr className="border-b bg-white">
                      <td colSpan={7} className="px-3 py-3">
                        <div className="overflow-x-auto rounded-md border border-slate-200">
                          <table className="min-w-full table-auto">
                            <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                              <tr>
                                <th className="whitespace-nowrap px-3 py-2 font-semibold">
                                  Jenis Dokumen
                                </th>
                                <th className="whitespace-nowrap px-3 py-2 font-semibold">
                                  Nama File
                                </th>
                                <th className="whitespace-nowrap px-3 py-2 font-semibold">
                                  Uploader
                                </th>
                                <th className="whitespace-nowrap px-3 py-2 font-semibold">
                                  Diunggah
                                </th>
                                <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">
                                  Aksi
                                </th>
                              </tr>
                            </thead>
                            <tbody className="text-sm">
                              {group.documents.map((item) => (
                                <tr key={item.id} className="border-t last:border-b-0">
                                  <td className="whitespace-nowrap px-3 py-2">
                                    {item.documentLabel}
                                  </td>
                                  <td className="max-w-96 px-3 py-2">
                                    <p className="truncate" title={item.originalName}>
                                      {item.originalName}
                                    </p>
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2">
                                    {item.uploadedByName || "-"}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2">
                                    {formatDateTimeWib(item.createdAt)}
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex justify-center gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon-sm"
                                        className="border-sky-200 text-sky-600 hover:bg-sky-50 hover:text-sky-700"
                                        onClick={() => {
                                          if (isPreviewableDocumentFile(item)) {
                                            setPreviewDocument(item);
                                            return;
                                          }

                                          downloadDocumentFile(item);
                                        }}
                                        aria-label={`${isPreviewableDocumentFile(item) ? "Preview" : "Download"} dokumen ${item.originalName}`}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        asChild
                                        variant="outline"
                                        size="icon-sm"
                                        className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                      >
                                        <a
                                          href={item.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          aria-label={`Buka dokumen ${item.originalName}`}
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                        </a>
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </AdminHistoryTable>

          <DataPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            itemLabel="dokumen"
            isLoading={isLoading}
            onPageChange={setPage}
          />

          <DocumentPreviewDialog
            open={Boolean(previewDocument)}
            onOpenChange={(open) => {
              if (!open) {
                setPreviewDocument(null);
              }
            }}
            document={previewDocument}
          />
        </div>
      </div>
    </section>
  );
}
