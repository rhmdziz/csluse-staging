# Deploy Singkat CSLUSE

## 1. Pull repository

```bash
git clone https://github.com/rhmdziz/csluse-staging.git
cd csluse-staging
```

Jika repo sudah ada:

```bash
git pull origin main
```

## 2. Siapkan `backend/.env.prod`

Buat atau edit file `backend/.env.prod`, lalu isi konfigurasi production yang dibutuhkan.

Pastikan `frontend-react/.env` berisi:

```env
VITE_API_BASE_URL=/api/
```

## 3. Review Nginx

Pastikan `infra/nginx/nginx.conf` sudah sesuai:

- domain: `csl-use.prasetiyamulya.ac.id`
- SSL cert: `/etc/letsencrypt/live/csl-use.prasetiyamulya.ac.id/fullchain.pem`
- SSL key: `/etc/letsencrypt/live/csl-use.prasetiyamulya.ac.id/privkey.pem`

Jika sertifikat belum ada, generate di server:

```bash
sudo apt update
sudo apt install -y certbot
sudo certbot certonly --standalone -d csl-use.prasetiyamulya.ac.id
```

## 4. Jalankan production

```bash
make prod-build
```

Untuk update berikutnya:

```bash
git pull origin main
make prod-build
```
