# AGENTS.md

## Ringkasan Project

Project ini adalah aplikasi internal CSL dengan arsitektur full-stack:

- `backend/`: Django 4.2 + Django REST Framework + Python 3.12
- `frontend-react/`: React 19 + Vite + TypeScript
- `infra/`: konfigurasi deployment, saat ini berisi Nginx
- root repo: orchestration via `docker-compose.yml`, `docker-compose.prod.yml`, dan `Makefile`

Fungsi bisnis utama yang terlihat dari struktur route dan folder:

- autentikasi dan otorisasi pengguna
- dashboard pengguna
- booking ruangan
- peminjaman alat
- pengujian sampel
- approval dan review workflow
- admin history, inventory, task management, dan user management

## Struktur Penting

### Backend

- entry point: `backend/manage.py`
- Django settings: `backend/config/settings.py`
- root URL config: `backend/config/urls.py`
- app domain utama: `backend/csluse`
- app auth: `backend/csluse_auth`

Catatan backend:

- default settings module adalah `config.settings`
- auth memakai `dj-rest-auth` + JWT cookie auth
- endpoint schema dan docs tersedia di `api/schema/` dan `api/docs/`
- environment file utama ada di `backend/.env` dan `backend/.env.prod`

### Frontend

- package manifest: `frontend-react/package.json`
- app entry: `frontend-react/src/main.tsx`
- router utama: `frontend-react/src/routes/router.tsx`
- pages: `frontend-react/src/pages`
- reusable components: `frontend-react/src/components`
- hooks: `frontend-react/src/hooks`
- API wrapper dan service: `frontend-react/src/services`
- styles global: `frontend-react/src/styles`
- router shim: `frontend-react/src/shims`

Catatan frontend:

- runtime router memakai `react-router-dom`
- feature layer mengikuti shim `next/*` yang dipetakan ke `src/shims`
- data fetching memakai `@tanstack/react-query`
- UI memadukan `antd`, `radix`, dan util internal
- lockfile yang tersedia adalah `frontend-react/package-lock.json`, jadi package manager default adalah `npm`

## Cara Menjalankan

### Via Docker Compose

Dari root repo:

- `make dev` untuk menjalankan stack development
- `make dev-build` untuk build ulang lalu menjalankan
- `make dev-down` untuk menghentikan stack development
- `make dev-logs` untuk melihat logs development
- `make prod` untuk menjalankan stack production
- `make prod-build` untuk build ulang lalu menjalankan stack production
- `make prod-down` untuk menghentikan stack production
- `make prod-logs` untuk melihat logs production

Port dan service yang terlihat dari compose:

- development frontend diexpose ke `http://localhost:3000`
- development backend tersedia sebagai service internal dan expose `8000`
- database development memakai PostgreSQL 13 di `localhost:5432`
- production memakai service `nginx` yang expose `80` dan `443`

### Frontend Lokal

