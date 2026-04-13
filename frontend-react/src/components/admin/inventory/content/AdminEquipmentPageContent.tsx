"use client";


import { useEffect, useMemo, useRef, useState } from "react";

import { FileUp, Plus } from "lucide-react";

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
  EquipmentCreateDialog,
  EquipmentBulkImportDialog,
  AdminEquipmentDetailDialog,
  EquipmentTable,
  InventoryBulkActions,
} from "@/components/admin/inventory";

import { DataPagination, ConfirmDeleteDialog, InlineErrorAlert } from "@/components/shared";

import { AdminHistoryExportActions as AdminRecordExportActions } from "@/components/admin/history";

import { Button, Input } from "@/components/ui";

import {
  EQUIPMENT_CATEGORY_OPTIONS,
  EQUIPMENT_STATUS_OPTIONS,
  MOVEABLE_OPTIONS,
} from "@/constants/equipments";

import { API_EQUIPMENTS_EXPORT } from "@/constants/api";

import { useAdminRecordExport } from "@/hooks/admin";

import { useDeleteEquipment } from "@/hooks/shared/resources/equipments";

import {
  mapEquipment,
  useEquipments,
  type EquipmentRow,
} from "@/hooks/shared/resources/equipments";

import { useUpdateEquipment } from "@/hooks/shared/resources/equipments";

import { useRoomOptions } from "@/hooks/shared/resources/rooms";

import { usePicUsers } from "@/hooks/shared/resources/users";

import { EQUIPMENT_EXPORT_COLUMNS } from "@/lib/admin/export-config";

const PAGE_SIZE = 20;

const STATUS_STYLES: Record<string, string> = {
  available: "bg-emerald-500/10 text-emerald-600",
  borrowed: "bg-sky-500/10 text-sky-700",
  maintenance: "bg-amber-500/10 text-amber-700",
  broken: "bg-rose-500/10 text-rose-700",
  storage: "bg-slate-500/10 text-slate-600",
};

function formatStatus(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "-";
}

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

