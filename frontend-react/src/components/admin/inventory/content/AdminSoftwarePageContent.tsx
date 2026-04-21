"use client";


import { useEffect, useMemo, useRef, useState } from "react";

import { Box, ChevronDown, FileUp, Plus } from "lucide-react";

import { toast } from "sonner";

import {
  AdminPageHeader,
  AdminFilterCard,
  AdminFilterField,
  AdminFilterGrid,
  ADMIN_FILTER_INPUT_CLASS,
  ADMIN_FILTER_SELECT_CLASS,
} from "@/components/admin/shared";

import { AdminHistoryExportActions as AdminRecordExportActions } from "@/components/admin/history";

import {
  AdminSoftwareDetailDialog,
  SoftwareBulkImportByEquipmentDialog,
  SoftwareBulkImportDialog,
  InventoryBulkActions,
  SoftwareCreateDialog,
  SoftwareTable,
} from "@/components/admin/inventory";

import { ConfirmDeleteDialog, DataPagination, InlineErrorAlert } from "@/components/shared";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from "@/components/ui";

import { API_SOFTWARES_EXPORT } from "@/constants/api";

import { useAdminRecordExport } from "@/hooks/admin";

import { useEquipmentOptions } from "@/hooks/shared/resources/equipments";

import { useDeleteSoftware } from "@/hooks/shared/resources/softwares";

import {
  mapSoftware,
  useSoftwares,
  type SoftwareRow,
} from "@/hooks/shared/resources/softwares";

import { useAssignedPicUsers } from "@/hooks/shared/resources/users";

import { SOFTWARE_EXPORT_COLUMNS } from "@/lib/admin/export-config";

const PAGE_SIZE = 20;

