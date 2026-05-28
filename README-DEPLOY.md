# README Deploy CSLUSE

Dokumen ini ditujukan untuk tim yang akan melakukan deployment aplikasi CSLUSE ke server production.

## Gambaran Singkat

Stack production saat ini:

- `backend`: Django 4.2 + Gunicorn
- `frontend`: React + Vite yang dibuild menjadi static assets
- `nginx`: reverse proxy publik untuk frontend, API, dan terminasi HTTPS
- database: database eksternal, tidak disediakan oleh `docker-compose.prod.yml`
- file storage: AWS S3 via `django-storages`

File utama yang dipakai saat deploy:

- `docker-compose.prod.yml`
- `infra/nginx/nginx.conf`
- `backend/Dockerfile.prod`
- `backend/entrypoint.prod.sh`
- `backend/.env.prod`
- `backend/.env.prod.example`
- `frontend-react/.env`

## Arsitektur Production

Service yang dijalankan oleh [docker-compose.prod.yml](/Users/selunaa/Projects/csluse-staging/docker-compose.prod.yml:1):

- `backend`
  Menjalankan Django melalui Gunicorn di port internal `8000`.
- `frontend`
  Menyajikan hasil build frontend di port internal `80`.
- `nginx`
  Mengekspos port `80` dan `443`, lalu meneruskan request ke `frontend` dan `backend`.

Alur request:

1. user mengakses domain publik
2. Nginx menerima request HTTPS
3. request ke `/` diteruskan ke frontend
4. request ke `/api/` diteruskan ke backend

## Prasyarat Server

Pastikan hal berikut tersedia sebelum deploy:

- [ ] Server Linux dapat diakses via SSH
- [ ] Docker terinstall
- [ ] Docker Compose plugin tersedia
- [ ] Port `80` dan `443` terbuka
- [ ] Domain sudah mengarah ke IP server
- [ ] Sertifikat SSL sudah tersedia di host pada `/etc/letsencrypt`
- [ ] Database production dapat diakses dari server
- [ ] Bucket S3 dan credential-nya valid
- [ ] SMTP dan credential email valid
- [ ] Microsoft OAuth app tersedia jika login Microsoft dipakai

## Konfigurasi Environment

### Backend `.env.prod`

Buat atau review file `backend/.env.prod`.
Template awal ada di `backend/.env.prod.example`, tetapi perhatikan bahwa template itu masih perlu disesuaikan dengan perilaku `settings.py` saat ini.

Urutan pembacaan database di [backend/config/settings.py](/Users/selunaa/Projects/csluse-staging/backend/config/settings.py:285):

- utama: `DB_ENGINE`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`
- fallback: `DATABASE_URL` atau `DATABASE_URL_STG` jika `DB_NAME` kosong

Untuk production, gunakan format env yang dipecah sebagai default:

```env
DB_ENGINE=django.db.backends.postgresql
DB_NAME=
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=5432

DATABASE_URL=
DATABASE_URL_STG=

DEBUG=False
DJANGO_SECRET_KEY=

DJANGO_SITE_NAME=CSLUSE
DJANGO_SITE_DOMAIN=

ALLOWED_HOSTS=
CORS_ALLOWED_ORIGINS=
CSRF_TRUSTED_ORIGINS=
SESSION_COOKIE_DOMAIN=
CSRF_COOKIE_DOMAIN=
JWT_AUTH_COOKIE_DOMAIN=

S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET_NAME=
S3_REGION=
S3_LOCATION=media
S3_CUSTOM_DOMAIN=

SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
SECURE_SSL_REDIRECT=True

MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=
MICROSOFT_AUTHORITY=https://login.microsoftonline.com
MICROSOFT_GRAPH_URL=https://graph.microsoft.com
MICROSOFT_ALLOWED_DOMAIN=prasetiyamulya.ac.id

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

- [ ] `DB_HOST` mengarah ke host yang benar-benar bisa diakses dari server deploy
- [ ] jika memakai private IP seperti `172.31.x.x`, server deploy harus berada di network yang sama atau punya route ke sana
- [ ] `DB_NAME`, `DB_USER`, `DB_PASSWORD`, dan `DB_PORT` valid
- [ ] `DATABASE_URL` dan `DATABASE_URL_STG` dikosongkan jika tidak ingin fallback dipakai
- [ ] `DJANGO_SECRET_KEY` diganti dari nilai development
- [ ] `DJANGO_SITE_DOMAIN`, `FRONTEND_URL`, `LOGIN_REDIRECT_URL`, dan `LOGOUT_REDIRECT_URL` sesuai domain production
- [ ] `ALLOWED_HOSTS` berisi host yang diizinkan, comma-separated
- [ ] `CORS_ALLOWED_ORIGINS` berisi origin lengkap dengan protocol, comma-separated
- [ ] `CSRF_TRUSTED_ORIGINS` berisi origin lengkap dengan protocol, comma-separated
- [ ] `SESSION_COOKIE_DOMAIN`, `CSRF_COOKIE_DOMAIN`, dan `JWT_AUTH_COOKIE_DOMAIN` sesuai domain deploy
- [ ] credential S3 valid
- [ ] credential SMTP valid
- [ ] credential Microsoft OAuth valid

