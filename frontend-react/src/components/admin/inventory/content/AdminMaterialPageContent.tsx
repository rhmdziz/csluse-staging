"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Building2, ChevronDown, FileUp, Plus } from "lucide-react";

import { toast } from "sonner";

import {
  AdminPageHeader,
  AdminFilterCard,
  AdminFilterField,
  AdminFilterGrid,
  ADMIN_FILTER_INPUT_CLASS,
  ADMIN_FILTER_SELECT_CLASS,
} from "@/components/admin/shared";

import {
  MaterialCreateDialog,
  MaterialBulkImportByRoomDialog,
  MaterialBulkImportDialog,
  AdminMaterialDetailDialog,
  MaterialTable,
  InventoryBulkActions,
} from "@/components/admin/inventory";

import { DataPagination, ConfirmDeleteDialog, InlineErrorAlert } from "@/components/shared";

import { AdminHistoryExportActions as AdminRecordExportActions } from "@/components/admin/history";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from "@/components/ui";

import { MATERIAL_CATEGORY_OPTIONS, MATERIAL_STATUS_OPTIONS } from "@/constants/materials";
import { DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE_OPTIONS } from "@/constants/pagination";

import { API_MATERIALS_EXPORT } from "@/constants/api";

import { useAdminRecordExport } from "@/hooks/admin";

import { useDeleteMaterial } from "@/hooks/shared/resources/materials";

import {
  mapMaterial,
  useMaterials,
  type MaterialRow,
} from "@/hooks/shared/resources/materials";

import { useRoomOptions } from "@/hooks/shared/resources/rooms";

import { MATERIAL_EXPORT_COLUMNS } from "@/lib/admin/export-config";

function FilterSelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <AdminFilterField label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={ADMIN_FILTER_SELECT_CLASS}
      >
        <option value="">Semua</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </AdminFilterField>
  );
}

