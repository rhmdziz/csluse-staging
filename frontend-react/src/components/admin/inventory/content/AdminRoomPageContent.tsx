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
  InventoryBulkActions,
  AdminRoomDetailDialog,
  RoomEquipmentsDialog,
  RoomCreateDialog,
  RoomBulkImportDialog,
  RoomTable,
} from "@/components/admin/inventory";

import { DataPagination, ConfirmDeleteDialog, InlineErrorAlert } from "@/components/shared";

import { AdminHistoryExportActions as AdminRecordExportActions } from "@/components/admin/history";

import { Button, Input } from "@/components/ui";

import { API_ROOMS_EXPORT } from "@/constants/api";

import { useAdminRecordExport } from "@/hooks/admin";

import { useDeleteRoom } from "@/hooks/shared/resources/rooms";

import { mapRoom, useRooms, type RoomRow } from "@/hooks/shared/resources/rooms";

import { useAssignedPicUsers } from "@/hooks/shared/resources/users";

import { ROOM_EXPORT_COLUMNS } from "@/lib/admin/export-config";

const PAGE_SIZE = 20;

export default function AdminRoomsPage() {
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [floor, setFloor] = useState("");
  const [pic, setPic] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [detailRoom, setDetailRoom] = useState<RoomRow | null>(null);
  const [equipmentRoom, setEquipmentRoom] = useState<RoomRow | null>(null);
  const [detailMode, setDetailMode] = useState<"view" | "edit">("view");
  const [deleteCandidate, setDeleteCandidate] = useState<RoomRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isExportingSelectedPdf, setIsExportingSelectedPdf] = useState(false);
  const [isExportingSelectedExcel, setIsExportingSelectedExcel] =
    useState(false);

  const { picUsers: filterPicUsers, isLoading: isLoadingFilterPics } =
    useAssignedPicUsers();
  const { deleteRoom, deleteRooms, isDeleting } = useDeleteRoom();

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(search.trim()), 500);
    return () => clearTimeout(timeoutId);
  }, [search]);

  const { rooms, totalCount, isLoading, hasLoadedOnce, error } = useRooms(
    page,
    PAGE_SIZE,
    {
      floor,
      pic,
      search: debouncedSearch,
    },
    reloadKey,
  );

  const totalRooms = totalCount || rooms.length;
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((totalCount || rooms.length) / PAGE_SIZE)),
    [totalCount, rooms.length],
  );

  const selectedCount = selectedIds.length;
  const selectedRows = useMemo(
    () =>
      rooms.filter((room) =>
        selectedIds.some((id) => String(id) === String(room.id)),
      ),
    [rooms, selectedIds],
  );

  const allVisibleSelected =
    rooms.length > 0 && rooms.every((room) => selectedIds.includes(room.id));
  const someVisibleSelected =
    rooms.some((room) => selectedIds.includes(room.id)) && !allVisibleSelected;

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) => rooms.some((room) => String(room.id) === String(id))),
    );
  }, [rooms]);

  useEffect(() => {
    if (!detailRoom) return;
    const latestRoom = rooms.find(
      (room) => String(room.id) === String(detailRoom.id),
    );
    if (latestRoom) {
      setDetailRoom(latestRoom);
    }
  }, [detailRoom, rooms]);

  useEffect(() => {
    if (!equipmentRoom) return;
    const latestRoom = rooms.find(
      (room) => String(room.id) === String(equipmentRoom.id),
    );
    if (latestRoom) {
      setEquipmentRoom(latestRoom);
    }
  }, [equipmentRoom, rooms]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  const { exportPdf, exportExcel, isExportingPdf, isExportingExcel } =
    useAdminRecordExport({
      endpoint: API_ROOMS_EXPORT,
      filters: {
        floor,
        pic,
        q: debouncedSearch,
      },
      mapItem: mapRoom,
      title: "Inventarisasi Ruangan",
      pdfFilename: "inventarisasi-ruangan.pdf",
      excelFilename: "inventarisasi-ruangan.xlsx",
      columns: ROOM_EXPORT_COLUMNS,
      emptyMessage: "Tidak ada data ruangan untuk diunduh.",
      pdfSuccessMessage: "PDF ruangan berhasil diunduh.",
      excelSuccessMessage: "Excel ruangan berhasil diunduh.",
    });

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setFloor("");
    setPic("");
    setPage(1);
  };

  const handleCreated = () => {
    setReloadKey((prev) => prev + 1);
    setPage(1);
  };

  const handleDelete = async (room: RoomRow) => {
    const result = await deleteRoom(room.id);
    if (!result.ok) return;

    setDeleteCandidate(null);
    setSelectedIds((prev) =>
      prev.filter((id) => String(id) !== String(room.id)),
    );
    setReloadKey((prev) => prev + 1);
    toast.success("Ruangan berhasil dihapus.");
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;

    const result = await deleteRooms(selectedIds);
    if (!result.ok) {
      toast.error(result.message || "Gagal menghapus ruangan terpilih.");
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
        `${result.deletedCount ?? 0} ruangan berhasil dihapus, ${result.failedCount ?? 0} gagal.`,
      );
      return;
    }

    toast.success(`${result.deletedCount ?? 0} ruangan berhasil dihapus.`);
  };

  const handleExportSelectedPdf = async () => {
    try {
      setIsExportingSelectedPdf(true);
      if (!selectedRows.length) {
        throw new Error("Pilih minimal satu ruangan untuk diunduh.");
      }
      const { exportAdminRecordPdf } = await import("@/lib/admin/export");
      await exportAdminRecordPdf({
        title: "Inventarisasi Ruangan",
        subtitle: `Total data: ${selectedRows.length}`,
        filename: "inventarisasi-ruangan-selected.pdf",
        columns: ROOM_EXPORT_COLUMNS,
        rows: selectedRows,
      });
      toast.success("PDF ruangan terpilih berhasil diunduh.");
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
        throw new Error("Pilih minimal satu ruangan untuk diunduh.");
      }
      const { exportAdminRecordExcel } = await import("@/lib/admin/export");
      await exportAdminRecordExcel({
        title: "Inventarisasi Ruangan",
        filename: "inventarisasi-ruangan-selected.xlsx",
        columns: ROOM_EXPORT_COLUMNS,
        rows: selectedRows,
      });
      toast.success("Excel ruangan terpilih berhasil diunduh.");
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
            title="Inventarisasi Ruangan"
            description={`Total ${totalRooms} ruangan terdaftar.`}
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
                    placeholder="Nama ruangan atau nomor"
                    className={ADMIN_FILTER_INPUT_CLASS}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                  />
                </AdminFilterField>
                <AdminFilterField label="Lantai">
                  <Input
                    value={floor}
                    placeholder="Semua"
                    className={ADMIN_FILTER_INPUT_CLASS}
                    onChange={(event) => {
                      setFloor(event.target.value);
                      setPage(1);
                    }}
                  />
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
                  Import Ruangan
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Tambah Ruangan
                </Button>
              </div>
            </div>
          </div>

          <RoomTable
            rooms={rooms}
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
                      !rooms.some((room) => String(room.id) === String(id)),
                  ),
                );
                return;
              }
              setSelectedIds((prev) => {
                const next = new Set(prev);
                rooms.forEach((room) => next.add(room.id));
                return Array.from(next);
              });
            }}
            onToggleItemSelection={(room) => {
              setSelectedIds((prev) =>
                prev.includes(room.id)
                  ? prev.filter((itemId) => itemId !== room.id)
                  : [...prev, room.id],
              );
            }}
            onOpenDetail={(room, mode) => {
              setDetailMode(mode);
              setDetailRoom(room);
            }}
            onOpenEquipments={(room) => {
              setEquipmentRoom(room);
            }}
            onDeleteCandidateChange={setDeleteCandidate}
            onDelete={handleDelete}
          />

          <DataPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalRooms}
            pageSize={PAGE_SIZE}
            itemLabel="ruangan"
            isLoading={isLoading}
            onPageChange={setPage}
          />
        </div>
      </div>

      <RoomCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />

      <RoomBulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onCompleted={handleCreated}
      />

      <ConfirmDeleteDialog
        open={isBulkDeleteOpen}
        title="Hapus ruangan terpilih?"
        description={`${selectedCount} ruangan yang dipilih akan dihapus permanen.`}
        isDeleting={isDeleting}
        onOpenChange={setIsBulkDeleteOpen}
        onConfirm={() => {
          void handleBulkDelete();
        }}
      />

      <AdminRoomDetailDialog
        open={Boolean(detailRoom)}
        room={detailRoom}
        initialMode={detailMode}
        onOpenChange={(open) => {
          if (!open) {
            setDetailRoom(null);
            setDetailMode("view");
          }
        }}
        onUpdated={() => setReloadKey((prev) => prev + 1)}
        onDeleted={() => {
          setDetailRoom(null);
          setDetailMode("view");
          setReloadKey((prev) => prev + 1);
        }}
      />

      <RoomEquipmentsDialog
        open={Boolean(equipmentRoom)}
        roomId={equipmentRoom?.id ?? null}
        roomName={equipmentRoom?.name ?? null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setEquipmentRoom(null);
          }
        }}
      />
    </section>
  );
}