export default function AdminEquipmentsPage() {
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [room, setRoom] = useState("");
  const [pic, setPic] = useState("");
  const [moveable, setMoveable] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [detailEquipment, setDetailEquipment] = useState<EquipmentRow | null>(
    null,
  );
  const [detailMode, setDetailMode] = useState<"view" | "edit">("view");
  const [deleteCandidate, setDeleteCandidate] = useState<EquipmentRow | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isExportingSelectedPdf, setIsExportingSelectedPdf] = useState(false);
  const [isExportingSelectedExcel, setIsExportingSelectedExcel] =
    useState(false);
  const [togglingEquipmentId, setTogglingEquipmentId] = useState<
    string | number | null
  >(null);

  const { rooms: filterRooms, isLoading: isLoadingFilterRooms } =
    useRoomOptions();
  const { picUsers: filterPicUsers, isLoading: isLoadingFilterPics } =
    usePicUsers();
  const { deleteEquipment, deleteEquipments, isDeleting } =
    useDeleteEquipment();
  const { updateEquipment } = useUpdateEquipment();

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(search.trim()), 500);
    return () => clearTimeout(timeoutId);
  }, [search]);

  const { equipments, totalCount, isLoading, hasLoadedOnce, error } =
    useEquipments(
      page,
      PAGE_SIZE,
      {
        search: debouncedSearch,
        status,
        category,
        room,
        pic,
        is_moveable: moveable,
      },
      reloadKey,
    );

  const totalEquipments = totalCount || equipments.length;
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((totalCount || equipments.length) / PAGE_SIZE)),
    [totalCount, equipments.length],
  );

  const selectedCount = selectedIds.length;
  const selectedRows = useMemo(
    () =>
      equipments.filter((item) =>
        selectedIds.some((id) => String(id) === String(item.id)),
      ),
    [equipments, selectedIds],
  );

  const allVisibleSelected =
    equipments.length > 0 &&
    equipments.every((item) => selectedIds.includes(item.id));
  const someVisibleSelected =
    equipments.some((item) => selectedIds.includes(item.id)) &&
    !allVisibleSelected;

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) =>
        equipments.some((item) => String(item.id) === String(id)),
      ),
    );
  }, [equipments]);

  useEffect(() => {
    if (!detailEquipment) return;
    const latestEquipment = equipments.find(
      (item) => String(item.id) === String(detailEquipment.id),
    );
    if (latestEquipment) {
      setDetailEquipment(latestEquipment);
    }
  }, [detailEquipment, equipments]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  const { exportPdf, exportExcel, isExportingPdf, isExportingExcel } =
    useAdminRecordExport({
      endpoint: API_EQUIPMENTS_EXPORT,
      filters: {
        status,
        category,
        room,
        pic,
        is_moveable: moveable,
        q: debouncedSearch,
      },
      mapItem: mapEquipment,
      title: "Inventarisasi Peralatan",
      pdfFilename: "inventarisasi-peralatan.pdf",
      excelFilename: "inventarisasi-peralatan.xlsx",
      columns: EQUIPMENT_EXPORT_COLUMNS,
      emptyMessage: "Tidak ada data peralatan untuk diunduh.",
      pdfSuccessMessage: "PDF peralatan berhasil diunduh.",
      excelSuccessMessage: "Excel peralatan berhasil diunduh.",
    });

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("");
    setCategory("");
    setRoom("");
    setPic("");
    setMoveable("");
    setPage(1);
  };

  const handleCreatedOrUpdated = () => {
    setReloadKey((prev) => prev + 1);
    setPage(1);
  };

  const handleDelete = async (item: EquipmentRow) => {
    const result = await deleteEquipment(item.id);
    if (!result.ok) return;

    setDeleteCandidate(null);
    setSelectedIds((prev) =>
      prev.filter((id) => String(id) !== String(item.id)),
    );
    setReloadKey((prev) => prev + 1);
    toast.success("Peralatan berhasil dihapus.");
  };

  const handleToggleAvailability = async (
    item: EquipmentRow,
    nextChecked: boolean,
  ) => {
    setTogglingEquipmentId(item.id);
    const result = await updateEquipment(item.id, {
      name: item.name,
      quantity: item.quantity,
      category: item.category,
      roomId: item.roomId,
      status: nextChecked ? "Available" : "In Storage",
      isMoveable: item.isMoveable,
      isShareable: item.isShareable,
      description: item.description,
      imageId: item.imageId,
    });
    setTogglingEquipmentId(null);

    if (!result.ok) {
      toast.error(result.message || "Gagal memperbarui status peralatan.");
      return;
    }

    setReloadKey((prev) => prev + 1);
    toast.success(
      `Status peralatan diubah menjadi ${nextChecked ? "Available" : "In Storage"}.`,
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;

    const result = await deleteEquipments(selectedIds);
    if (!result.ok) {
      toast.error(result.message || "Gagal menghapus peralatan terpilih.");
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
        `${result.deletedCount ?? 0} peralatan berhasil dihapus, ${result.failedCount ?? 0} gagal.`,
      );
      return;
    }

    toast.success(`${result.deletedCount ?? 0} peralatan berhasil dihapus.`);
  };

  const handleExportSelectedPdf = async () => {
    try {
      setIsExportingSelectedPdf(true);
      if (!selectedRows.length) {
        throw new Error("Pilih minimal satu peralatan untuk diunduh.");
      }
      const { exportAdminRecordPdf } = await import("@/lib/admin/export");
      await exportAdminRecordPdf({
        title: "Inventarisasi Peralatan",
        subtitle: `Total data: ${selectedRows.length}`,
        filename: "inventarisasi-peralatan-selected.pdf",
        columns: EQUIPMENT_EXPORT_COLUMNS,
        rows: selectedRows,
      });
      toast.success("PDF peralatan terpilih berhasil diunduh.");
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
        throw new Error("Pilih minimal satu peralatan untuk diunduh.");
      }
      const { exportAdminRecordExcel } = await import("@/lib/admin/export");
      await exportAdminRecordExcel({
        title: "Inventarisasi Peralatan",
        filename: "inventarisasi-peralatan-selected.xlsx",
        columns: EQUIPMENT_EXPORT_COLUMNS,
        rows: selectedRows,
      });
      toast.success("Excel peralatan terpilih berhasil diunduh.");
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
            title="Inventarisasi Peralatan"
            description={`Total ${totalEquipments} peralatan terdaftar.`}
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
              <AdminFilterGrid columns={6}>
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
                  options={EQUIPMENT_STATUS_OPTIONS}
                  onChange={(value) => {
                    setStatus(value);
                    setPage(1);
                  }}
                />
                <FilterSelectField
                  label="Kategori"
                  value={category}
                  options={EQUIPMENT_CATEGORY_OPTIONS}
                  onChange={(value) => {
                    setCategory(value);
                    setPage(1);
                  }}
                />
                <FilterSelectField
                  label="Moveable"
                  value={moveable}
                  options={MOVEABLE_OPTIONS}
                  onChange={(value) => {
                    setMoveable(value);
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
                      {isLoadingFilterRooms
                        ? "Memuat ruangan..."
                        : "Semua ruangan"}
                    </option>
                    {filterRooms.map((roomItem) => (
                      <option key={roomItem.id} value={roomItem.id}>
                        {roomItem.label}
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
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkImportOpen(true)}
                >
                  <FileUp className="h-4 w-4" />
                  Bulk Import
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Tambah Peralatan
                </Button>
              </div>
            </div>
          </div>

          <EquipmentTable
            equipments={equipments}
            isLoading={isLoading}
            hasLoadedOnce={hasLoadedOnce}
            selectedIds={selectedIds}
            allVisibleSelected={allVisibleSelected}
            isDeleting={isDeleting}
            deleteCandidate={deleteCandidate}
            statusStyles={STATUS_STYLES}
            formatStatus={formatStatus}
            togglingEquipmentId={togglingEquipmentId}
            selectAllRef={selectAllRef}
            onToggleSelectAllVisible={(checked) => {
              if (!checked) {
                setSelectedIds((prev) =>
                  prev.filter(
                    (id) =>
                      !equipments.some(
                        (item) => String(item.id) === String(id),
                      ),
                  ),
                );
                return;
              }
              setSelectedIds((prev) => {
                const next = new Set(prev);
                equipments.forEach((item) => next.add(item.id));
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
            onToggleAvailability={(item, nextChecked) => {
              void handleToggleAvailability(item, nextChecked);
            }}
            onOpenDetail={(item, mode) => {
              setDetailMode(mode);
              setDetailEquipment(item);
            }}
            onDeleteCandidateChange={setDeleteCandidate}
            onDelete={handleDelete}
          />

          <DataPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalEquipments}
            pageSize={PAGE_SIZE}
            itemLabel="peralatan"
            isLoading={isLoading}
            onPageChange={setPage}
          />
        </div>
      </div>

      <EquipmentCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreatedOrUpdated}
      />

      <EquipmentBulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onCompleted={handleCreatedOrUpdated}
      />

      <ConfirmDeleteDialog
        open={isBulkDeleteOpen}
        title="Hapus peralatan terpilih?"
        description={`${selectedCount} peralatan yang dipilih akan dihapus permanen.`}
        isDeleting={isDeleting}
        onOpenChange={setIsBulkDeleteOpen}
        onConfirm={() => {
          void handleBulkDelete();
        }}
      />

      <AdminEquipmentDetailDialog
        open={Boolean(detailEquipment)}
        equipment={detailEquipment}
        initialMode={detailMode}
        onOpenChange={(open) => {
          if (!open) {
            setDetailEquipment(null);
            setDetailMode("view");
          }
        }}
        onUpdated={() => setReloadKey((prev) => prev + 1)}
        onDeleted={() => {
          setDetailEquipment(null);
          setDetailMode("view");
          setReloadKey((prev) => prev + 1);
        }}
      />
    </section>
  );
}
