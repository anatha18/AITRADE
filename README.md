# TradeAI — Market Intelligence Dashboard v2

Dashboard analisis Gold (XAU/USD) real-time dengan AI Trading Assistant berbasis DeepSeek.

## Struktur File

```
tradeai/
├── index.html          ← HTML utama (layout chat-left, market-right)
├── src/
│   ├── style.css       ← Semua CSS (compact layout)
│   ├── main.js         ← Entry point
│   ├── market.js       ← Real-time data via Alpha Vantage
│   └── chat.js         ← AI chat via DeepSeek (key dari .env)
├── .env                ← API keys (JANGAN di-commit ke GitHub!)
├── .env.example        ← Template .env untuk referensi
├── .gitignore          ← Exclude node_modules, dist, .env
├── package.json
├── vite.config.js
└── vercel.json
```

## Setup API Keys

Edit file `.env`:
```
VITE_ALPHA_VANTAGE_KEY=masukkan_key_alpha_vantage_disini
VITE_DEEPSEEK_KEY=sk-masukkan_key_deepseek_disini
```

- Alpha Vantage (gratis): https://www.alphavantage.co/support/#api-key
- DeepSeek: https://platform.deepseek.com/api_keys

## Jalankan Lokal

```bash
npm install
npm run dev
# Buka http://localhost:5173
```

## Deploy ke GitHub + Vercel

### 1. Push ke GitHub

```bash
git init
git add .
git commit -m "feat: TradeAI v2"
git remote add origin https://github.com/USERNAME/tradeai.git
git branch -M main
git push -u origin main
```

> ⚠️ File `.env` TIDAK ikut ke GitHub (sudah ada di .gitignore). Aman!

### 2. Set Environment Variables di Vercel

Ini penting — karena `.env` tidak di-push, Vercel perlu tahu key-nya:

1. Buka dashboard Vercel → pilih project TradeAI
2. Klik **Settings** → **Environment Variables**
3. Tambahkan:
   - `VITE_ALPHA_VANTAGE_KEY` → isi dengan key Alpha Vantage
   - `VITE_DEEPSEEK_KEY` → isi dengan key DeepSeek
4. Klik **Save** → **Redeploy**

### 3. Deploy

1. Buka vercel.com → Login dengan GitHub
2. Klik **Add New Project** → pilih repo `tradeai`
3. Vercel otomatis deteksi Vite — klik **Deploy**
4. Setelah itu set Environment Variables seperti di atas

## Fitur

- Layout compact: AI Chat (kiri) + Market Sidebar (kanan)
- Real-time data: XAU/USD, DXY, US02Y, US10Y via Alpha Vantage
- Sparkline chart per indikator (weekly series)
- Gold Signal otomatis (Bullish/Mixed/Bearish)
- Kesimpulan Gold dengan analisis DXY + yield curve
- AI Chat DeepSeek dengan konteks data live
- Auto-refresh setiap 5 menit
- Header mini ticker selalu tampil

## Catatan

- Alpha Vantage free tier: 25 requests/day, 5 requests/minute
- Data real-time dengan delay ~15 menit untuk free tier
- Bukan saran keuangan
