"use client";
import { useEffect, useMemo, useRef, useState } from "react";

import { UserPlus, X } from "lucide-react";

import { toast } from "sonner";

import { AdminDetailDialogShell, InlineErrorAlert } from "@/components/shared";

import { Button, DialogFooter, Input } from "@/components/ui";

import { useUpdateUserProfile } from "@/hooks/shared/resources/users";

import { mapProfile, usersService } from "@/services/shared/resources";

import { USER_MODAL_WIDTH_CLASS } from "@/components/admin/user-management";

type LecturerCandidate = {
  profileId: string;
  name: string;
  email: string;
  department: string;
  idNumber: string;
};

type AssignMentorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
};

export default function AssignMentorDialog({
  open,
  onOpenChange,
  onAssigned,
}: AssignMentorDialogProps) {
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [candidates, setCandidates] = useState<LecturerCandidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<LecturerCandidate[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { updateUserProfile, isSubmitting, message, setMessage } = useUpdateUserProfile();

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedSearchQuery(searchQuery.trim()),
      1000,
    );
    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!dropdownRef.current?.contains(target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    let isAborted = false;

    const loadCandidates = async () => {
      setIsLoadingCandidates(true);
      setLoadError("");

      try {
        const payload = await usersService.getList(
          1,
          200,
          {
            role: "Lecturer",
            isMentor: false,
            search: debouncedSearchQuery,
          },
          controller.signal,
        );
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.results)
            ? payload.results
            : [];
        const nextCandidates = list
          .map((item) => {
            const user = mapProfile(item);
            if (!user.profileId) return null;

            return {
              profileId: String(user.profileId),
              name: String(user.name || user.email || "-"),
              email: String(user.email || "-"),
              department: String(user.department || "-"),
              idNumber: String(user.idNumber || "-"),
            } satisfies LecturerCandidate;
          })
          .filter((item): item is LecturerCandidate => item !== null);

        setCandidates(nextCandidates);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat memuat daftar dosen.",
        );
      } finally {
        if (isAborted || controller.signal.aborted) return;
        setIsLoadingCandidates(false);
      }
    };

    void loadCandidates();

    return () => {
      isAborted = true;
      controller.abort();
    };
  }, [debouncedSearchQuery, open]);

  const selectedProfileIds = useMemo(
    () => new Set(selectedCandidates.map((candidate) => candidate.profileId)),
    [selectedCandidates],
  );
  const filteredCandidates = useMemo(
    () =>
      candidates.filter((candidate) => !selectedProfileIds.has(candidate.profileId)),
    [candidates, selectedProfileIds],
  );

  const resetState = () => {
    setInputValue("");
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setCandidates([]);
    setSelectedCandidates([]);
    setLoadError("");
    setMessage("");
    setIsDropdownOpen(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (!selectedCandidates.length) {
      setMessage("Pilih minimal satu dosen.");
      return;
    }

    try {
      for (const candidate of selectedCandidates) {
        await updateUserProfile(candidate.profileId, { is_mentor: true });
      }

      toast.success(
        `${selectedCandidates.length} dosen pembimbing berhasil ditambahkan.`,
      );
      onAssigned();
      onOpenChange(false);
      resetState();
    } catch {
      // message handled by hook
    }
  };

  return (
    <AdminDetailDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCloseReset={resetState}
      title="Tambahkan Dosen Pembimbing"
      description="Pilih user existing dengan role lecturer untuk dijadikan dosen pembimbing."
      icon={<UserPlus className="h-5 w-5" />}
      contentClassName={`${USER_MODAL_WIDTH_CLASS} gap-0 p-0 [--primary:#0048B4] [--primary-foreground:#FFFFFF] [--ring:#3B82F6]`}
    >
      <form className="space-y-4 px-5 py-4 sm:px-6" onSubmit={handleSubmit}>
        <div ref={dropdownRef} className="space-y-1.5">
          <label className="text-xs font-medium">Pilih Dosen</label>
          <div className="relative">
            <div className="flex min-h-10 w-full flex-wrap items-center gap-2 rounded-md border border-sky-300 bg-sky-50/60 px-3 py-2 shadow-sm focus-within:border-sky-600 focus-within:ring-3 focus-within:ring-sky-200">
              {selectedCandidates.map((candidate) => (
                <span
                  key={candidate.profileId}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-900"
                >
                  <span className="truncate">{candidate.name}</span>
                  <button
                    type="button"
                    className="rounded-full p-0.5 text-sky-700 hover:bg-sky-200"
                    onClick={() => {
                      setSelectedCandidates((prev) =>
                        prev.filter((item) => item.profileId !== candidate.profileId),
                      );
                    }}
                    aria-label={`Hapus ${candidate.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <Input
                value={inputValue}
                placeholder={
                  isLoadingCandidates ? "Memuat daftar dosen..." : "Cari nama atau email dosen"
                }
                disabled={isLoadingCandidates}
                className="h-auto min-w-[14rem] flex-1 border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(event) => {
                  setInputValue(event.target.value);
                  setSearchQuery(event.target.value);
                  setMessage("");
                  setIsDropdownOpen(true);
                }}
              />
            </div>

            {isDropdownOpen ? (
              <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-md border border-sky-200 bg-white shadow-lg">
                {isLoadingCandidates ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Memuat...</div>
                ) : filteredCandidates.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Tidak ada dosen yang bisa dipilih.
                  </div>
                ) : (
                  filteredCandidates.map((candidate) => (
                    <button
                      key={candidate.profileId}
                      type="button"
                      className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-sky-50"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setSelectedCandidates((prev) =>
                          prev.some((item) => item.profileId === candidate.profileId)
                            ? prev
                            : [...prev, candidate],
                        );
                        setInputValue("");
                        setSearchQuery("");
                        setMessage("");
                        setIsDropdownOpen(true);
                      }}
                    >
                      <span className="truncate font-medium">{candidate.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {candidate.email}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>

        {loadError ? <InlineErrorAlert>{loadError}</InlineErrorAlert> : null}
        {message ? <InlineErrorAlert>{message}</InlineErrorAlert> : null}

        <DialogFooter>
          <Button
            type="submit"
            disabled={isSubmitting || isLoadingCandidates || !selectedCandidates.length}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            {isSubmitting ? "Menyimpan..." : "Tambahkan Dosen Pembimbing"}
          </Button>
        </DialogFooter>
      </form>
    </AdminDetailDialogShell>
  );
}
