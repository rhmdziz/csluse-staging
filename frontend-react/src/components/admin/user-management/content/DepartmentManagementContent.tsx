"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  AdminFilterCard,
  AdminFilterField,
  AdminPageHeader,
  ADMIN_FILTER_INPUT_CLASS,
} from "@/components/admin/shared";
import {
  AdminDetailDialogShell,
  ConfirmDeleteDialog,
  InlineErrorAlert,
} from "@/components/shared";
import { Button, DialogFooter, Input } from "@/components/ui";
import { useDepartments } from "@/hooks/shared/resources/departments";
import { departmentsService, type DepartmentRow } from "@/services/shared/resources";
import { extractApiErrorMessage } from "@/lib/core";
import {
  DepartmentBulkActions,
  DepartmentTable,
} from "@/components/admin/user-management";

type DepartmentFormDialogProps = {
  open: boolean;
  mode: "create" | "edit" | "view";
  initialDepartment: DepartmentRow | null;
  isSubmitting: boolean;
  errorMessage: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
};

function DepartmentFormDialog({
  open,
  mode,
  initialDepartment,
  isSubmitting,
  errorMessage,
  onOpenChange,
  onSubmit,
}: DepartmentFormDialogProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(initialDepartment?.name ?? "");
  }, [initialDepartment, open]);

  return (
    <AdminDetailDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={
        mode === "create"
          ? "Tambah Department"
          : mode === "edit"
            ? "Edit Department"
            : "Detail Department"
      }
      description={
        mode === "create"
          ? "Tambahkan department baru agar dapat dipilih di profile dan user management."
          : mode === "edit"
            ? "Perbarui nama department. Profile yang memakai department ini akan ikut tersinkron."
            : "Tinjau detail department yang tersedia di sistem."
      }
      icon={<Building2 className="h-5 w-5" />}
      contentClassName="max-w-lg gap-0 p-0 [--primary:#0048B4] [--primary-foreground:#FFFFFF] [--ring:#3B82F6]"
    >
      <form
        className="space-y-4 px-5 py-4 sm:px-6"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(name);
        }}
      >
        <div className="space-y-1">
          <label className="text-xs font-medium">Nama Department</label>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Masukkan nama department"
            className="border-sky-300 bg-sky-50/60 shadow-sm focus-visible:border-sky-600 focus-visible:ring-sky-200"
            disabled={mode === "view"}
          />
        </div>
        {errorMessage ? <InlineErrorAlert>{errorMessage}</InlineErrorAlert> : null}
        {mode !== "view" ? (
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan..." : mode === "create" ? "Tambah Department" : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        ) : null}
      </form>
    </AdminDetailDialogShell>
  );
}

function buildMutationErrorMessage(data: unknown, fallback: string) {
  return extractApiErrorMessage(data, fallback, ["name", "detail", "profile_count"]);
}

