# Panduan Validasi: Booking, Peminjaman Alat, dan Penggunaan Alat

Dokumen ini dibagi dua bagian:
- **Bagian 1 — Pemohon:** aturan yang berlaku saat mengisi dan mengirim pengajuan
- **Bagian 2 — Approver:** hal-hal yang ditampilkan di review-check sebagai bahan pertimbangan sebelum menyetujui

---

---

# BAGIAN 1 — VALIDASI PEMOHON
### *(Berlaku saat membuat atau mengedit pengajuan)*

---

## Booking Ruangan

### Aturan Umum
- Jumlah peserta harus lebih dari 0
- Waktu selesai harus lebih besar dari waktu mulai
- Jumlah peserta tidak boleh melebihi kapasitas ruangan

### Jadwal & Ruangan
Sistem akan **menolak** pengajuan jika:
- Ruangan sudah memiliki jadwal praktikum di waktu yang sama
- Tujuan pengajuan adalah **Praktikum atau Workshop**, dan ruangan sudah ada booking yang disetujui di waktu yang sama
- Tujuan pengajuan adalah **Penelitian atau Skripsi/TA**, dan sudah ada booking Praktikum/Workshop yang disetujui di waktu yang sama
- Tujuan pengajuan adalah **Penelitian atau Skripsi/TA**, ada booking Penelitian/Skripsi lain yang disetujui, dan total peserta gabungan melebihi kapasitas ruangan

### Stok Alat (jika menyertakan alat)
Untuk setiap alat yang ditambahkan:
- Alat harus berasal dari ruangan yang sama dengan ruangan yang dipesan
- Jumlah yang diminta tidak boleh melebihi total stok alat
- Jika alat **tidak shareable**: sistem mengecek apakah stok masih tersedia di rentang waktu tersebut — jika tidak mencukupi, pengajuan ditolak
- Jika alat **shareable**: tidak ada pembatasan stok berdasarkan waktu

> **Catatan stok:** Hanya alat yang sudah di-**approve** di pengajuan lain yang dihitung sebagai terpakai. Pengajuan yang masih Menunggu tidak mempengaruhi stok.

---

## Peminjaman Alat (Borrow)

### Aturan Umum
- Waktu selesai wajib diisi dan harus lebih besar dari waktu mulai
- Alat yang dipilih harus berstatus **bisa dipinjam** (is_borrowable)

### Stok Alat
- Jumlah yang diminta tidak boleh melebihi total stok alat
- Sistem selalu mengecek ketersediaan stok di rentang waktu yang diminta, **termasuk alat yang bersifat shareable** — karena alat yang dipinjam dibawa keluar ruangan dan tidak bisa dipakai bersama
- Jika stok tidak mencukupi di rentang waktu tersebut, pengajuan ditolak

> **Catatan stok:** Hanya alat yang sudah di-**approve** (termasuk yang sedang Dipinjam, Terlambat, atau Hilang/Rusak) yang dihitung sebagai terpakai. Pengajuan yang masih Menunggu tidak mempengaruhi stok.

---

## Penggunaan Alat (Use)

### Aturan Umum
- Waktu selesai harus lebih besar dari waktu mulai

### Jadwal & Ruangan
Sistem akan **menolak** pengajuan jika:
- Ruangan tempat alat berada sudah memiliki jadwal praktikum di waktu yang sama
- Ada booking Praktikum/Workshop yang disetujui di ruangan yang sama pada waktu yang sama
- Total pengguna ruangan (booking lain + penggunaan alat lain + pengajuan ini) melebihi kapasitas ruangan

### Stok Alat
- Jumlah yang diminta tidak boleh melebihi total stok alat
- Jika alat **tidak shareable**: sistem mengecek apakah stok masih tersedia di rentang waktu tersebut — jika tidak mencukupi, pengajuan ditolak
- Jika alat **shareable**: tidak ada pembatasan stok berdasarkan waktu

> **Catatan stok:** Hanya alat yang sudah di-**approve** di pengajuan lain yang dihitung sebagai terpakai. Pengajuan yang masih Menunggu tidak mempengaruhi stok.

---

---

# BAGIAN 2 — PANDUAN APPROVER
### *(Ditampilkan di review-check sebagai bahan pertimbangan sebelum menyetujui)*

---

## Booking Ruangan

### Kelengkapan Data
Pastikan pengaju sudah mengisi:
- **Nomor telepon** — wajib ada agar bisa dihubungi
- **Dosen pembimbing** — wajib jika tujuan Skripsi/TA
- **Daftar nama peserta** — wajib jika jumlah peserta lebih dari 1 orang
- Khusus **Workshop**: judul workshop, PIC workshop, dan nama institusi wajib diisi

