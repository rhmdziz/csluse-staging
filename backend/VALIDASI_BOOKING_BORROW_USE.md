# Rangkuman Validasi: Booking, Borrow, Use

Dokumen ini mencakup semua validasi yang berlaku pada tiga jenis request utama: **Booking**, **Borrow**, dan **Use**, beserta percabangannya.

Validasi terbagi dua lapisan:
- **Serializer** — dijalankan saat CREATE dan UPDATE via API
- **Review-Check** — dijalankan saat reviewer membuka endpoint `review-check` sebelum approve

---

## BOOKING

### A. Serializer (`BookingSerializer.validate`)

#### Saat CREATE (`instance is None`)
- Status hanya boleh `null` atau `"Pending"` — tidak boleh diset langsung
- `approved_by` tidak boleh diisi

#### Saat UPDATE (`instance` ada)
- Status hanya bisa diubah via action endpoint khusus (perlu `allow_status_transition` di context)
  - Jika `allowed_next_status` diset, status harus sesuai nilainya
- `approved_by` tidak boleh diubah langsung
- `is_approved_by_mentor` / `mentor_approved_at`:
  - Jika purpose `"Skripsi/TA"` → error (harus via action)
  - Jika bukan `"Skripsi/TA"` → field diabaikan/dihapus otomatis
- Booking yang sudah diproses (status != Pending) tidak bisa diubah langsung (kecuali via action)

#### Selalu (CREATE & UPDATE)
- `attendee_count` harus > 0
- Jika status `"Rejected"` → `rejection_note` wajib diisi
- `attendee_count` tidak boleh melebihi kapasitas ruangan
- `start_time` harus < `end_time`

#### Cek Waktu & Ruangan
Berlaku jika ada `room`, `start_time`, `end_time`, dan status `Pending` atau `Approved`:

- Jika status `"Approved"` dan `end_time` sudah lewat waktu sekarang → error
- Bentrok jadwal praktikum (Schedule) → error *(hanya saat bukan via action)*
- Bentrok booking **Approved** lain di ruangan yang sama:
  - Jika booking ini adalah `Praktikum` atau `Workshop`:
    - Ada booking Approved lain apapun di waktu yang sama → error
  - Jika booking ini adalah `Penelitian` atau `Skripsi/TA`:
    - Ada booking Approved `Praktikum/Workshop` di waktu yang sama → error
    - Tidak ada blocking → cek kapasitas gabungan:
      - Total = (attendee booking Penelitian/Skripsi Approved lain) + (jumlah Use Approved di ruangan) + `attendee_count` ini
      - Jika total > kapasitas ruangan → error

#### Cek Stok Equipment (per item dalam `equipment_items`)
Berlaku jika `equipment_items` diisi:

- Room wajib dipilih terlebih dahulu
- Equipment tidak boleh duplikat dalam satu booking
- Equipment harus berasal dari ruangan yang sama dengan room booking
- Quantity tidak boleh melebihi total stok equipment
- Jika `is_shareable = False` → cek time-overlap stok:
  - Alokasi = Booking(`Approved`) + Use(`Approved`) + Borrow(`Approved/Borrowed/Overdue/Lost/Damaged`) di rentang waktu yang sama
  - Jika `quantity` > sisa stok → error
- Jika `is_shareable = True` → cek stok overlap dilewati

---

### B. Review-Check (`_booking_review_result`)

#### Kelengkapan Field
- `requester_phone` kosong → issue
- Purpose `"Skripsi/TA"` dan `requester_mentor` kosong → issue
- `attendee_count` > 1 dan `attendee_names` kosong → issue
- Purpose `"Workshop"`:
  - `workshop_title` kosong → issue
  - `workshop_pic` kosong → issue
  - `workshop_institution` kosong → issue

#### Cek Jadwal & Ruangan
Berlaku jika ada `room`, `start_time`, `end_time`:

