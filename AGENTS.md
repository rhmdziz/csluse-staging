# AGENTS.md

## Ringkasan Project

Project ini adalah aplikasi internal CSL dengan arsitektur full-stack:

- `backend/`: Django 4.2 + Django REST Framework + env Python 3.12
- `frontend-react/`: React 19 + Vite + TypeScript
- `infra/`: infrastruktur deployment, saat ini berisi konfigurasi Nginx
- root repo: orchestration via `docker-compose.yml`, `docker-compose.prod.yml`, dan `Makefile`

Fungsi bisnis utama yang terlihat dari struktur route dan folder:

- autentikasi dan otorisasi pengguna
- dashboard pengguna
- booking ruangan
- peminjaman alat
- pengujian sampel
- approval/review workflow
- admin history, inventory, task management, dan user management

## Struktur Penting

### Backend

- entry point: `backend/manage.py`
- Django settings: `backend/config/settings.py`
- root URL config: `backend/config/urls.py`
- app utama domain: `backend/csluse`
- app autentikasi/admin auth: `backend/csluse_auth`

Catatan backend:

- default settings module adalah `config.settings`
- auth menggunakan `dj-rest-auth` + JWT cookie auth
- API docs tersedia via `api/schema/` dan `api/docs/`
- environment file ada di `backend/.env` dan `backend/.env.prod`

### Frontend

- package manifest: `frontend-react/package.json`
- app entry: `frontend-react/src/main.tsx`
- router utama: `frontend-react/src/routes/router.tsx`
- halaman ada di `frontend-react/src/pages`
- reusable component ada di `frontend-react/src/components`
- data fetching logic banyak ditempatkan di `frontend-react/src/hooks`
- service/API wrapper ada di `frontend-react/src/services`
- styling global ada di `frontend-react/src/styles`

Catatan frontend:

- routing memakai `react-router-dom`
- data fetching memakai `@tanstack/react-query`
- ada kombinasi komponen `antd`, `radix`, dan util UI internal
- lockfile yang tersedia adalah `frontend-react/package-lock.json`, jadi default package manager adalah `npm`

## Cara Menjalankan

### Via Docker Compose

Dari root repo:

- `make dev` untuk menjalankan stack development
- `make dev-build` untuk build ulang lalu menjalankan
- `make dev-down` untuk menghentikan
- `make dev-logs` untuk melihat logs

Default port yang terlihat dari compose:

- frontend diexpose ke `http://localhost:3000`
- backend tersedia sebagai service internal dan expose port `8000` untuk antar-container

### Frontend Lokal

