"use client";


import { useEffect, useMemo, useRef, useState } from "react";

import { FileUp, Plus, UserPlus } from "lucide-react";

import { useSearchParams } from "next/navigation";

import {
  AdminPageHeader,
  AdminFilterCard,
  AdminFilterField,
  AdminFilterGrid,
  ADMIN_FILTER_INPUT_CLASS,
  ADMIN_FILTER_SELECT_CLASS,
} from "@/components/admin/shared";

import {
  AdminHistoryExportActions as AdminRecordExportActions,
  AdminHistorySummaryCards as AdminRecordSummaryCards,
} from "@/components/admin/history";

import { ConfirmDeleteDialog, InlineErrorAlert, DataPagination } from "@/components/shared";

import {
  BulkCreateDialog,
  CreateUserDialog,
  UserBulkActions,
  UserDetailDialog,
  UserTable,
} from "@/components/admin/user-management";

import { Button, Input } from "@/components/ui";

import { API_AUTH_ADMIN_PROFILE } from "@/constants/api";

import { BATCH_OPTIONS } from "@/constants/batches";

import { DEPARTMENT_VALUES } from "@/constants/departments";

import { ROLE_FILTER_OPTIONS, isPrivilegedRole, normalizeRoleValue } from "@/constants/roles";

import { useAdminRecordExport } from "@/hooks/admin";

import { useLoadProfile } from "@/hooks/shared/profile";

import { useUserManagementActions } from "@/hooks/shared/resources/users";

import { mapProfile, useUsers } from "@/hooks/shared/resources/users";

import { USER_EXPORT_COLUMNS } from "@/lib/admin/export-config";

type FiltersState = {
  department: string;
  role: string;
  batch: string;
  status: string;
};

const PAGE_SIZE = 20;

type UserManagementContentProps = {
  forcedRole?: string;
  title?: string;
  description?: string;
  showExportActions?: boolean;
  showImportButton?: boolean;
  showCreateButton?: boolean;
  createButtonLabel?: string;
};

