# README Deploy CSLUSE

Dokumen ini ditujukan untuk tim yang akan melakukan deployment aplikasi CSLUSE ke server.

## Gambaran Singkat

Stack production saat ini terdiri dari:

- `backend`: Django + Gunicorn
- `frontend`: React build static yang diserve oleh Nginx container
- `nginx`: reverse proxy publik untuk HTTPS
- database: tidak disediakan di `docker-compose.prod.yml`, diasumsikan memakai database eksternal
- storage file: AWS S3 compatible via `django-storages`

File utama yang dipakai saat deploy:

- `docker-compose.prod.yml`
- `infra/nginx/nginx.conf`
- `backend/Dockerfile.prod`
- `backend/entrypoint.prod.sh`
- `backend/.env.prod`
- `backend/.env.prod.example`
- `frontend-react/.env`

## Checklist Prasyarat Server

Pastikan hal berikut sudah tersedia sebelum deploy:

- [ ] OS server Linux aktif dan bisa diakses via SSH
- [ ] Docker terinstall
- [ ] Docker Compose plugin tersedia (`docker compose version`)
- [ ] Port `80` dan `443` terbuka di firewall / security group
- [ ] Domain sudah mengarah ke IP server
- [ ] Sertifikat SSL tersedia di host pada `/etc/letsencrypt`
- [ ] Akses ke database production sudah tersedia
- [ ] Akses ke bucket S3 sudah tersedia
- [ ] Akses SMTP email sudah tersedia
- [ ] Akses Microsoft OAuth app sudah tersedia jika login Microsoft dipakai

## Checklist File dan Environment

### 1. Backend `.env.prod`

Buat atau review file `backend/.env.prod`.
Template aman tersedia di `backend/.env.prod.example`.

Minimal variabel yang perlu ada:

```env
DATABASE_URL=
DEBUG=False
DJANGO_SECRET_KEY=

DJANGO_SITE_NAME=CSLUSE
DJANGO_SITE_DOMAIN=

ALLOWED_HOSTS=
CORS_ALLOWED_ORIGINS=
CSRF_TRUSTED_ORIGINS=
SESSION_COOKIE_DOMAIN=
CSRF_COOKIE_DOMAIN=

S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET_NAME=
S3_REGION=
S3_LOCATION=media
S3_CUSTOM_DOMAIN=

SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
SECURE_SSL_REDIRECT=True
JWT_AUTH_COOKIE_DOMAIN=

MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=
MICROSOFT_AUTHORITY=https://login.microsoftonline.com
MICROSOFT_GRAPH_URL=https://graph.microsoft.com
MICROSOFT_ALLOWED_DOMAIN=

LOGIN_REDIRECT_URL=
LOGOUT_REDIRECT_URL=
FRONTEND_URL=

EMAIL_HOST=
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=

RUN_MIGRATIONS=true
RUN_COLLECTSTATIC=true
GUNICORN_WORKERS=3
GUNICORN_TIMEOUT=60
```

Checklist backend:

- [ ] `DATABASE_URL` mengarah ke database production yang aktif
- [ ] `DJANGO_SECRET_KEY` diganti dengan secret baru, bukan secret development
- [ ] `DJANGO_SITE_DOMAIN`, `FRONTEND_URL`, `LOGIN_REDIRECT_URL`, dan `LOGOUT_REDIRECT_URL` sesuai domain production
- [ ] `ALLOWED_HOSTS` diisi comma-separated host yang diizinkan, misalnya `example.com,www.example.com`
- [ ] `CORS_ALLOWED_ORIGINS` diisi comma-separated origin lengkap dengan protocol, misalnya `https://example.com,https://www.example.com`
- [ ] `CSRF_TRUSTED_ORIGINS` diisi comma-separated origin lengkap dengan protocol
- [ ] `SESSION_COOKIE_DOMAIN` dan `CSRF_COOKIE_DOMAIN` sesuai parent domain aplikasi jika deploy via subdomain
- [ ] `JWT_AUTH_COOKIE_DOMAIN` sesuai parent domain aplikasi
- [ ] kredensial S3 valid dan bucket dapat ditulis
- [ ] kredensial SMTP valid
- [ ] kredensial Microsoft OAuth valid
- [ ] `RUN_MIGRATIONS=true` untuk deploy awal atau saat ada migration baru
- [ ] `RUN_COLLECTSTATIC=true` karena backend menjalankan `collectstatic` saat startup bila env ini aktif

### 2. Frontend `.env`

Buat atau review file `frontend-react/.env`.