export default function AdminMaterialPageContent() {
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [room, setRoom] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkImportByRoomOpen, setBulkImportByRoomOpen] = useState(false);
  const [detailMaterial, setDetailMaterial] = useState<MaterialRow | null>(null);
  const [detailMode, setDetailMode] = useState<"view" | "edit">("view");
  const [deleteCandidate, setDeleteCandidate] = useState<MaterialRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isExportingSelectedPdf, setIsExportingSelectedPdf] = useState(false);
  const [isExportingSelectedExcel, setIsExportingSelectedExcel] = useState(false);

  const { rooms: filterRooms, isLoading: isLoadingFilterRooms } = useRoomOptions();
  const { deleteMaterial, deleteMaterials, isDeleting } = useDeleteMaterial();

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(search.trim()), 500);
    return () => clearTimeout(timeoutId);
  }, [search]);

  const { materials, totalCount, isLoading, hasLoadedOnce, error } = useMaterials(
    page,
    pageSize,
    {
      search: debouncedSearch,
      status,
      category,
      room,
    },
    reloadKey,
  );

  const totalMaterials = totalCount || materials.length;
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((totalCount || materials.length) / pageSize)),
    [pageSize, totalCount, materials.length],
  );

  const selectedCount = selectedIds.length;
  const selectedRows = useMemo(
    () =>
      materials.filter((item) =>
        selectedIds.some((id) => String(id) === String(item.id)),
      ),
    [materials, selectedIds],
  );

  const allVisibleSelected =
    materials.length > 0 &&
    materials.every((item) => selectedIds.includes(item.id));
  const someVisibleSelected =
    materials.some((item) => selectedIds.includes(item.id)) && !allVisibleSelected;

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) =>
        materials.some((item) => String(item.id) === String(id)),
      ),
    );
  }, [materials]);

  useEffect(() => {
    if (!detailMaterial) return;
    const latestMaterial = materials.find(
      (item) => String(item.id) === String(detailMaterial.id),
    );
    if (latestMaterial) {
      setDetailMaterial(latestMaterial);
    }
  }, [detailMaterial, materials]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  const { exportPdf, exportExcel, isExportingPdf, isExportingExcel } =
    useAdminRecordExport({
      endpoint: API_MATERIALS_EXPORT,
      filters: {
        status,
        category,
        room,
        q: debouncedSearch,
      },
      mapItem: mapMaterial,
      title: "Inventarisasi Bahan",
      pdfFilename: "inventarisasi-bahan.pdf",
      excelFilename: "inventarisasi-bahan.xlsx",
      columns: MATERIAL_EXPORT_COLUMNS,
      emptyMessage: "Tidak ada data bahan untuk diunduh.",
      pdfSuccessMessage: "PDF bahan berhasil diunduh.",
      excelSuccessMessage: "Excel bahan berhasil diunduh.",
    });

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("");
    setCategory("");
    setRoom("");
    setPage(1);
  };

  const handleCreatedOrUpdated = () => {
    setReloadKey((prev) => prev + 1);
    setPage(1);
  };

  const handleDelete = async (item: MaterialRow) => {
    const result = await deleteMaterial(item.id);
    if (!result.ok) return;

    setDeleteCandidate(null);
    setSelectedIds((prev) => prev.filter((id) => String(id) !== String(item.id)));
    setReloadKey((prev) => prev + 1);
    toast.success("Bahan berhasil dihapus.");
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;

    const result = await deleteMaterials(selectedIds);
    if (!result.ok) {
      toast.error(result.message || "Gagal menghapus bahan terpilih.");
      return;
    }

    const removedIds = new Set((result.deletedIds ?? []).map((id) => String(id)));
    setSelectedIds((prev) => prev.filter((id) => !removedIds.has(String(id))));
    setIsBulkDeleteOpen(false);
    setReloadKey((prev) => prev + 1);

    if ((result.failedCount ?? 0) > 0) {
      toast.warning(
        `${result.deletedCount ?? 0} bahan berhasil dihapus, ${result.failedCount ?? 0} gagal.`,
      );
      return;
    }

    toast.success(`${result.deletedCount ?? 0} bahan berhasil dihapus.`);
  };

  const handleExportSelectedPdf = async () => {
    try {
      setIsExportingSelectedPdf(true);
      if (!selectedRows.length) {
        throw new Error("Pilih minimal satu bahan untuk diunduh.");
      }
      const { exportAdminRecordPdf } = await import("@/lib/admin/export");
      await exportAdminRecordPdf({
        title: "Inventarisasi Bahan",
        subtitle: `Total data: ${selectedRows.length}`,
        filename: "inventarisasi-bahan-selected.pdf",
        columns: MATERIAL_EXPORT_COLUMNS,
        rows: selectedRows,
      });
      toast.success("PDF bahan terpilih berhasil diunduh.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunduh PDF.");
    } finally {
      setIsExportingSelectedPdf(false);
    }
  };

  const handleExportSelectedExcel = async () => {
    try {
      setIsExportingSelectedExcel(true);
      if (!selectedRows.length) {
        throw new Error("Pilih minimal satu bahan untuk diunduh.");
      }
      const { exportAdminRecordExcel } = await import("@/lib/admin/export");
      await exportAdminRecordExcel({
        title: "Inventarisasi Bahan",
        filename: "inventarisasi-bahan-selected.xlsx",
        columns: MATERIAL_EXPORT_COLUMNS,
        rows: selectedRows,
      });
      toast.success("Excel bahan terpilih berhasil diunduh.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunduh Excel.");
    } finally {
      setIsExportingSelectedExcel(false);
    }
  };

  return (
    <section className="w-full min-w-0 space-y-4 overflow-x-hidden px-4 pb-6">
      <div className="flex w-full min-w-0 flex-col gap-4 lg:flex-row lg:items-start">
        <div className="w-full min-w-0 space-y-4">
          <AdminPageHeader
            title="Inventarisasi Bahan"
            description={`Total ${totalMaterials} bahan terdaftar.`}
            icon={<Plus className="h-5 w-5 text-sky-200" />}
          />

          <AdminFilterCard
            open={filterOpen}
            onToggle={() => setFilterOpen((prev) => !prev)}
            onReset={resetFilters}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
              }}
            >
              <AdminFilterGrid columns={4}>
                <AdminFilterField label="Cari">
                  <Input
                    type="search"
                    value={search}
                    placeholder="Nama atau kategori"
                    className={ADMIN_FILTER_INPUT_CLASS}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                  />
                </AdminFilterField>

                <FilterSelectField
                  label="Status"
                  value={status}
                  options={MATERIAL_STATUS_OPTIONS}
                  onChange={(value) => {
                    setStatus(value);
                    setPage(1);
                  }}
                />
                <FilterSelectField
                  label="Kategori"
                  value={category}
                  options={MATERIAL_CATEGORY_OPTIONS}
                  onChange={(value) => {
                    setCategory(value);
                    setPage(1);
                  }}
                />
                <AdminFilterField label="Ruangan">
                  <select
                    value={room}
                    onChange={(event) => {
                      setRoom(event.target.value);
                      setPage(1);
                    }}
                    className={ADMIN_FILTER_SELECT_CLASS}
                    disabled={isLoadingFilterRooms}
                  >
                    <option value="">
                      {isLoadingFilterRooms ? "Memuat ruangan..." : "Semua ruangan"}
                    </option>
                    {filterRooms.map((roomItem) => (
                      <option key={roomItem.id} value={roomItem.id}>
                        {roomItem.label}
                      </option>
                    ))}
                  </select>
                </AdminFilterField>
              </AdminFilterGrid>
            </form>
          </AdminFilterCard>

          {error ? <InlineErrorAlert>{error}</InlineErrorAlert> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <InventoryBulkActions
              selectedCount={selectedCount}
              isDeleting={isDeleting}
              isExportingSelectedPdf={isExportingSelectedPdf}
              isExportingSelectedExcel={isExportingSelectedExcel}
              onClearSelection={() => setSelectedIds([])}
              onDeleteSelected={() => setIsBulkDeleteOpen(true)}
              onExportSelectedPdf={() => {
                void handleExportSelectedPdf();
              }}
              onExportSelectedExcel={() => {
                void handleExportSelectedExcel();
              }}
            />
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-end">
              <p className="text-xs text-muted-foreground sm:text-right">
                Export mengikuti filter dan pencarian yang sedang aktif.
              </p>
              <AdminRecordExportActions
                onExportExcel={() => {
                  void exportExcel();
                }}
                onExportPdf={() => {
                  void exportPdf();
                }}
                isExportingExcel={isExportingExcel}
                isExportingPdf={isExportingPdf}
              />
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="sm" variant="outline">
                      <FileUp className="h-4 w-4" />
                      Bulk Import
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setBulkImportOpen(true)}>
                      <FileUp className="h-4 w-4" />
                      Bulk Import
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setBulkImportByRoomOpen(true)}>
                      <Building2 className="h-4 w-4" />
                      Bulk Import by Ruangan
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Tambah Bahan
                </Button>
              </div>
            </div>
          </div>

          <MaterialTable
            materials={materials}
            isLoading={isLoading}
            hasLoadedOnce={hasLoadedOnce}
            selectedIds={selectedIds}
            allVisibleSelected={allVisibleSelected}
            isDeleting={isDeleting}
            deleteCandidate={deleteCandidate}
            selectAllRef={selectAllRef}
            onToggleSelectAllVisible={(checked) => {
              if (!checked) {
                setSelectedIds((prev) =>
                  prev.filter(
                    (id) => !materials.some((item) => String(item.id) === String(id)),
                  ),
                );
                return;
              }
              setSelectedIds((prev) => {
                const next = new Set(prev);
                materials.forEach((item) => next.add(item.id));
                return Array.from(next);
              });
            }}
            onToggleItemSelection={(item) => {
              setSelectedIds((prev) =>
                prev.includes(item.id)
                  ? prev.filter((itemId) => itemId !== item.id)
                  : [...prev, item.id],
              );
            }}
            onOpenDetail={(item, mode) => {
              setDetailMode(mode);
              setDetailMaterial(item);
            }}
            onDeleteCandidateChange={setDeleteCandidate}
            onDelete={handleDelete}
          />

          <DataPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalMaterials}
            pageSize={pageSize}
            itemLabel="bahan"
            isLoading={isLoading}
            onPageChange={setPage}
            pageSizeOptions={[...DEFAULT_PAGE_SIZE_OPTIONS]}
            onPageSizeChange={(nextPageSize) => {
              setPage(1);
              setPageSize(nextPageSize);
            }}
          />
        </div>
      </div>

      <MaterialCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreatedOrUpdated}
      />

      <MaterialBulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onCompleted={handleCreatedOrUpdated}
      />

      <MaterialBulkImportByRoomDialog
        open={bulkImportByRoomOpen}
        onOpenChange={setBulkImportByRoomOpen}
        onCompleted={handleCreatedOrUpdated}
      />

      <ConfirmDeleteDialog
        open={isBulkDeleteOpen}
        title="Hapus bahan terpilih?"
        description={`${selectedCount} bahan yang dipilih akan dihapus permanen.`}
        isDeleting={isDeleting}
        onOpenChange={setIsBulkDeleteOpen}
        onConfirm={() => {
          void handleBulkDelete();
        }}
      />

      <AdminMaterialDetailDialog
        open={Boolean(detailMaterial)}
        material={detailMaterial}
        initialMode={detailMode}
        onOpenChange={(open) => {
          if (!open) {
            setDetailMaterial(null);
            setDetailMode("view");
          }
        }}
        onUpdated={() => setReloadKey((prev) => prev + 1)}
        onDeleted={() => {
          setDetailMaterial(null);
          setDetailMode("view");
          setReloadKey((prev) => prev + 1);
        }}
      />
    </section>
  );
}