### Jadwal & Ruangan
Review-check akan menampilkan masalah jika:
- Ruangan sudah memiliki jadwal praktikum di waktu yang sama
- Tujuan **Praktikum/Workshop**: ada booking lain yang sudah disetujui di waktu yang sama
- Tujuan **Penelitian/Skripsi/TA**: ada booking Praktikum/Workshop yang disetujui → tidak bisa berbarengan
- Tujuan **Penelitian/Skripsi/TA**: total peserta gabungan melebihi kapasitas ruangan (jika ada pengajuan sejenis lain yang sudah disetujui)

### Stok Alat
Untuk setiap alat dalam booking:
- Jika alat **shareable** → ditampilkan sebagai lolos, tidak ada pembatasan waktu
- Jika alat **tidak shareable** → sistem mengecek sisa stok berdasarkan alokasi yang sudah di-approve; jika kurang akan muncul sebagai masalah

---

## Peminjaman Alat (Borrow)

### Kelengkapan Data
Pastikan pengaju sudah mengisi:
- **Nomor telepon** — wajib ada
- **Dosen pembimbing** — wajib jika tujuan Skripsi/TA

### Kondisi & Stok Alat
Review-check akan menampilkan masalah jika:
- Status alat bukan **"Available"** — alat mungkin sedang rusak atau tidak siap dipinjam
- Jumlah yang diminta melebihi total stok alat
- Stok tidak mencukupi di rentang waktu yang diminta, dihitung dari alokasi yang sudah di-approve (termasuk yang sedang Dipinjam, Terlambat, Hilang/Rusak)

> Tidak ada pengecualian shareable untuk peminjaman — stok selalu dicek karena alat dibawa keluar ruangan.

---

## Penggunaan Alat (Use)

### Kelengkapan Data
Pastikan pengaju sudah mengisi:
- **Nomor telepon** — wajib ada
- **Dosen pembimbing** — wajib jika tujuan Skripsi/TA

### Kondisi & Stok Alat
Review-check akan menampilkan masalah jika:
- Status alat bukan **"Available"**
- Jumlah yang diminta melebihi total stok alat
- Alat **tidak shareable** dan stok tidak mencukupi di rentang waktu yang diminta
- Alat **shareable** → ditampilkan sebagai lolos, tidak ada pembatasan waktu

### Jadwal & Ruangan
Review-check akan menampilkan masalah jika:
- Ruangan sudah memiliki jadwal praktikum di waktu yang sama
- Ada booking Praktikum/Workshop yang disetujui di ruangan yang sama pada waktu yang sama
- Total pengguna ruangan melebihi kapasitas

---

---

## Ringkasan Perbandingan

### Validasi Pemohon (saat buat/edit pengajuan)

| Aturan | Booking | Peminjaman | Penggunaan |
|---|:---:|:---:|:---:|
| Waktu selesai > waktu mulai | Ya | Ya | Ya |
| Jumlah peserta > 0 | Ya | - | - |
| Tidak melebihi kapasitas ruangan | Ya | - | Ya |
| Alat harus dari ruangan yang sama | Ya | - | - |
| Alat harus berstatus bisa dipinjam | - | Ya | - |
| Cek jadwal praktikum ruangan | Ya | - | Ya |
| Cek booking eksklusif (Praktikum/Workshop) | Ya | - | Ya |
| Cek stok alat (tidak shareable) | Ya | **Ya (semua)** | Ya |
| Alat shareable bebas stok waktu | Ya | **Tidak** | Ya |

### Review-Check Approver (bahan pertimbangan)

| Hal yang Dicek | Booking | Peminjaman | Penggunaan |
|---|:---:|:---:|:---:|
| Nomor telepon diisi | Ya | Ya | Ya |
| Dosen pembimbing (Skripsi/TA) | Ya | Ya | Ya |
| Nama peserta (> 1 orang) | Ya | - | - |
| Data workshop lengkap | Ya | - | - |
| Status alat harus Available | - | Ya | Ya |
| Cek jadwal & booking eksklusif | Ya | - | Ya |
| Kapasitas ruangan | Ya | - | Ya |
| Cek stok alat (tidak shareable) | Ya | **Ya (semua)** | Ya |
| Alat shareable bebas stok waktu | Ya | **Tidak** | Ya |

---

## Catatan Penting

> **Pengajuan Menunggu tidak memblokir stok.**
> Stok baru dianggap terpakai setelah pengajuan **disetujui**. Beberapa pengajuan Menunggu bisa mengajukan alat yang sama di waktu yang sama — perhatikan urutan approval-nya agar tidak terjadi konflik.

> **Peminjaman alat selalu dicek stoknya**, meskipun alat bersifat shareable, karena alat dibawa keluar ruangan dan tidak bisa dipakai bersama di waktu yang sama.
