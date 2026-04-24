"use client";

import type { BookingRow } from "@/hooks/booking-rooms";
import type { BorrowRow } from "@/hooks/borrow-equipment";
import type { SampleTestingRow } from "@/hooks/sample-testing";
import type { UserRow } from "@/hooks/shared/resources/users";
import type { RoomRow } from "@/hooks/shared/resources/rooms";
import type { EquipmentRow } from "@/hooks/shared/resources/equipments";
import type { MaterialRow } from "@/hooks/shared/resources/materials";
import type { SoftwareRow } from "@/hooks/shared/resources/softwares";
import { formatDateTimeId } from "@/lib/date";
import { getStatusDisplayLabel } from "@/lib/request";

export type ExportColumn<TRow> = {
  header: string;
  cell: (row: TRow) => string;
};

export const BOOKING_EXPORT_COLUMNS: ExportColumn<BookingRow>[] = [
  { header: "Kode", cell: (booking) => booking.code },
  { header: "Status", cell: (booking) => getStatusDisplayLabel(booking.status) },
  { header: "Ruangan", cell: (booking) => booking.roomName },
  { header: "No. Ruangan", cell: (booking) => booking.roomNumber },
  { header: "Peminjam", cell: (booking) => booking.requesterName },
  { header: "Email Peminjam", cell: (booking) => booking.requesterEmail },
  { header: "Jumlah Peserta", cell: (booking) => booking.attendeeCount },
  { header: "Nama Peserta", cell: (booking) => booking.attendeeNames || "-" },
  { header: "Peralatan", cell: (booking) => booking.equipmentName },
  { header: "Keperluan", cell: (booking) => booking.purpose },
  { header: "Waktu Mulai", cell: (booking) => formatDateTimeId(booking.startTime) },
  { header: "Waktu Selesai", cell: (booking) => formatDateTimeId(booking.endTime) },
  { header: "Disetujui Oleh", cell: (booking) => booking.approvedByName || "-" },
  { header: "Catatan", cell: (booking) => booking.note || "-" },
  { header: "Dibuat", cell: (booking) => formatDateTimeId(booking.createdAt) },
];


export const BORROW_EXPORT_COLUMNS: ExportColumn<BorrowRow>[] = [
  { header: "Kode", cell: (item) => item.code },
  { header: "Status", cell: (item) => getStatusDisplayLabel(item.status) },
  { header: "Alat", cell: (item) => item.equipmentName },
  { header: "Peminjam", cell: (item) => item.requesterName },
  { header: "Jumlah", cell: (item) => item.quantity },
  { header: "Keperluan", cell: (item) => item.purpose },
  { header: "Waktu Mulai", cell: (item) => formatDateTimeId(item.startTime) },
  { header: "Waktu Selesai", cell: (item) => formatDateTimeId(item.endTime) },
  { header: "Waktu Kembali Aktual", cell: (item) => formatDateTimeId(item.endTimeActual) },
  { header: "Disetujui Oleh", cell: (item) => item.approvedByName || "-" },
  { header: "Catatan Peminjam", cell: (item) => item.note || "-" },
  { header: "Catatan Inspeksi", cell: (item) => item.inspectionNote || "-" },
  { header: "Dibuat", cell: (item) => formatDateTimeId(item.createdAt) },
];

export const SAMPLE_TESTING_EXPORT_COLUMNS: ExportColumn<SampleTestingRow>[] = [
  { header: "Kode", cell: (item) => item.code },
  { header: "Status", cell: (item) => getStatusDisplayLabel(item.status) },
  { header: "Pemohon", cell: (item) => item.name },
  { header: "Institusi", cell: (item) => item.institution },
  { header: "Email", cell: (item) => item.email },
  { header: "Nomor Telepon", cell: (item) => item.phoneNumber },
  { header: "Nama Sampel", cell: (item) => item.sampleName },
  { header: "Jenis Sampel", cell: (item) => item.sampleType },
  { header: "Merek Sampel", cell: (item) => item.sampleBrand },
  { header: "Kemasan Sampel", cell: (item) => item.samplePackaging },
  { header: "Berat Netto / Dimensi Sampel", cell: (item) => item.sampleWeight },
  { header: "Jumlah Sampel", cell: (item) => item.sampleQuantity },
  { header: "Cara Penyajian / Penanganan", cell: (item) => item.sampleTestingServing },
  { header: "Metode Pengujian", cell: (item) => item.sampleTestingMethod },
  { header: "Jenis Pengujian", cell: (item) => item.sampleTestingType },
  { header: "Disetujui Oleh", cell: (item) => item.approvedByName || "-" },
  { header: "Dibuat", cell: (item) => formatDateTimeId(item.createdAt) },
];

