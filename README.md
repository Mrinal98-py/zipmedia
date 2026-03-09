# ZipMedia

**Compress iPhone & Android photos/videos by date — 100% in the browser.**  
Zero uploads · Zero server processing · Complete privacy.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Server | Node.js v20 + Express 4 |
| Security | Helmet (CSP, HSTS, X-Frame) |
| Compression | gzip via `compression` middleware |
| Logging | Morgan |
| Frontend | Vanilla JS (ES6), CSS variables |
| Deploy | PM2 cluster + Nginx reverse-proxy + Docker |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start dev server (auto-restart on change)
npm run dev

# 3. Open browser
open http://localhost:3000
```

---

## Supported Formats

### 📸 Photos
`JPG` `JPEG` `PNG` `HEIC` `HEIF` `WebP` `GIF` `TIFF` `BMP`  
`DNG` `ARW` `NEF` `CR2` `CR3` `ORF` `RW2` *(RAW — listed but browser can't compress these)*

### 🎬 Videos
`MP4` `MOV` `M4V` `AVI` `WebM` `MKV` `FLV` `MPEG` `MPG` `3GP` `3G2` `TS` `MTS` `M2TS` `WMV` `ASF`

---

## Compression Details

| Type | Method | Default Quality | Output |
|---|---|---|---|
| Photos | Canvas API `toBlob` | 85% | Same format as input |
| Videos | MediaRecorder (VP9/VP8) | 75% | `.webm` |
| Camera RAW | — | — | Graceful error (browser limitation) |

---

## Production Deployment

### PM2 (recommended for VPS)

```bash
npm install -g pm2

# Start in cluster mode (all CPU cores)
pm2 start ecosystem.config.js --env production

# Auto-start on server reboot
pm2 save && pm2 startup
```

### Nginx

```bash
# Copy config
sudo cp nginx.conf /etc/nginx/sites-available/zipmedia
sudo ln -s /etc/nginx/sites-available/zipmedia /etc/nginx/sites-enabled/

# Add SSL with Let's Encrypt
sudo certbot --nginx -d your-domain.com

sudo nginx -t && sudo systemctl reload nginx
```

### Docker

```bash
# Build
docker build -t zipmedia .

# Run
docker run -d -p 3000:3000 --name zipmedia zipmedia

# Health check
curl http://localhost:3000/health
```

### Docker Compose

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | `production` enables 1-year asset cache |

---

## Project Structure

```
zipmedia/
├── server.js             ← Express server
├── package.json
├── ecosystem.config.js   ← PM2 cluster config
├── nginx.conf            ← Nginx reverse-proxy
├── Dockerfile            ← Multi-stage Docker image
├── .env                  ← Environment variables (do not commit)
└── public/               ← Static frontend (served by Express)
    ├── index.html
    ├── css/styles.css
    └── js/
        ├── state.js      ← Shared state + format constants
        ├── utils.js      ← Pure helpers
        ├── filter.js     ← Date/tab filtering
        ├── compress.js   ← Canvas + MediaRecorder pipelines
        ├── render.js     ← DOM rendering & downloads
        └── app.js        ← Init & compress loop
```