Jalankan dari `frontend-react/`:

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run lint:barrels`

### Backend Lokal

Backend memakai dependency di `backend/requirements.txt`. Jalankan dari `backend/` dengan virtualenv yang sesuai.

Command baseline:

- `python manage.py runserver`
- `python manage.py migrate`
- `python manage.py createsuperuser`
- `python manage.py check`

## Domain dan Routing

Dari router frontend, domain besar aplikasi meliputi:

- `dashboard`
- `schedule`
- `booking-rooms`
- `borrow-equipment`
- `sample-testing`
- `approval`
- area admin untuk inventory, history, task management, dan user management

Saat menambah fitur, pertahankan pembagian concern:

- route page di `src/pages/...`
- UI/domain component di `src/components/...`
- server state hook di `src/hooks/...`
- integrasi API di `src/services/...`

## Working Notes Untuk Agent

- Repo ini aktif dikembangkan dan worktree bisa dalam keadaan dirty. Jangan revert perubahan yang tidak Anda buat.
- Prioritaskan perubahan kecil yang konsisten dengan pola folder dan naming yang sudah ada.
- Sebelum menambah file baru, cek dulu apakah domain terkait sudah punya page, component, hook, service, atau barrel yang bisa diperluas.
- Untuk frontend, cek route, guard, page, hook, dan service terkait sebelum mengubah flow.
- Untuk backend, cek `config/urls.py`, `urls.py` app, view/viewset, serializer, model, dan permission sebelum mengubah kontrak API.
- Jika mengubah approval, history, task management, atau auth, validasi efeknya ke role, guard, dan alur navigasi frontend.
- Jika masalah terkait auth, cookie, CORS, origin, atau deployment, cek juga `.env`, settings, dan compose.

## Konvensi Frontend

- `src/pages` hanya untuk route page atau route entry component. Jangan simpan `Content`, `Dialog`, `Table`, `Section`, atau `Shell` di folder ini.
- `src/components` untuk reusable UI, content component, dialog, table, section, shell, dan layout helper.
- Untuk domain dashboard dan admin, usahakan struktur folder mengikuti domain route. Contoh: `pages/dashboard/sample-testing/...` berpasangan dengan `components/dashboard/sample-testing/...`.
- Nama file React di `pages` dan `components` gunakan `PascalCase`.
- Nama file hooks gunakan `kebab-case` dengan prefix `use-`, misalnya `use-room-options.ts`.
- Nama file utilitas non-React di `lib`, `constants`, dan `services` boleh tetap `kebab-case` atau lowercase sesuai pola folder yang sudah berjalan.
- Hindari membuat folder terpisah seperti `approval/` jika route tersebut masih bagian dari domain utama. Simpan page approval di folder domain yang sama bila masuk akal.
- Jika sebuah route punya dua scope seperti requester dan approval, usahakan pattern page-nya konsisten:
  - `ListPage`
  - `AllListPage`
  - `FormPage`
  - `DetailPage`
- Saat rename file atau pindah folder, pastikan import path di router, page terkait, dan komponen domain ikut diperbarui.

### Konvensi Barrel Export

- Banyak folder frontend sudah memakai `index.ts` sebagai barrel export.
- Jika sebuah folder sudah punya barrel, utamakan import dari barrel itu, bukan langsung ke file internal.
- Saat menambah file baru di folder yang sudah punya barrel, update `index.ts` jika file tersebut memang bagian dari public surface folder itu.
- Jangan membuat barrel root yang terlalu lebar jika berisiko menimbulkan nama generik atau bentrok.
- Jika sebuah helper hanya dipakai internal di folder yang sama, tidak wajib dimasukkan ke barrel.
- Setelah perubahan import atau struktur folder, verifikasi minimal dengan `npm run build` dan bila relevan `npm run lint:barrels`.

### Konvensi Router Shim

- Frontend tetap memakai `react-router-dom` sebagai router runtime, tetapi feature layer harus mengutamakan shim `next/*`.
- Untuk page, component, dan hook frontend, utamakan:
  - `next/navigation`
  - `next/link`
  - `next/image`
- Import langsung dari `react-router-dom` dibatasi untuk file infrastruktur router:
  - `src/main.tsx`
  - `src/routes/**`
  - `src/shims/**`
  - layout yang memang membutuhkan `Outlet`
- Jika menambah navigasi baru di feature layer, jangan import `useNavigate`, `useLocation`, atau `Link` langsung dari `react-router-dom`.
- Jika butuh API router yang belum tersedia di shim, tambahkan di `src/shims` terlebih dahulu daripada mencampur dua pola import.

## Konvensi Backend

- Untuk file backend yang masih monolitik seperti `models.py`, `serializers.py`, `viewsets.py`, dan `settings.py`, utamakan penataan in-place sebelum memecah file.
- Jika satu file memuat banyak domain, kelompokkan isi file dengan comment section yang jelas per concern.
- Di `models.py`, `serializers.py`, dan file utilitas backend lain, helper function di luar class sebaiknya diletakkan di bagian bawah file kecuali memang dibutuhkan di bagian atas untuk keterbacaan.
- Di `serializers.py` dan `viewsets.py`, pertahankan urutan yang mudah discan:
  - helper atau serializer pendukung
  - serializer atau viewset utama
  - serializer list, detail, atau export bila ada
- Hindari wildcard import di backend kecuali file memang sengaja dibuat sangat sederhana.
- Untuk `admin.py`, default ke register sederhana. Tambahkan `ModelAdmin` hanya jika memang ada kebutuhan nyata seperti `list_filter`, `search_fields`, atau tampilan admin yang sering dipakai.
- Untuk `settings.py`, utamakan perapihan non-behavioral:
  - pengelompokan section
  - urutan config
  - pengurangan comment bawaan yang tidak perlu
  - jangan ubah nama env atau behavior deployment tanpa kebutuhan yang jelas
- Jika mengubah auth backend, perhatikan implementasi JWT cookie, refresh flow, dan integrasi `dj-rest-auth`.

## Baseline Verifikasi

Pilih verifikasi minimal yang relevan dengan scope perubahan:

- frontend:
  - `npm run build`
  - `npm run lint`
  - `npm run lint:barrels`
- backend:
  - `python -m py_compile <file>`
  - `python manage.py check`
  - `python manage.py test <app_or_test_path>` bila perubahan menyentuh behavior penting
- infra atau compose:
  - validasi file compose yang diubah
  - pastikan service, port, env file, dan dependency antar-container tetap konsisten

## Checklist Context Dasar Sebelum Mulai Kerja

- pahami apakah perubahan ada di `backend`, `frontend-react`, `infra`, atau root orchestration
- identifikasi domain fitur: booking room, borrow equipment, sample testing, admin, auth, atau dashboard
- cek apakah perubahan menyentuh route, guard, hook data fetching, dan kontrak API
- cek apakah folder target sudah memakai barrel export
- cek apakah perubahan memengaruhi auth, cookie, role, permission, atau deployment

Dokumen ini adalah baseline context. Tambahkan instruksi yang lebih spesifik saat pola testing, deployment, atau coding convention project ini makin terdokumentasi.