export const USER_EXPORT_COLUMNS: ExportColumn<UserRow>[] = [
  { header: "nama lengkap", cell: (user) => user.name },
  { header: "email", cell: (user) => user.email },
  { header: "role", cell: (user) => user.role || "-" },
  { header: "status", cell: (user) => (user.status === "active" ? "Sudah Login" : "Belum Login") },
  { header: "initials", cell: (user) => user.initials || "-" },
  { header: "department", cell: (user) => user.department || "-" },
  { header: "batch", cell: (user) => user.batch || "-" },
  { header: "id number", cell: (user) => user.idNumber || "-" },
  { header: "institution", cell: (user) => user.institution || "-" },
  { header: "User Type", cell: (user) => user.userType || "-" },
  { header: "Linked Account", cell: (user) => (user.hasUser ? "Ya" : "Belum") },
  { header: "Last Login", cell: (user) => user.lastLogin || "-" },
];

export const ROOM_EXPORT_COLUMNS: ExportColumn<RoomRow>[] = [
  { header: "nama ruangan", cell: (room) => room.name },
  { header: "nomor ruangan", cell: (room) => room.number },
  { header: "lantai", cell: (room) => room.floor },
  { header: "kapasitas", cell: (room) => room.capacity },
  { header: "deskripsi", cell: (room) => room.description || "-" },
  { header: "PIC", cell: (room) => room.picName || "-" },
];

export const EQUIPMENT_EXPORT_COLUMNS: ExportColumn<EquipmentRow>[] = [
  { header: "nama peralatan", cell: (item) => item.name },
  { header: "jumlah", cell: (item) => item.quantity },
  { header: "kategori", cell: (item) => item.category },
  { header: "status", cell: (item) => formatStatus(item.status) },
  { header: "ruangan", cell: (item) => item.roomName || "-" },
  { header: "moveable", cell: (item) => (item.isMoveable ? "ya" : "tidak") },
  { header: "shareable", cell: (item) => (item.isShareable ? "ya" : "tidak") },
  { header: "borrowable", cell: (item) => (item.isBorrowable ? "ya" : "tidak") },
  { header: "deskripsi", cell: (item) => item.description || "-" },
];

export const MATERIAL_EXPORT_COLUMNS: ExportColumn<MaterialRow>[] = [
  { header: "nama bahan", cell: (item) => item.name },
  { header: "jumlah", cell: (item) => item.quantity },
  { header: "satuan", cell: (item) => item.unit || "-" },
  { header: "kategori", cell: (item) => item.category },
  { header: "deskripsi", cell: (item) => item.description || "-" },
  { header: "status", cell: (item) => formatStatus(item.status) },
  { header: "ruangan", cell: (item) => item.roomName || "-" },
];

export const SOFTWARE_EXPORT_COLUMNS: ExportColumn<SoftwareRow>[] = [
  { header: "nama software", cell: (item) => item.name },
  { header: "versi", cell: (item) => item.version || "-" },
  { header: "lisensi", cell: (item) => item.licenseInfo || "-" },
  { header: "expired", cell: (item) => item.licenseExpiration || "-" },
  { header: "deskripsi", cell: (item) => item.description || "-" },
  { header: "peralatan", cell: (item) => item.equipmentName || "-" },
  { header: "ruangan", cell: (item) => item.roomName || "-" },
];

function formatStatus(value?: string | null) {
  if (!value || value === "-") return "-";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