export default function AdminSoftwarePage() {
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [equipment, setEquipment] = useState("");
  const [pic, setPic] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkImportByEquipmentOpen, setBulkImportByEquipmentOpen] = useState(false);
  const [detailSoftware, setDetailSoftware] = useState<SoftwareRow | null>(
    null,
  );
  const [detailMode, setDetailMode] = useState<"view" | "edit">("view");
  const [deleteCandidate, setDeleteCandidate] = useState<SoftwareRow | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isExportingSelectedPdf, setIsExportingSelectedPdf] = useState(false);
  const [isExportingSelectedExcel, setIsExportingSelectedExcel] =
    useState(false);

  const { equipments: equipmentOptions, isLoading: isLoadingEquipments } =
    useEquipmentOptions();
  const { picUsers: filterPicUsers, isLoading: isLoadingFilterPics } =
    useAssignedPicUsers();
  const { deleteSoftware, deleteSoftwares, isDeleting } = useDeleteSoftware();

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(search.trim()), 500);
    return () => clearTimeout(timeoutId);
  }, [search]);

  const { softwares, totalCount, isLoading, hasLoadedOnce, error } =
    useSoftwares(
      page,
      PAGE_SIZE,
      {
        equipment,
        pic,
        search: debouncedSearch,
      },
      reloadKey,
    );

  const totalSoftwares = totalCount || softwares.length;
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((totalCount || softwares.length) / PAGE_SIZE)),
    [totalCount, softwares.length],
  );

  const selectedCount = selectedIds.length;
  const selectedRows = useMemo(
    () =>
      softwares.filter((item) =>
        selectedIds.some((id) => String(id) === String(item.id)),
      ),
    [selectedIds, softwares],
  );

  const allVisibleSelected =
    softwares.length > 0 &&
    softwares.every((item) => selectedIds.includes(item.id));
  const someVisibleSelected =
    softwares.some((item) => selectedIds.includes(item.id)) &&
    !allVisibleSelected;

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) =>
        softwares.some((item) => String(item.id) === String(id)),
      ),
    );
  }, [softwares]);

  useEffect(() => {
    if (!detailSoftware) return;
    const latestSoftware = softwares.find(
      (item) => String(item.id) === String(detailSoftware.id),
    );
    if (latestSoftware) {
      setDetailSoftware(latestSoftware);
    }
  }, [detailSoftware, softwares]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  const { exportPdf, exportExcel, isExportingPdf, isExportingExcel } =
    useAdminRecordExport({
      endpoint: API_SOFTWARES_EXPORT,
      filters: {
        equipment,
        pic,
        q: debouncedSearch,
      },
      mapItem: mapSoftware,
      title: "Inventarisasi Software",
      pdfFilename: "inventarisasi-software.pdf",
      excelFilename: "inventarisasi-software.xlsx",
      columns: SOFTWARE_EXPORT_COLUMNS,
      emptyMessage: "Tidak ada data software untuk diunduh.",
      pdfSuccessMessage: "PDF software berhasil diunduh.",
      excelSuccessMessage: "Excel software berhasil diunduh.",
    });

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setEquipment("");
    setPic("");
    setPage(1);
  };

  const handleCreatedOrUpdated = () => {
    setReloadKey((prev) => prev + 1);
    setPage(1);
  };

  const handleDelete = async (item: SoftwareRow) => {
    const result = await deleteSoftware(item.id);
    if (!result.ok) return;

    setDeleteCandidate(null);
    setSelectedIds((prev) =>
      prev.filter((id) => String(id) !== String(item.id)),
    );
    setReloadKey((prev) => prev + 1);
    toast.success("Software berhasil dihapus.");
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;

    const result = await deleteSoftwares(selectedIds);
    if (!result.ok) {
      toast.error(result.message || "Gagal menghapus software terpilih.");
      return;
    }

    const removedIds = new Set(
      (result.deletedIds ?? []).map((id) => String(id)),
    );
    setSelectedIds((prev) => prev.filter((id) => !removedIds.has(String(id))));
    setIsBulkDeleteOpen(false);
    setReloadKey((prev) => prev + 1);

    if ((result.failedCount ?? 0) > 0) {
      toast.warning(
        `${result.deletedCount ?? 0} software berhasil dihapus, ${result.failedCount ?? 0} gagal.`,
      );
      return;
    }

    toast.success(`${result.deletedCount ?? 0} software berhasil dihapus.`);
  };

  const handleExportSelectedPdf = async () => {
    try {
      setIsExportingSelectedPdf(true);
      if (!selectedRows.length)
        throw new Error("Pilih minimal satu software untuk diunduh.");
      const { exportAdminRecordPdf } = await import("@/lib/admin/export");
      await exportAdminRecordPdf({
        title: "Inventarisasi Software",
        subtitle: `Total data: ${selectedRows.length}`,
        filename: "inventarisasi-software-selected.pdf",
        columns: SOFTWARE_EXPORT_COLUMNS,
        rows: selectedRows,
      });
      toast.success("PDF software terpilih berhasil diunduh.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunduh PDF.");
    } finally {
      setIsExportingSelectedPdf(false);
    }
  };

  const handleExportSelectedExcel = async () => {
    try {
      setIsExportingSelectedExcel(true);
      if (!selectedRows.length)
        throw new Error("Pilih minimal satu software untuk diunduh.");
      const { exportAdminRecordExcel } = await import("@/lib/admin/export");
      await exportAdminRecordExcel({
        title: "Inventarisasi Software",
        filename: "inventarisasi-software-selected.xlsx",
        columns: SOFTWARE_EXPORT_COLUMNS,
        rows: selectedRows,
      });
      toast.success("Excel software terpilih berhasil diunduh.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengunduh Excel.",
      );
    } finally {
      setIsExportingSelectedExcel(false);
    }
  };

  return (
    <section className="w-full min-w-0 space-y-4 overflow-x-hidden px-4 pb-6">
      <div className="flex w-full min-w-0 flex-col gap-4 lg:flex-row lg:items-start">
        <div className="w-full min-w-0 space-y-4">
          <AdminPageHeader
            title="Inventarisasi Software"
            description={`Total ${totalSoftwares} software terdaftar.`}
            icon={<Box className="h-5 w-5 text-sky-200" />}
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
              <AdminFilterGrid columns={6}>
                <AdminFilterField label="Cari">
                  <Input
                    type="search"
                    value={search}
                    placeholder="Nama software, versi, lisensi"
                    className={ADMIN_FILTER_INPUT_CLASS}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                  />
                </AdminFilterField>
                <AdminFilterField label="Peralatan">
                  <select
                    value={equipment}
                    onChange={(event) => {
                      setEquipment(event.target.value);
                      setPage(1);
                    }}
                    className={ADMIN_FILTER_SELECT_CLASS}
                    disabled={isLoadingEquipments}
                  >
                    <option value="">
                      {isLoadingEquipments
                        ? "Memuat peralatan..."
                        : "Semua peralatan"}
                    </option>
                    {equipmentOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </AdminFilterField>
                <AdminFilterField label="PIC">
                  <select
                    value={pic}
                    onChange={(event) => {
                      setPic(event.target.value);
                      setPage(1);
                    }}
                    className={ADMIN_FILTER_SELECT_CLASS}
                    disabled={isLoadingFilterPics}
                  >
                    <option value="">
                      {isLoadingFilterPics ? "Memuat PIC..." : "Semua PIC"}
                    </option>
                    {filterPicUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
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
                    <DropdownMenuItem
                      onClick={() => setBulkImportByEquipmentOpen(true)}
                    >
                      <Box className="h-4 w-4" />
                      Bulk Import by Peralatan
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Tambah Software
                </Button>
              </div>
            </div>
          </div>

          <SoftwareTable
            softwares={softwares}
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
                    (id) =>
                      !softwares.some((item) => String(item.id) === String(id)),
                  ),
                );
                return;
              }
              setSelectedIds((prev) => {
                const next = new Set(prev);
                softwares.forEach((item) => next.add(item.id));
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
              setDetailSoftware(item);
            }}
            onDeleteCandidateChange={setDeleteCandidate}
            onDelete={handleDelete}
          />

          <DataPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalSoftwares}
            pageSize={PAGE_SIZE}
            itemLabel="software"
            isLoading={isLoading}
            onPageChange={setPage}
          />
        </div>
      </div>

      <SoftwareCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreatedOrUpdated}
      />

      <SoftwareBulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onCompleted={handleCreatedOrUpdated}
      />

      <SoftwareBulkImportByEquipmentDialog
        open={bulkImportByEquipmentOpen}
        onOpenChange={setBulkImportByEquipmentOpen}
        onCompleted={handleCreatedOrUpdated}
      />

      <ConfirmDeleteDialog
        open={isBulkDeleteOpen}
        title="Hapus software terpilih?"
        description={`${selectedCount} software yang dipilih akan dihapus permanen.`}
        isDeleting={isDeleting}
        onOpenChange={setIsBulkDeleteOpen}
        onConfirm={() => {
          void handleBulkDelete();
        }}
      />

      <AdminSoftwareDetailDialog
        open={Boolean(detailSoftware)}
        software={detailSoftware}
        initialMode={detailMode}
        onOpenChange={(open) => {
          if (!open) {
            setDetailSoftware(null);
            setDetailMode("view");
          }
        }}
        onUpdated={() => setReloadKey((prev) => prev + 1)}
        onDeleted={() => {
          setDetailSoftware(null);
          setDetailMode("view");
          setReloadKey((prev) => prev + 1);
        }}
      />
    </section>
  );
}
