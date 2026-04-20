# Rangkuman Validasi: Booking, Borrow, dan Pengujian

Catatan: nama file dipertahankan agar tidak mengganggu referensi lokal yang sudah ada, tetapi isi dokumen ini sudah disesuaikan dengan layanan aktif saat ini.

Dokumen ini merangkum validasi yang berlaku pada layanan aktif:
- **Booking**
- **Borrow**
- **Pengujian**

Validasi terbagi dua lapisan:
- **Serializer** — dijalankan saat CREATE dan UPDATE via API
- **Review-Check** — dijalankan saat reviewer membuka endpoint `review-check` sebelum approve

---

## BOOKING

### A. Serializer (`BookingSerializer.validate`)

#### Saat CREATE (`instance is None`)
- Status hanya boleh `null` atau `"Pending"` dan tidak boleh diset langsung ke status lain
- `approved_by` tidak boleh diisi

#### Saat UPDATE (`instance` ada)
- Status hanya bisa diubah via action endpoint khusus
- `approved_by` tidak boleh diubah langsung
- Field mentor approval hanya boleh berubah lewat flow yang sesuai
- Booking yang sudah diproses (`status != Pending`) tidak bisa diubah langsung kecuali lewat action

#### Selalu (CREATE & UPDATE)
- `attendee_count` harus > 0
- Jika status `"Rejected"` maka `rejection_note` wajib diisi
- `attendee_count` tidak boleh melebihi kapasitas ruangan
- `start_time` harus < `end_time`

#### Cek Waktu & Ruangan
Berlaku jika ada `room`, `start_time`, `end_time`, dan status `Pending` atau `Approved`:

- Jika status `"Approved"` dan `end_time` sudah lewat waktu sekarang → error
- Bentrok jadwal praktikum (`Schedule`) → error
- Bentrok booking **Approved** lain di ruangan yang sama:
  - Jika tujuan `Praktikum` atau `Workshop`:
    - Ada booking approved lain pada waktu yang sama → error
  - Jika tujuan `Penelitian` atau `Skripsi/TA`:
    - Ada booking approved `Praktikum/Workshop` pada waktu yang sama → error
    - Jika sesama penelitian/skripsi, total peserta gabungan tidak boleh melebihi kapasitas ruangan

#### Cek Stok Equipment (per item dalam `equipment_items`)

- Room wajib dipilih terlebih dahulu
- Equipment tidak boleh duplikat dalam satu booking
- Equipment harus berasal dari ruangan yang sama dengan room booking
- Quantity tidak boleh melebihi total stok equipment
- Jika `is_shareable = False` → cek alokasi overlap:
  - Alokasi = Booking(`Approved`) + Borrow(`Approved/Borrowed/Overdue/Lost/Damaged`) pada rentang waktu yang sama
  - Jika `quantity` > sisa stok → error
- Jika `is_shareable = True` → cek stok overlap dilewati

### B. Review-Check (`_booking_review_result`)

#### Kelengkapan Field
- `requester_phone` kosong → issue
- Tujuan `"Skripsi/TA"` dan `requester_mentor` kosong → issue
- `attendee_count > 1` dan `attendee_names` kosong → issue
- Tujuan `"Workshop"`:
  - `workshop_title` kosong → issue
  - `workshop_pic` kosong → issue
  - `workshop_institution` kosong → issue

#### Cek Jadwal & Ruangan

- Bentrok `Schedule` → issue
- Bentrok booking **Approved** lain di ruangan yang sama:
  - `Praktikum/Workshop` tidak boleh overlap
  - `Penelitian/Skripsi/TA` tidak boleh overlap dengan `Praktikum/Workshop`
  - Jika sesama penelitian/skripsi, total peserta gabungan tidak boleh melebihi kapasitas ruangan

#### Cek Stok Equipment

- Jika `is_shareable = True` → passed indicator bahwa alat shareable tidak dibatasi stok berdasarkan waktu
- Jika `is_shareable = False` → cek sisa stok dari alokasi Booking + Borrow pada rentang waktu yang sama

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

#### Saat UPDATE (`instance` ada)
- Status hanya bisa diubah via action endpoint khusus
- `end_time_actual` hanya bisa diisi via action khusus
- `approved_by` tidak boleh diubah langsung
- `inspection_note` hanya bisa diisi via action inspeksi
- Jika status `"Rejected"` maka `rejection_note` wajib diisi

#### Cek Stok Equipment

- Quantity tidak boleh melebihi total stok equipment
- Cek overlap stok selalu berlaku, termasuk untuk alat shareable:
  - Alokasi = Booking(`Approved`) + Borrow(`Approved/Borrowed/Overdue/Lost/Damaged`)
  - Saat update, record sendiri dikecualikan dari perhitungan
  - Jika `quantity` > sisa stok → error

### B. Review-Check (`_borrow_review_result`)

#### Kelengkapan Field
- `requester_phone` kosong → issue
- Tujuan `"Skripsi/TA"` dan `requester_mentor` kosong → issue

#### Cek Equipment & Stok
- Status equipment bukan `"Available"` → issue
- Quantity request > stok total → issue
- Cek overlap stok dari Booking + Borrow pada rentang waktu yang sama
- Tidak ada pengecualian shareable untuk borrow

---

## PENGUJIAN

### A. Serializer (`PengujianSerializer.validate`)

#### Saat CREATE (`instance is None`)
- Status hanya boleh `null` atau `"Pending"`
- `approved_by` tidak boleh diisi langsung

#### Saat UPDATE (`instance` ada)
- Status hanya bisa diubah via action endpoint khusus
- Field approval, completion, dan dokumen proses mengikuti tahapan action yang tersedia

#### Selalu (CREATE & UPDATE)
- Identitas pemohon, detail sampel, dan layanan uji harus konsisten
- Jika status `"Rejected"` maka `rejection_note` wajib diisi
- Validasi lanjutan mengikuti tahapan dokumen dan proses pembayaran

### B. Review-Check / Tahapan Approver

- Periksa kelengkapan identitas pemohon dan informasi sampel
- Pastikan layanan/metode pengujian sesuai dengan pengajuan
- Pastikan tahapan dokumen berjalan berurutan:
  - surat perjanjian
  - invoice
  - bukti bayar
  - surat hasil uji
- Pastikan status pengajuan selaras dengan dokumen yang sudah tersedia

---

## Perbandingan Ringkas

| Aspek | Booking | Borrow | Pengujian |
|---|---|---|---|
| Cek stok saat create/update | Ya | Ya | Tidak |
| `is_shareable` bypass stok overlap | Ya | Tidak | Tidak relevan |
| Status dihitung sebagai alokasi stok | `Approved` | `Approved, Borrowed, Overdue, Lost/Damaged` | Tidak |
| Cek jadwal ruangan | Ya | Tidak | Tidak |
| Cek booking overlap di ruangan | Ya | Tidak | Tidak |
| Cek kapasitas ruangan | Ya | Tidak | Tidak |
| Cek `is_borrowable` | Tidak | Ya | Tidak |
| Status default saat create | Pending | Pending | Pending |
| Ada field `end_time_actual` | Tidak | Ya | Tidak |
| Ada field `inspection_note` | Tidak | Ya | Tidak |

---

## Status Alokasi Stok

Ketika menghitung stok yang sudah terpakai pada rentang waktu tertentu, status berikut yang dihitung:

| Tipe Request | Status yang Dihitung |
|---|---|
| Booking | `Approved` |
| Borrow | `Approved`, `Borrowed`, `Overdue`, `Lost/Damaged` |

> Status `Pending` tidak dihitung sebagai alokasi stok.
