# TradeAI — Market Intelligence Dashboard

Dashboard analisis pasar Gold (XAU/USD) dengan AI Trading Assistant berbasis DeepSeek.

## Struktur Project

```
tradeai/
├── index.html          ← Struktur HTML utama
├── src/
│   ├── style.css       ← Semua styling
│   ├── main.js         ← Entry point, wiring semua modul
│   ├── market.js       ← Logika data market & sparklines
│   └── chat.js         ← Logika AI chat (DeepSeek)
├── package.json
├── vite.config.js
├── vercel.json
└── .gitignore
```

## Cara Jalankan Lokal

```bash
# 1. Install dependencies
npm install

# 2. Jalankan dev server
npm run dev
# Buka http://localhost:5173

# 3. Build untuk production
npm run build
# Output ada di folder /dist
```

## Deploy ke GitHub + Vercel

### Step 1 — Push ke GitHub

```bash
# Inisialisasi git (jika belum)
git init
git add .
git commit -m "feat: initial TradeAI project"

# Buat repo baru di github.com lalu:
git remote add origin https://github.com/USERNAME/tradeai.git
git branch -M main
git push -u origin main
```

### Step 2 — Deploy ke Vercel

1. Buka [vercel.com](https://vercel.com) → Login dengan GitHub
2. Klik **"Add New Project"**
3. Pilih repo `tradeai` dari daftar
4. Vercel otomatis deteksi Vite — klik **"Deploy"**
5. Selesai! Dapat URL seperti `tradeai.vercel.app`

> Setiap kali `git push` ke GitHub → Vercel otomatis re-deploy.

## Cara Pakai

1. Buka website
2. Masukkan **DeepSeek API Key** (format: `sk-...`) — dapat di [platform.deepseek.com](https://platform.deepseek.com)
3. Klik "↻ Update" untuk refresh data market simulasi
4. Mulai chat dengan AI Trading Assistant

## Fitur

- Dashboard real-time: DXY, US02Y, US10Y, Gold Signal
- Sparkline chart per indikator
- AI Chat berbasis DeepSeek dengan konteks market
- AI Memory — belajar topik dari setiap sesi
- Quick Questions sidebar
- Session Stats

## Catatan

- Data market bersifat **simulasi** — untuk data real gunakan Alpha Vantage atau Twelve Data API
- API Key DeepSeek disimpan di `sessionStorage` browser, tidak dikirim ke server manapun
- Bukan saran keuangan