Catatan runtime backend dari [backend/entrypoint.prod.sh](/Users/selunaa/Projects/csluse-staging/backend/entrypoint.prod.sh:1):

- `RUN_MIGRATIONS=true` akan menjalankan `python manage.py migrate --noinput`
- `RUN_COLLECTSTATIC=true` akan menjalankan `python manage.py collectstatic --noinput`
- Gunicorn memakai `GUNICORN_WORKERS` dan `GUNICORN_TIMEOUT`

### Frontend `.env`

Buat atau review file `frontend-react/.env`.

Gunakan:

```env
VITE_API_BASE_URL=/api/
```

Checklist frontend:

- [ ] `VITE_API_BASE_URL` memakai `/api/`
- [ ] file `.env` sudah ada sebelum image frontend dibuild
- [ ] `frontend-react/.env.example` dan `frontend-react/.env` sebaiknya tetap konsisten memakai `/api/`

## Konfigurasi Nginx dan SSL

File aktif: [infra/nginx/nginx.conf](/Users/selunaa/Projects/csluse-staging/infra/nginx/nginx.conf:1)

Hal yang wajib direview:

- [ ] `server_name` masih default ke `csl-test.azizrahmad.com` dan harus diganti
- [ ] path `ssl_certificate` dan `ssl_certificate_key` harus sesuai domain target
- [ ] upstream tetap mengarah ke service Docker `frontend:80` dan `backend:8000`

Nginx saat ini meneruskan:

- `/` ke frontend
- `/api/` ke backend

### Setup SSL di Server

Pastikan sebelum generate sertifikat:

- [ ] DNS `csl-use.prasetiyamulya.ac.id` sudah mengarah ke IP server
- [ ] port `80` dan `443` terbuka
- [ ] tidak ada service lain yang sedang memakai port `80` saat `certbot --standalone` dijalankan

Install Certbot di host:

```bash
sudo apt update
sudo apt install -y certbot
```

Generate sertifikat:

```bash
sudo certbot certonly --standalone -d csl-use.prasetiyamulya.ac.id
```

Verifikasi file sertifikat:

```bash
sudo ls /etc/letsencrypt/live/csl-use.prasetiyamulya.ac.id/
```

Pastikan minimal ada:

- `fullchain.pem`
- `privkey.pem`

Aktifkan auto-renew jika belum aktif:

```bash
sudo systemctl enable --now certbot.timer
sudo systemctl status certbot.timer
```

Tes renewal:

```bash
sudo certbot renew --dry-run
```

## Langkah Deploy

### 1. Clone repo di server

```bash
git clone <repo-url>
cd csluse-staging
```

### 2. Siapkan file environment

```bash
cp frontend-react/.env.example frontend-react/.env
cp backend/.env.prod.example backend/.env.prod
```

Lalu review dan isi:

- `backend/.env.prod`
- `frontend-react/.env`

Jika `frontend-react/.env.example` belum ada di server/repo, buat `frontend-react/.env` secara manual dengan isi minimal:

```env
VITE_API_BASE_URL=/api/
```

### 3. Review domain dan SSL

Perbarui:

- `infra/nginx/nginx.conf`
- `backend/.env.prod`

Pastikan nilai domain konsisten di seluruh tempat:

- `server_name`
- `ssl_certificate`
- `ssl_certificate_key`
- `DJANGO_SITE_DOMAIN`
- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `LOGIN_REDIRECT_URL`
- `LOGOUT_REDIRECT_URL`
- `FRONTEND_URL`

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

## Verifikasi Setelah Deploy

- [ ] `https://<domain>` dapat diakses
- [ ] frontend tampil normal
- [ ] request ke `/api/` berhasil
- [ ] login berhasil
- [ ] cookie auth terset sesuai domain yang benar
- [ ] redirect login/logout mengarah ke domain yang benar
- [ ] upload file ke S3 berhasil
- [ ] email notifikasi berhasil terkirim
- [ ] container `backend`, `frontend`, dan `nginx` berstatus `Up`
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

Menjalankan Django check:

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py check
```

Menjalankan migrate manual:

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
```

## Catatan Penting

- `backend/.env.prod.example` saat ini masih memakai `DATABASE_URL` sebagai contoh utama. Itu tidak sepenuhnya sinkron dengan `settings.py` terbaru yang memprioritaskan `DB_*`.
- Sertifikat SSL harus dibuat di host sebelum container Nginx production dijalankan.
- `infra/nginx/nginx.conf` masih berisi domain dan path sertifikat environment lama.
- Jangan commit credential production ke repository.
- File `.env` yang berisi secret sebaiknya hanya ada di server deploy atau secret manager.
- Jika backend gagal konek ke database dengan error timeout ke host private, masalahnya biasanya ada di network path, firewall, security group, VPC, atau host DB yang tidak menerima koneksi dari server deploy.