export default function UserManagementContent({
  forcedRole,
  title = "Akun dan Profile",
  description,
  showExportActions = true,
  showImportButton = true,
  showCreateButton = true,
  createButtonLabel = "Tambah Akun/Profile",
}: UserManagementContentProps) {
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const searchParams = useSearchParams();
  const roleParam = forcedRole ?? searchParams.get("role");
  const isRoleScoped = Boolean(roleParam);

  const { profile } = useLoadProfile();
  const canManageUsers = isPrivilegedRole(profile?.role);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<FiltersState>({
    department: "",
    role: "",
    batch: "",
    status: "",
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const effectiveFilters = useMemo(
    () => ({
      ...filters,
      role: roleParam ? normalizeRoleValue(roleParam) : filters.role,
      hasUser:
        filters.status === "active"
          ? true
          : filters.status === "pre_provisioned"
            ? false
            : undefined,
    }),
    [filters, roleParam],
  );

  const {
    users,
    setUsers,
    totalCount,
    setTotalCount,
    aggregates,
    isLoading,
    hasLoadedOnce,
    error,
    setError,
  } = useUsers(
    page,
    PAGE_SIZE,
    {
      ...effectiveFilters,
        search: debouncedSearch,
      },
      reloadKey,
  );

  const { exportPdf, exportExcel, isExportingPdf, isExportingExcel } =
    useAdminRecordExport({
      endpoint: API_AUTH_ADMIN_PROFILE,
      filters: {
        department: effectiveFilters.department,
        role: effectiveFilters.role,
        batch: effectiveFilters.batch,
        search: debouncedSearch,
        has_user:
          typeof effectiveFilters.hasUser === "boolean"
            ? String(effectiveFilters.hasUser)
            : "",
      },
      mapItem: mapProfile,
      title: "Akun dan Profile",
      pdfFilename: "akun-dan-profile.pdf",
      excelFilename: "akun-dan-profile.xlsx",
      columns: USER_EXPORT_COLUMNS,
      emptyMessage: "Tidak ada data akun/profile untuk diunduh.",
      pdfSuccessMessage: "PDF akun/profile berhasil diunduh.",
      excelSuccessMessage: "Excel akun/profile berhasil diunduh.",
    });

  const actions = useUserManagementActions({
    canManageUsers,
    users,
    setUsers,
    setTotalCount,
    setError,
    onDataChanged: () => setReloadKey((prev) => prev + 1),
  });

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(search.trim()), 500);
    return () => clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    actions.syncSelectionWithUsers(users);
    // sync selection only when the current page of users changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = Boolean(actions.someVisibleSelected);
  }, [actions.someVisibleSelected]);

  const totalUsers = totalCount || users.length;
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((totalCount || users.length) / PAGE_SIZE)),
    [totalCount, users.length],
  );

  const columnCount = isRoleScoped
    ? canManageUsers
      ? 8
      : 7
    : canManageUsers
      ? 9
      : 8;

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setFilters({ department: "", role: "", batch: "", status: "" });
    setPage(1);
  };

  return (
    <section className="w-full min-w-0 space-y-4 overflow-x-hidden px-4 pb-6">
      <div className="flex min-w-0 items-start gap-4">
        <div className="min-w-0 flex-1 space-y-4">
          <AdminPageHeader
            title={title}
            description={description ?? `Total ${totalUsers} akun/profile terdaftar.`}
            icon={<UserPlus className="h-5 w-5 text-sky-200" />}
          />

          {!isRoleScoped ? (
            <AdminRecordSummaryCards
              items={[
                { label: "Total", value: aggregates.total, tone: "blue" },
                { label: "Student", value: aggregates.student, tone: "blue" },
                { label: "Lecturer", value: aggregates.lecturer, tone: "emerald" },
                { label: "Admin", value: aggregates.admin, tone: "sky" },
                { label: "Staff", value: aggregates.staff, tone: "amber" },
                { label: "Guest", value: aggregates.guest, tone: "slate" },
              ]}
            />
          ) : null}

          {!isRoleScoped ? (
            <AdminFilterCard
              open={filterOpen}
              onToggle={() => setFilterOpen((prev) => !prev)}
              onReset={resetFilters}
            >
              <form onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
              }}>
                <AdminFilterGrid columns={5}>
                <AdminFilterField label="Cari">
                  <Input
                    type="search"
                    value={search}
                    placeholder="Nama, email, atau ID"
                    className={ADMIN_FILTER_INPUT_CLASS}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                  />
                </AdminFilterField>

                <SelectField
                  label="Department"
                  value={filters.department}
                  options={DEPARTMENT_VALUES}
                  onChange={(value) => {
                    setFilters((prev) => ({ ...prev, department: value }));
                    setPage(1);
                  }}
                />
                <SelectField
                  label="Role"
                  value={filters.role}
                  options={ROLE_FILTER_OPTIONS}
                  onChange={(value) => {
                    setFilters((prev) => ({ ...prev, role: value }));
                    setPage(1);
                  }}
                />
                <SelectField
                  label="Batch"
                  value={filters.batch}
                  options={BATCH_OPTIONS}
                  onChange={(value) => {
                    setFilters((prev) => ({ ...prev, batch: value }));
                    setPage(1);
                  }}
                />
                <SelectField
                  label="Status"
                  value={filters.status}
                  options={[
                    { value: "pre_provisioned", label: "Belum Login" },
                    { value: "active", label: "Sudah Login" },
                  ]}
                  onChange={(value) => {
                    setFilters((prev) => ({ ...prev, status: value }));
                    setPage(1);
                  }}
                />
                </AdminFilterGrid>
              </form>
            </AdminFilterCard>
          ) : null}

          {error ? (
            <InlineErrorAlert>{error}</InlineErrorAlert>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {canManageUsers ? (
              <UserBulkActions
                selectedCount={actions.selectedCount}
                isDeleting={actions.isDeleting}
                onClearSelection={() => actions.setSelectedIds([])}
                onDeleteSelected={() => actions.setIsBulkDeleteOpen(true)}
              />
            ) : (
              <div />
            )}
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-end">
              {showExportActions ? (
                <p className="text-xs text-muted-foreground sm:text-right">
                  Export mengikuti filter dan pencarian yang sedang aktif.
                </p>
              ) : null}
              {showExportActions ? (
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
              ) : null}
              {canManageUsers ? (
                <>
                  {showImportButton ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setBulkOpen(true)}
                    >
                      <FileUp className="h-4 w-4" />
                      Import Akun/Profile
                    </Button>
                  ) : null}
                  {showCreateButton ? (
                    <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                      <Plus className="h-4 w-4" />
                      {createButtonLabel}
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          <UserTable
            users={users}
            isLoading={isLoading}
            hasLoadedOnce={hasLoadedOnce}
            canManageUsers={canManageUsers}
            isRoleScoped={isRoleScoped}
            selectedIds={actions.selectedIds}
            allVisibleSelected={Boolean(actions.allVisibleSelected)}
            onToggleItemSelection={actions.toggleItemSelection}
            onToggleSelectAllVisible={actions.toggleSelectAllVisible}
            onOpenDetail={actions.openDetail}
            onDelete={actions.setDeleteCandidate}
            isDeleting={actions.isDeleting}
            selectAllRef={selectAllRef}
          />

          <DataPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            itemLabel="profile"
            isLoading={isLoading}
            onPageChange={setPage}
          />
        </div>
      </div>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        roleParam={roleParam}
        onCreated={() => setReloadKey((prev) => prev + 1)}
      />
      {showImportButton ? (
        <BulkCreateDialog
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          roleParam={roleParam}
          onCompleted={() => setReloadKey((prev) => prev + 1)}
        />
      ) : null}
      <UserDetailDialog
        open={Boolean(actions.detailState.user)}
        user={actions.detailState.user}
        mode={actions.detailState.mode}
        canManageUsers={canManageUsers}
        onOpenChange={(open) => {
          if (!open) actions.closeDetail();
        }}
        onDeleteRequest={actions.setDeleteCandidate}
        onUserUpdated={(updatedUser) => {
          setUsers((prev) =>
            prev.map((item) =>
              String(item.id) === String(updatedUser.id) ? updatedUser : item,
            ),
          );
          actions.openDetail(updatedUser, actions.detailState.mode);
        }}
      />
      <ConfirmDeleteDialog
        open={Boolean(actions.deleteCandidate)}
        title={actions.deleteCandidate?.hasUser ? "Hapus akun dan profile?" : "Hapus profile?"}
        description={
          actions.deleteCandidate
            ? actions.deleteCandidate.hasUser
              ? `Akun dan profile ${actions.deleteCandidate.name || actions.deleteCandidate.email} akan dihapus.`
              : `Profile pre-provisioned ${actions.deleteCandidate.name || actions.deleteCandidate.email} akan dihapus.`
            : "Data yang dihapus tidak bisa dikembalikan."
        }
        isDeleting={actions.isDeleting}
        onOpenChange={(open) => {
          if (!open) actions.setDeleteCandidate(null);
        }}
        onConfirm={() => {
          void actions.handleDelete();
        }}
      />
      <ConfirmDeleteDialog
        open={actions.isBulkDeleteOpen}
        title="Hapus item terpilih?"
        description={`${actions.selectedCount} item yang dipilih akan dihapus permanen.`}
        isDeleting={actions.isDeleting}
        onOpenChange={actions.setIsBulkDeleteOpen}
        onConfirm={() => {
          void actions.handleBulkDelete();
        }}
      />
    </section>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  options: Array<string | { value: string; label: string }>;
  onChange: (value: string) => void;
};

function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  return (
    <AdminFilterField label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={ADMIN_FILTER_SELECT_CLASS}
      >
        <option value="">Semua</option>
        {options.map((opt) => (
          <option
            key={typeof opt === "string" ? opt : opt.value}
            value={typeof opt === "string" ? opt : opt.value}
          >
            {typeof opt === "string" ? opt : opt.label}
          </option>
        ))}
      </select>
    </AdminFilterField>
  );
}