- Bentrok Schedule (jadwal praktikum) → issue
- Bentrok booking **Approved** di ruangan yang sama:
  - Jika tujuan `Praktikum` atau `Workshop`:
    - Ada booking Approved lain apapun → issue
  - Jika tujuan `Penelitian` atau `Skripsi/TA`:
    - Ada booking Approved `Praktikum/Workshop` → issue
    - Tidak ada blocking → cek kapasitas:
      - Total = (attendee booking Penelitian/Skripsi Approved lain) + (jumlah Use Approved di ruangan) + `attendee_count` ini
      - Jika total > kapasitas → issue
      - Jika ada sharing dan kapasitas masih cukup → passed indicator dengan info sisa slot

#### Cek Stok Equipment (per item)
- Jika `is_shareable = True` → passed indicator "shareable, tidak ada pembatasan waktu"
- Jika `is_shareable = False` → jalankan `_equipment_review_overlap_issues`:
  - Hitung alokasi dari Booking(`Approved`) + Use(`Approved`) + Borrow(`Approved/Borrowed/Overdue/Lost/Damaged`)
  - Jika sisa tidak cukup → issue per nama equipment

---

## BORROW

### A. Serializer (`BorrowSerializer.validate`)

#### Selalu (CREATE & UPDATE)
- `end_time` wajib diisi
- `end_time` harus > `start_time`

#### Saat CREATE (`instance is None`)
- `equipment.is_borrowable` harus `True`
- Status hanya boleh `null` atau `"Pending"`
- `approved_by` tidak boleh diisi
- `end_time_actual` tidak boleh diisi
- `inspection_note` tidak boleh diisi
- *(Langsung return setelah validasi create — tidak ada cek stok/waktu)*

#### Saat UPDATE (`instance` ada)
- Status hanya bisa diubah via action endpoint khusus (perlu `allow_status_transition` di context)
  - Jika `allowed_next_status` diset, status harus sesuai nilainya
- `end_time_actual` hanya bisa diisi via action khusus (perlu `allow_end_time_actual` di context)
- `approved_by` tidak boleh diubah langsung
- `is_approved_by_mentor` / `mentor_approved_at`:
  - Jika purpose `"Skripsi/TA"` → error (harus via action)
  - Jika bukan `"Skripsi/TA"` → field diabaikan/dihapus otomatis
- `inspection_note` hanya bisa diisi via action inspeksi
- Jika status `"Rejected"` → `rejection_note` wajib diisi

#### Cek Stok Equipment
Berlaku untuk CREATE dan UPDATE jika ada `equipment`, `start_time`, `end_time`:

- Quantity tidak boleh melebihi total stok equipment
- Cek time-overlap stok:
  - Alokasi = Booking(`Approved`) + Use(`Approved`) + Borrow(`Approved/Borrowed/Overdue/Lost/Damaged`) di rentang waktu yang sama, exclude diri sendiri saat update
  - Jika `quantity` > sisa stok → error
- **Tidak ada pengecualian `is_shareable`** — semua equipment borrow selalu dicek

---

### B. Review-Check (`_borrow_review_result`)

#### Kelengkapan Field
- `requester_phone` kosong → issue
- Purpose `"Skripsi/TA"` dan `requester_mentor` kosong → issue

#### Cek Equipment & Stok
- Status equipment bukan `"Available"` → issue (peringatan untuk reviewer)
- `quantity` request > stok total equipment → issue
- Cek time-overlap stok via `_equipment_review_overlap_issues`:
  - Hitung alokasi dari Booking(`Approved`) + Use(`Approved`) + Borrow(`Approved/Borrowed/Overdue/Lost/Damaged`) di rentang waktu yang sama
  - **Tidak ada pengecualian `is_shareable`** — semua equipment selalu dicek stok overlap untuk borrow
  - Jika sisa tidak cukup → issue

---

## USE

### A. Serializer (`UseSerializer.validate`)

#### Saat CREATE (`instance is None`)
- Status hanya boleh `null` atau `"Pending"`
- `approved_by` tidak boleh diisi

#### Saat UPDATE (`instance` ada)
- Status hanya bisa diubah via action endpoint khusus
  - Jika `allowed_next_status` diset, status harus sesuai nilainya
- `approved_by` tidak boleh diubah langsung
- `is_approved_by_mentor` / `mentor_approved_at`:
  - Jika purpose `"Skripsi/TA"` → error (harus via action)
  - Jika bukan `"Skripsi/TA"` → field diabaikan/dihapus otomatis
