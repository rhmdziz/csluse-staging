"use client";

import type { RefObject } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";

import { TableActionIconButton } from "@/components/shared";
import type { Announcement } from "@/hooks/information/announcements";
import { formatDateTimeWib } from "@/lib/date";
import { stripHtmlTags, summarizeText } from "@/lib/text";
import AdminInformationTable from "./AdminInformationTable";

type AnnouncementTableProps = {
  announcements: Announcement[];
  isLoading: boolean;
  emptyMessage?: string;
  selectedIds: Array<string | number>;
  allVisibleSelected: boolean;
  selectAllRef: RefObject<HTMLInputElement | null>;
  onToggleSelectAllVisible: (checked: boolean) => void;
  onToggleItemSelection: (announcement: Announcement) => void;
  onView: (announcement: Announcement) => void;
  onEdit: (announcement: Announcement) => void;
  onDelete: (announcement: Announcement) => void;
};

export default function AnnouncementTable({
  announcements,
  isLoading,
  emptyMessage = "Tidak ada data pengumuman.",
  selectedIds,
  allVisibleSelected,
  selectAllRef,
  onToggleSelectAllVisible,
  onToggleItemSelection,
  onView,
  onEdit,
  onDelete,
}: AnnouncementTableProps) {
  return (
    <AdminInformationTable
      columns={[
        { key: "title", label: "Judul", className: "w-[260px]" },
        { key: "content", label: "Isi", className: "w-[440px]" },
        { key: "created", label: "Dibuat", className: "w-[140px]" },
        {
          key: "actions",
          label: "Aksi",
          className:
            "sticky right-0 z-10 w-[144px] bg-slate-900 text-center shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.35)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-700",
        },
      ]}
      hasRows={announcements.length > 0}
      isLoading={isLoading}
      emptyMessage={emptyMessage}
      tableClassName="min-w-[980px]"
      selectAll={{
        ref: selectAllRef,
        checked: allVisibleSelected,
        ariaLabel: "Pilih semua pengumuman yang tampil",
        onChange: onToggleSelectAllVisible,
      }}
    >
      {announcements.map((announcement) => (
        <tr key={String(announcement.id)} className="border-b last:border-b-0">
          <td className="px-3 py-2 text-center align-top">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 align-middle"
              checked={selectedIds.includes(announcement.id)}
              onChange={() => onToggleItemSelection(announcement)}
              aria-label={`Pilih pengumuman ${announcement.title}`}
            />
          </td>
          <td className="px-3 py-2 align-top">
            <div className="whitespace-normal break-words font-medium text-slate-900">
              {summarizeText(announcement.title || "", 160)}
            </div>
          </td>
          <td className="px-3 py-2 align-top">
            <div className="whitespace-normal break-words text-muted-foreground">
              {summarizeText(stripHtmlTags(announcement.content || ""), 320)}
            </div>
          </td>
          <td className="px-3 py-2 align-top text-muted-foreground">
            {formatDateTimeWib(announcement.created_at)}
          </td>
          <td className="sticky right-0 z-10 bg-card px-3 py-2 align-top shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.18)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200">
            <div className="flex justify-center gap-2">
              <TableActionIconButton
                label="Lihat detail"
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => onView(announcement)}
                icon={<Eye className="h-4 w-4" />}
              />
              <TableActionIconButton
                label="Edit pengumuman"
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => onEdit(announcement)}
                icon={<Pencil className="h-4 w-4" />}
              />
              <TableActionIconButton
                label="Hapus pengumuman"
                type="button"
                variant="outline"
                size="icon-sm"
                className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                onClick={() => onDelete(announcement)}
                icon={<Trash2 className="h-4 w-4" />}
              />
            </div>
          </td>
        </tr>
      ))}
    </AdminInformationTable>
  );
}