Di `frontend-react/`:

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`

### Backend Lokal

Backend memakai Python + Django dengan dependency di `backend/requirements.txt`.

Baseline command yang relevan:

- `python manage.py runserver`
- `python manage.py migrate`
- `python manage.py createsuperuser`

Jalankan dari direktori `backend/` dengan virtualenv yang sesuai.

## Domain dan Routing

Dari router frontend, domain besar aplikasi meliputi:

- `dashboard`
- `schedule`
- `booking-rooms`
- `borrow-equipment`
- `sample-testing`
- `approval`
- area admin untuk inventory, history, user management, dan task management

Saat menambah fitur, usahakan mengikuti pembagian domain yang sudah ada:

- page di `src/pages/...`
- UI/domain component di `src/components/...`
- server state hook di `src/hooks/...`
- integrasi API di `src/services/...`

## Working Notes Untuk Agent

- Repo ini sedang aktif dikembangkan dan worktree bisa dalam keadaan dirty. Jangan revert perubahan yang tidak Anda buat.
- Prioritaskan perubahan kecil yang konsisten dengan pola folder yang sudah ada.
- Untuk frontend, cek route, page, hook, dan service terkait sebelum menambah file baru.
- Untuk backend, cek `config/urls.py`, view/viewset, serializer, dan model yang terkait sebelum mengubah kontrak API.
- Jika mengubah flow approval, history, atau task management, validasi efeknya ke role/guard di router frontend.

## Konvensi Frontend

- `src/pages` hanya untuk route page atau route entry component. Jangan simpan `Content`, `Dialog`, `Table`, `Section`, atau `Shell` di folder ini.
- `src/components` untuk reusable UI, content component, dialog, table, section, shell, dan layout helper.
- Untuk domain dashboard dan admin, usahakan struktur folder mengikuti domain route. Contoh: `pages/dashboard/sample-testing/...` berpasangan dengan `components/dashboard/sample-testing/...`.
- Nama file React di `pages` dan `components` gunakan `PascalCase`.
- Nama file hooks gunakan pola yang sudah ada, yaitu `kebab-case` dengan prefix `use-`, misalnya `use-room-options.ts`.
- Nama file utilitas non-React di `lib`, `constants`, dan `services` boleh tetap `kebab-case` atau lowercase sesuai pola folder yang sudah berjalan.
- Hindari membuat folder khusus seperti `approval/` jika route tersebut masih bagian dari domain utama. Lebih baik simpan page approval di folder domain yang sama, misalnya `sample-testing/SampleTestingAllListPage.tsx`.
- Jika sebuah route punya dua scope seperti requester dan approval, usahakan pattern page-nya konsisten:
  - `ListPage`
  - `AllListPage`
  - `FormPage`
  - `DetailPage`
- Saat rename file atau pindah folder, pastikan import path di `router.tsx`, page terkait, dan komponen domain ikut diperbarui lalu verifikasi minimal dengan `npm run build`.

### Konvensi Barrel Export

- Frontend sudah memakai barrel export untuk banyak folder di `src/components`, `src/hooks`, `src/lib`, dan `src/services`.
- Jika sebuah folder sudah punya `index.ts`, utamakan import dari folder itu, bukan langsung ke file internalnya.
- Contoh yang diutamakan:
  - `@/components/ui`
  - `@/components/shared`
  - `@/components/admin/history`
  - `@/components/admin/history/content`
  - `@/components/dashboard/layout`
  - `@/hooks/...`
  - `@/lib/...`
  - `@/services/...`
- Untuk folder `content`, `layout`, `shared`, `inventory`, `history`, `schedules`, `user-management`, dan folder domain lain yang sudah punya barrel, pertahankan pola import per-folder tersebut.
- Saat menambah file baru di folder yang sudah memakai barrel, update `index.ts` folder terkait bila file itu memang bagian dari public surface folder tersebut.
- Jangan pakai barrel root yang terlalu lebar jika berisiko membuat nama komponen terlalu generik atau mudah bentrok. Prioritaskan barrel per domain/folder.
- Jika sebuah helper atau util hanya dipakai internal di folder yang sama dan belum menjadi surface publik, tidak wajib dimasukkan ke barrel.

### Konvensi Router Shim

- Frontend tetap memakai `react-router-dom` sebagai router runtime, tetapi layer feature memakai shim `next/*` yang dipetakan ke `src/shims`.
- Untuk page, component, dan hook frontend, utamakan:
  - `next/navigation`
  - `next/link`
  - `next/image`
- Import langsung dari `react-router-dom` dibatasi untuk file infrastruktur router, yaitu:
  - `src/main.tsx`
  - `src/routes/**`
  - `src/shims/**`
  - layout yang memang membutuhkan `Outlet`
- Jika menambah navigasi baru di layer feature, jangan import `useNavigate`, `useLocation`, atau `Link` langsung dari `react-router-dom`. Gunakan shim yang sudah tersedia agar konsisten dengan codebase saat ini.
- Jika butuh API router yang belum tersedia di shim, update file di `src/shims` terlebih dahulu daripada mencampur dua pola import di feature layer.

## Konvensi Backend

- Untuk file backend yang masih monolitik seperti `models.py`, `serializers.py`, `viewsets.py`, dan `settings.py`, utamakan penataan in-place sebelum memecah file.
- Jika satu file memuat banyak domain, kelompokkan isi file dengan comment section atau region yang jelas per concern, misalnya:
  - `Inventory`
  - `Booking`
  - `Borrow`
  - `Sample Testing`
  - `Notification`
  - `Content`
- Di `models.py`, `serializers.py`, dan file utilitas backend lain, helper function di luar class sebaiknya diletakkan di bagian bawah file, kecuali benar-benar dibutuhkan di bagian atas untuk keterbacaan.
- Di `serializers.py` dan `viewsets.py`, pertahankan urutan yang mudah discan:
  - serializer atau helper pendukung
  - serializer atau viewset utama
  - serializer list/detail/export bila ada
- Hindari wildcard import di backend kecuali file memang sengaja dibuat sangat sederhana, seperti admin register minimal.
- Untuk `admin.py`, default ke register sederhana. Tambahkan `ModelAdmin` hanya jika memang ada kebutuhan nyata seperti `list_filter`, `search_fields`, atau tampilan admin yang sering dipakai.
- Untuk `settings.py`, utamakan perapihan non-behavioral:
  - pengelompokan section
  - urutan config
  - pengurangan comment bawaan yang tidak perlu
  - jangan ubah nama env atau behavior deployment tanpa kebutuhan yang jelas
- Setelah merapikan backend, verifikasi minimal dengan:
  - `python -m py_compile <file>`
  - `python manage.py check`

## Checklist Context Dasar Sebelum Mulai Kerja

- pahami apakah perubahan ada di `backend`, `frontend-react`, atau keduanya
- identifikasi domain fitur: booking room, booking catalog, borrow equipment, sample testing, admin, atau auth
- cek apakah perubahan menyentuh route, hook data fetching, dan API contract
- cek file `.env` atau compose bila masalah terkait auth, cookie, origin, atau deployment

Dokumen ini adalah baseline context. Tambahkan bagian yang lebih spesifik saat pola testing, convention coding, atau workflow deployment project ini sudah lebih terdokumentasi.