- Use yang sudah diproses (status != Pending) tidak bisa diubah langsung (kecuali via action)

#### Selalu (CREATE & UPDATE)
- Jika status `"Approved"` dan deadline (end_time atau start_time) sudah lewat → error
- Jika status `"Rejected"` → `rejection_note` wajib diisi

#### Cek Waktu & Ruangan
Berlaku jika status `Pending` atau `Approved`, ada `start_time` dan `end_time`:

- Jika ada room dan bukan via action:
  - Bentrok Schedule (jadwal praktikum) di ruangan yang sama → error
  - Ada booking Approved `Praktikum/Workshop` di ruangan yang sama → error
- Cek kapasitas ruangan:
  - Total = (attendee booking Approved di ruangan) + (jumlah Use Approved lain di ruangan) + 1
  - Jika total > kapasitas ruangan → error

#### Cek Stok Equipment
Berlaku jika ada `equipment`, `start_time`, `end_time`:

- Jika `is_shareable = True` → cek stok dilewati
- Jika `is_shareable = False`:
  - Quantity tidak boleh melebihi total stok equipment
  - Cek time-overlap stok:
    - Alokasi = Booking(`Approved`) + Use(`Approved`) + Borrow(`Approved/Borrowed/Overdue/Lost/Damaged`) di rentang waktu yang sama, exclude diri sendiri saat update
    - Jika `quantity` > sisa stok → error

---

### B. Review-Check (`_use_review_result`)

#### Kelengkapan Field
- `requester_phone` kosong → issue
- Purpose `"Skripsi/TA"` dan `requester_mentor` kosong → issue

#### Cek Equipment & Stok
- Status equipment bukan `"Available"` → issue (peringatan untuk reviewer)
- `quantity` request > stok total equipment → issue
- Jika `is_shareable = True` → passed indicator "shareable, tidak ada pembatasan waktu"
- Jika `is_shareable = False` → jalankan `_equipment_review_overlap_issues`:
  - Hitung alokasi dari Booking(`Approved`) + Use(`Approved`) + Borrow(`Approved/Borrowed/Overdue/Lost/Damaged`)
  - Jika sisa tidak cukup → issue

#### Cek Jadwal & Ruangan
- Bentrok Schedule (jadwal praktikum) di ruangan yang sama → issue
- Ada booking Approved `Praktikum/Workshop` di ruangan yang sama → issue
- Tidak ada blocking → cek kapasitas:
  - Total = (attendee booking Approved di ruangan) + (jumlah Use Approved lain) + 1
  - Jika total > kapasitas ruangan → issue
  - Jika kapasitas masih cukup → passed indicator dengan info occupancy

---

## Perbandingan Ringkas

| Aspek | Booking | Borrow | Use |
|---|---|---|---|
| Cek stok saat create/update | Ya (per equipment item) | Ya (single equipment) | Ya (single equipment) |
| `is_shareable` bypass stok overlap | Ya | **Tidak** | Ya |
| Status dihitung sebagai alokasi stok | `Approved` | `Approved, Borrowed, Overdue, Lost/Damaged` | `Approved` |
| Cek jadwal ruangan (Schedule) | Ya | Tidak | Ya |
| Cek booking overlap di ruangan | Ya | Tidak | Ya |
| Cek kapasitas ruangan | Ya | Tidak | Ya |
| Cek `is_borrowable` | Tidak | Ya (saat create) | Tidak |
| Status default saat create | Pending | Pending | Pending |
| Ada field `end_time_actual` | Tidak | Ya | Tidak |
| Ada field `inspection_note` | Tidak | Ya | Tidak |

---

## Status Alokasi Stok (Time-Overlap Check)

Ketika menghitung stok yang sudah terpakai pada rentang waktu tertentu, status berikut yang dihitung:

| Tipe Request | Status yang Dihitung |
|---|---|
| Booking | `Approved` |
| Use | `Approved` |
| Borrow | `Approved`, `Borrowed`, `Overdue`, `Lost/Damaged` |

> **Catatan penting:** Status `Pending` **tidak** dihitung sebagai alokasi stok. Request yang masih menunggu tidak memblokir request lain.