export default function DepartmentManagementContent() {
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<DepartmentRow | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<DepartmentRow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const { departments, totalCount, isLoading, hasLoadedOnce, error } = useDepartments(
    1,
    1000,
    { search: debouncedSearch },
    reloadKey,
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const selectedCount = selectedIds.length;
  const allVisibleSelected =
    departments.length > 0 &&
    departments.every((department) => selectedIds.includes(department.id));
  const someVisibleSelected =
    departments.some((department) => selectedIds.includes(department.id)) && !allVisibleSelected;

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
  };

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) => departments.some((department) => String(department.id) === String(id))),
    );
  }, [departments]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  const openCreateDialog = () => {
    setDialogMode("create");
    setEditingDepartment(null);
    setFormError("");
    setDialogOpen(true);
  };

  const handleSubmit = async (name: string) => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      setFormError("Nama department wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const result =
        dialogMode === "create"
          ? await departmentsService.create(normalizedName)
          : await departmentsService.update(String(editingDepartment?.id ?? ""), normalizedName);

      if (!result.ok) {
        setFormError(
          buildMutationErrorMessage(
            result.data,
            dialogMode === "create"
              ? "Gagal menambahkan department."
              : "Gagal memperbarui department.",
          ),
        );
        return;
      }

      setDialogOpen(false);
      setEditingDepartment(null);
      setSelectedIds([]);
      setReloadKey((prev) => prev + 1);
      toast.success(
        dialogMode === "create"
          ? "Department berhasil ditambahkan."
          : "Department berhasil diperbarui.",
      );
    } catch (mutationError) {
      setFormError(
        mutationError instanceof Error
          ? mutationError.message
          : "Terjadi kesalahan jaringan. Coba lagi.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteCandidate) return;

    setIsDeleting(true);
    setDeleteError("");

    try {
      const result = await departmentsService.remove(deleteCandidate.id);
      if (!result.ok) {
        const message = buildMutationErrorMessage(
          result.data,
          "Gagal menghapus department.",
        );
        setDeleteError(message);
        toast.error(message);
        return;
      }

      setDeleteCandidate(null);
      setSelectedIds((prev) => prev.filter((id) => String(id) !== String(deleteCandidate.id)));
      setReloadKey((prev) => prev + 1);
      toast.success("Department berhasil dihapus.");
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : "Terjadi kesalahan jaringan. Coba lagi.";
      setDeleteError(message);
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;

    setIsDeleting(true);
    setDeleteError("");

    try {
      const result = await departmentsService.bulkRemove(selectedIds);
      const data = (result.data ?? {}) as {
        detail?: string;
        deleted_ids?: Array<string | number>;
        failed_ids?: Array<string | number>;
        deleted_count?: number;
        failed_count?: number;
      };

      if (!result.ok) {
        const message = buildMutationErrorMessage(data, "Gagal menghapus department terpilih.");
        setDeleteError(message);
        toast.error(message);
        return;
      }

      const deletedIdSet = new Set(
        Array.isArray(data.deleted_ids) ? data.deleted_ids.map((id) => String(id)) : [],
      );
      setSelectedIds((prev) => prev.filter((id) => !deletedIdSet.has(String(id))));
      setBulkDeleteOpen(false);
      setReloadKey((prev) => prev + 1);

      if ((data.failed_count ?? 0) > 0) {
        toast.warning(
          `${data.deleted_count ?? 0} department berhasil dihapus, ${data.failed_count ?? 0} gagal.`,
        );
        return;
      }

      toast.success(`${data.deleted_count ?? 0} department berhasil dihapus.`);
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : "Terjadi kesalahan jaringan. Coba lagi.";
      setDeleteError(message);
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleItemSelection = (department: DepartmentRow) => {
    setSelectedIds((prev) =>
      prev.includes(department.id)
        ? prev.filter((item) => item !== department.id)
        : [...prev, department.id],
    );
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    if (!checked) {
      setSelectedIds((prev) =>
        prev.filter((id) => !departments.some((department) => String(department.id) === String(id))),
      );
      return;
    }

    setSelectedIds((prev) => {
      const visibleIds = departments.map((department) => department.id);
      const next = new Set(prev);
      visibleIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  const openDetail = (department: DepartmentRow, mode: "view" | "edit") => {
    setDialogMode(mode);
    setEditingDepartment(department);
    setFormError("");
    setDialogOpen(true);
  };

  return (
    <section className="w-full min-w-0 space-y-4 overflow-x-hidden px-4 pb-6">
      <AdminPageHeader
        title="Department"
        description={
          debouncedSearch
            ? `Kelola master department. Ditemukan ${totalCount} department untuk pencarian ini.`
            : `Kelola master department. Saat ini tersedia ${totalCount} department.`
        }
        icon={<Building2 className="h-5 w-5 text-sky-200" />}
      />

      <AdminFilterCard
        open={filterOpen}
        onToggle={() => setFilterOpen((prev) => !prev)}
        onReset={resetFilters}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <AdminFilterField label="Cari Department">
            <Input
              type="search"
              value={search}
              placeholder="Cari nama department"
              className={ADMIN_FILTER_INPUT_CLASS}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
            />
          </AdminFilterField>
        </form>
      </AdminFilterCard>

      {error ? <InlineErrorAlert>{error}</InlineErrorAlert> : null}
      {deleteError ? <InlineErrorAlert>{deleteError}</InlineErrorAlert> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DepartmentBulkActions
          selectedCount={selectedCount}
          isDeleting={isDeleting}
          onClearSelection={() => setSelectedIds([])}
          onDeleteSelected={() => setBulkDeleteOpen(true)}
        />
        <Button type="button" size="sm" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          Tambah Department
        </Button>
      </div>

      <DepartmentTable
        departments={departments}
        isLoading={isLoading}
        hasLoadedOnce={hasLoadedOnce}
        selectedIds={selectedIds}
        allVisibleSelected={allVisibleSelected}
        isDeleting={isDeleting}
        selectAllRef={selectAllRef}
        onToggleSelectAllVisible={toggleSelectAllVisible}
        onToggleItemSelection={toggleItemSelection}
        onOpenDetail={openDetail}
        onDelete={(department) => {
          setDeleteError("");
          setDeleteCandidate(department);
        }}
      />
      <DepartmentFormDialog
        open={dialogOpen}
        mode={dialogMode}
        initialDepartment={editingDepartment}
        isSubmitting={isSubmitting}
        errorMessage={formError}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingDepartment(null);
            setFormError("");
          }
        }}
        onSubmit={(name) => {
          void handleSubmit(name);
        }}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteCandidate)}
        title="Hapus department?"
        description={
          deleteCandidate
            ? `Department ${deleteCandidate.name} akan dihapus dari master data.`
            : "Data yang dihapus tidak bisa dikembalikan."
        }
        isDeleting={isDeleting}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteCandidate(null);
            setDeleteError("");
          }
        }}
        onConfirm={() => {
          void handleDelete();
        }}
      />
      <ConfirmDeleteDialog
        open={bulkDeleteOpen}
        title="Hapus department terpilih?"
        description={`${selectedCount} department yang dipilih akan dihapus permanen.`}
        isDeleting={isDeleting}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={() => {
          void handleBulkDelete();
        }}
      />
    </section>
  );
}