Gunakan:

```env
VITE_API_BASE_URL=/api/
```

Checklist frontend:

- [ ] `VITE_API_BASE_URL` memakai `/api/` agar request frontend diarahkan lewat Nginx reverse proxy
- [ ] file `.env` sudah ada sebelum image frontend di-build

### 3. Nginx dan SSL

Checklist Nginx:

- [ ] file `infra/nginx/nginx.conf` memakai `server_name` domain yang benar
- [ ] path sertifikat SSL di `ssl_certificate` dan `ssl_certificate_key` valid di server
- [ ] upstream masih sesuai nama service Docker: `frontend` dan `backend`

## Catatan Penting Sebelum Deploy

Ada beberapa konfigurasi repo yang saat ini masih spesifik ke environment lama:

- `infra/nginx/nginx.conf` masih mengarah ke domain `csl-test.azizrahmad.com`
- host, CORS, dan CSRF trusted origins backend sekarang dibaca dari env, jadi nilai di `backend/.env.prod` wajib direview sebelum deploy

Jika deploy ke domain lain, update file berikut terlebih dahulu:

- `infra/nginx/nginx.conf`
- `backend/.env.prod`

Selain itu:

- Jangan commit secret production ke repository
- Saat ini file env di repo terlihat berisi credential nyata; sebaiknya dipindahkan ke secret manager atau minimal hanya ada di server deploy

## Langkah Deploy

### 1. Clone repo di server

```bash
git clone <repo-url>
cd csluse-staging
```

### 2. Siapkan file environment

```bash
cp frontend-react/.env.example frontend-react/.env
```

Lalu isi:

- `backend/.env.prod`
- `frontend-react/.env`

### 3. Review konfigurasi domain

Periksa dan sesuaikan:

- `infra/nginx/nginx.conf`
- `backend/.env.prod`

### 4. Build dan jalankan container production

```bash
make prod-build
```

Atau:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

### 5. Cek status container

```bash
docker compose -f docker-compose.prod.yml ps
```

### 6. Cek log jika ada masalah

```bash
make prod-logs
```

Atau per service:

```bash
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f nginx
```

## Checklist Verifikasi Setelah Deploy

- [ ] `https://<domain>` bisa diakses
- [ ] halaman frontend tampil normal
- [ ] request ke `/api/` berhasil
- [ ] login berhasil
- [ ] cookie auth terset dengan benar
- [ ] redirect login/logout mengarah ke domain yang benar
- [ ] upload file ke S3 berhasil
- [ ] email notifikasi berhasil terkirim
- [ ] container `backend`, `frontend`, dan `nginx` status-nya `Up`
- [ ] tidak ada error migration di log backend

## Command Operasional

Menjalankan production:

```bash
make prod
```

Build ulang dan jalankan production:

```bash
make prod-build
```

Stop production:

```bash
make prod-down
```

Lihat log production:

```bash
make prod-logs
```

Membuat superuser:

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

Menjalankan check Django:

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py check
```

## Troubleshooting Singkat

### Frontend bisa dibuka tapi API gagal

Cek:

- `frontend-react/.env` berisi `VITE_API_BASE_URL=/api/`
- block `location /api/` di `frontend-react/nginx.dev.conf`
- reverse proxy `/api/` di `infra/nginx/nginx.conf`
- backend container hidup dan listen di port `8000`

### Login berhasil tapi session / cookie tidak jalan

Cek:

- `JWT_AUTH_COOKIE_DOMAIN`
- `SESSION_COOKIE_SECURE=True`
- `CSRF_COOKIE_SECURE=True`
- domain pada `backend/config/settings.py` sesuai domain deploy
- akses benar-benar via HTTPS

### Static/media tidak tampil

Cek:

- kredensial S3
- `S3_BUCKET_NAME`, `S3_REGION`, `S3_LOCATION`, `S3_CUSTOM_DOMAIN`
- permission bucket

### Container backend restart terus

Cek:

- `DATABASE_URL`
- hasil migration
- kredensial env yang wajib
- log Gunicorn dan Django

## Rekomendasi Setelah Dokumen Ini

Supaya deploy lebih aman dan mudah dipindahkan ke environment lain, sebaiknya lanjutkan dengan:

- membuat template `backend/.env.prod.example` tanpa secret
- memindahkan secret dari repo ke secret manager
- memindahkan host, CORS, dan CSRF origin hardcoded menjadi berbasis env
- menambahkan healthcheck container
- menambahkan prosedur backup database dan rollback release
