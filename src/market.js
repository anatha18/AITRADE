/* =============================================
   market.js — Real-time market data
   All fetches go through local proxy (/api/...)
   to avoid CORS issues in both dev & production.

   Dev:  Vite proxy → alphavantage.co / stooq.com
   Prod: Vercel serverless fn → same targets
   ============================================= */

/* ---- Alpha Vantage via proxy ---- */
async function avFetch(params) {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`/api/av?${qs}`)
  if (!res.ok) throw new Error(`AV proxy HTTP ${res.status}`)
  return res.json()
}

/* ---- stooq.com via proxy ---- */
// path examples: /q/l/?s=dxy&f=sd2t2ohlcvn&e=csv
//                /q/d/l/?s=dxy&i=w
async function stooqFetch(path) {
  const res = await fetch(`/api/stooq?path=${encodeURIComponent(path)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!res.ok) throw new Error(`stooq proxy HTTP ${res.status}`)
  return res.text()
}

/* ---- Parse stooq quote CSV ---- */
// Response CSV: Symbol,Date,Time,Open,High,Low,Close,Volume,Name
async function fetchStooq(symbol) {
  const path = `/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcvn&e=csv`
  const text = await stooqFetch(path)
  const lines = text.trim().split('\n')
  if (lines.length < 2) throw new Error(`No data for ${symbol}`)
  const cols  = lines[1].split(',')
  const close = parseFloat(cols[6])
  const open  = parseFloat(cols[3])
  if (isNaN(close) || close === 0) throw new Error(`Invalid data for ${symbol}: "${lines[1]}"`)
  const change    = close - open
  const changePct = open !== 0 ? (change / open) * 100 : 0
  return { price: close, change, changePct, prevClose: open }
}

/* ---- Parse stooq weekly series for sparkline ---- */
async function fetchStooqSeries(symbol) {
  const path = `/q/d/l/?s=${encodeURIComponent(symbol)}&i=w`
  const text = await stooqFetch(path)
  const lines = text.trim().split('\n').slice(1) // skip header
  return lines
    .slice(-8)
    .map(l => parseFloat(l.split(',')[4]))       // close column
    .filter(v => !isNaN(v))
}

/* ---- Fetch Gold (XAU/USD) via Alpha Vantage ---- */
async function fetchGold() {
  const data = await avFetch({
    function: 'CURRENCY_EXCHANGE_RATE',
    from_currency: 'XAU',
    to_currency: 'USD',
  })
  const rate = data['Realtime Currency Exchange Rate']
  if (!rate) throw new Error('Gold: no data dari Alpha Vantage')
  return {
    price: parseFloat(rate['5. Exchange Rate']).toFixed(2),
    bid:   parseFloat(rate['8. Bid Price']).toFixed(2),
    ask:   parseFloat(rate['9. Ask Price']).toFixed(2),
    time:  rate['6. Last Refreshed'],
  }
}

/* ---- Draw sparkline on <canvas> ---- */
export function drawSparkline(canvasId, data, color, fillColor) {
  const canvas = document.getElementById(canvasId)
  if (!canvas || !data.length) return
  const ctx = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height
  ctx.clearRect(0, 0, w, h)
  const min   = Math.min(...data)
  const max   = Math.max(...data)
  const range = max - min || 0.001
  const pts   = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * (h - 4) - 2,
  }))
  ctx.beginPath()
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
  ctx.strokeStyle = color
  ctx.lineWidth   = 1.5
  ctx.stroke()
  if (fillColor) {
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath()
    ctx.fillStyle = fillColor
    ctx.fill()
  }
}

/* ---- Format change badge ---- */
function fmtChange(change, pct) {
  const sign = change >= 0 ? '▲ +' : '▼ '
  const cls  = change >= 0 ? 'up' : 'down'
  return `<span class="${cls}">${sign}${change.toFixed(2)} (${pct.toFixed(2)}%)</span>`
}

/* ---- Gold composite signal ---- */
function updateGoldSignal(dxy, us02y, us10y, dxyChg, us02yChg, us10yChg) {
  let bullScore = 0
  if (dxyChg   < 0) bullScore++
  if (us02yChg < 0) bullScore++
  if (us10yChg < 0) bullScore++

  const fill = document.getElementById('sb-fill')
  if (fill) fill.style.width = `${(bullScore / 3) * 100}%`

  const badge   = document.getElementById('gold-badge')
  const summary = document.getElementById('sc-summary')
  if (bullScore >= 2) {
    badge.className   = 'signal-badge signal-bullish'
    badge.textContent = 'BULLISH'
    summary.textContent = 'Mayoritas indikator mendukung Gold. DXY/yield turun — kondisi favorable untuk XAU.'
  } else if (bullScore === 0) {
    badge.className   = 'signal-badge signal-bearish'
    badge.textContent = 'BEARISH'
    summary.textContent = 'DXY kuat, yield tinggi menekan Gold. Hati-hati posisi long — tunggu reversal signal.'
  } else {
    badge.className   = 'signal-badge signal-neutral'
    badge.textContent = 'MIXED'
    summary.textContent = 'Sinyal terbagi antara DXY dan yield. Tunggu konfirmasi arah sebelum entry.'
  }

  document.getElementById('cc-dxy-text').textContent = dxy > 104
    ? `DXY ${dxy.toFixed(2)} — kuat, tekanan bearish ke Gold`
    : `DXY ${dxy.toFixed(2)} — melemah, supportive untuk Gold`

  const spread = (us10y - us02y).toFixed(2)
  document.getElementById('cc-yield-text').textContent = spread < 0
    ? `Inverted (${spread}%) — sinyal resesi, potensi bullish Gold`
    : `Normal (${spread}%) — yield curve wajar`

  const conclusionEl = document.getElementById('cc-conclusion')
  const sup = 'Support ~$2,300–$2,340', res = 'Resistance ~$2,420–$2,480'
  if (bullScore >= 2)
    conclusionEl.textContent = `Bias bullish. ${sup}, bias akumulasi jika DXY tidak tembus level tinggi. ${res}.`
  else if (bullScore === 0)
    conclusionEl.textContent = `Bias bearish. Tekanan DXY + yield tinggi tekan XAU. ${sup} kritis. ${res}.`
  else
    conclusionEl.textContent = `Sinyal mixed. Pantau DXY — break di atas/bawah 104 akan konfirmasi arah. ${sup} / ${res}.`
}

/* ---- Helpers: set element text ---- */
function setText(id, val)  { const e = document.getElementById(id); if (e) e.textContent = val }
function setHtml(id, html) { const e = document.getElementById(id); if (e) e.innerHTML    = html }

let fetchCount = 0

/* ============================================================
   MAIN — fetch all market data
   ============================================================ */
export async function fetchAllMarketData() {
  const liveDot = document.getElementById('live-dot')
  if (liveDot) liveDot.classList.remove('active')

  // Show loading spinners
  for (const id of ['dxy-val', 'us02y-val', 'us10y-val', 'gold-price']) {
    const el = document.getElementById(id)
    if (el) el.innerHTML = '<span class="loading-dot">···</span>'
  }

  // --- Gold & macro in parallel ---
  const results = await Promise.allSettled([
    fetchGold(),
    fetchStooq('dxy'),
    fetchStooq('ust2y.b'),
    fetchStooq('ust10y.b'),
  ])

  const [goldResult, dxyResult, us02yResult, us10yResult] = results

  let hasAny = false

  // ---- GOLD ----
  if (goldResult.status === 'fulfilled') {
    const g = goldResult.value
    const priceStr = `$${parseFloat(g.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    setText('gold-price', priceStr)
    setText('hdr-gold-val', `$${parseFloat(g.price).toLocaleString('en-US', { minimumFractionDigits: 0 })}`)
    setHtml('gold-change', `<span class="neutral">Bid $${g.bid} / Ask $${g.ask}</span>`)
    hasAny = true
  } else {
    setText('gold-price', '$—')
    console.warn('Gold fetch failed:', goldResult.reason)
  }

  // ---- DXY ----
  if (dxyResult.status === 'fulfilled') {
    const q = dxyResult.value
    setText('dxy-val', q.price.toFixed(2))
    setHtml('dxy-chg', fmtChange(q.change, q.changePct))
    setText('hdr-dxy-val', q.price.toFixed(2))
    setText('dxy-desc', q.change < 0
      ? `DXY melemah ${Math.abs(q.changePct).toFixed(2)}% — potensi relief untuk Gold.`
      : `DXY menguat ${q.changePct.toFixed(2)}% — tekanan bearish pada XAU.`)
    hasAny = true
  } else {
    setText('dxy-val', 'N/A')
    console.warn('DXY fetch failed:', dxyResult.reason)
  }

  // ---- US02Y ----
  if (us02yResult.status === 'fulfilled') {
    const q = us02yResult.value
    setText('us02y-val', `${q.price.toFixed(2)}%`)
    setHtml('us02y-chg', fmtChange(q.change, q.changePct))
    setText('hdr-02y-val', `${q.price.toFixed(2)}%`)
    setText('us02y-desc', q.change < 0
      ? `Yield 2Y turun → ekspektasi Fed cut meningkat, bullish untuk Gold.`
      : `Yield 2Y naik → Fed hawkish, tekanan pada aset non-yield.`)
    hasAny = true
  } else {
    setText('us02y-val', 'N/A')
    console.warn('US02Y fetch failed:', us02yResult.reason)
  }

  // ---- US10Y ----
  if (us10yResult.status === 'fulfilled') {
    const q = us10yResult.value
    setText('us10y-val', `${q.price.toFixed(2)}%`)
    setHtml('us10y-chg', fmtChange(q.change, q.changePct))
    setText('hdr-10y-val', `${q.price.toFixed(2)}%`)
    setText('us10y-desc', q.change < 0
      ? `Real yield turun → biaya oportunitas hold Gold berkurang, supportive.`
      : `Real yield naik → tekanan pada Gold, pertimbangkan posisi defensif.`)
    hasAny = true
  } else {
    setText('us10y-val', 'N/A')
    console.warn('US10Y fetch failed:', us10yResult.reason)
  }

  // ---- Gold signal (only if we have the macro data) ----
  if (dxyResult.status === 'fulfilled' && us02yResult.status === 'fulfilled' && us10yResult.status === 'fulfilled') {
    updateGoldSignal(
      dxyResult.value.price,   us02yResult.value.price,   us10yResult.value.price,
      dxyResult.value.change,  us02yResult.value.change,  us10yResult.value.change,
    )
  } else {
    const errs = results
      .map((r, i) => r.status === 'rejected' ? ['Gold','DXY','US02Y','US10Y'][i] : null)
      .filter(Boolean)
    setText('sc-summary', `⚠️ Gagal: ${errs.join(', ')}. Cek console untuk detail.`)
  }

  // ---- Stats ----
  if (hasAny) {
    fetchCount++
    setText('stat-fetch', fetchCount)
    setText('last-update', new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false }))
    if (liveDot) liveDot.classList.add('active')
  }

  // ---- Sparklines (non-blocking, best-effort) ----
  fetchSparklines()
}

/* ---- Sparklines ---- */
async function fetchSparklines() {
  try {
    const [d, u2, u10] = await Promise.all([
      fetchStooqSeries('dxy'),
      fetchStooqSeries('ust2y.b'),
      fetchStooqSeries('ust10y.b'),
    ])
    drawSparkline('spark-dxy',   d,   '#f87171', 'rgba(248,113,113,0.06)')
    drawSparkline('spark-us02y', u2,  '#60a5fa', 'rgba(96,165,250,0.06)')
    drawSparkline('spark-us10y', u10, '#4ade80', 'rgba(74,222,128,0.06)')
  } catch (err) {
    console.warn('Sparkline fetch failed (non-critical):', err)
  }
}

/* ---- Snapshot for AI chat context ---- */
export function getCurrentMarketSnapshot() {
  return {
    gold:   document.getElementById('gold-price')?.textContent  ?? '—',
    dxy:    document.getElementById('dxy-val')?.textContent     ?? '—',
    us02y:  document.getElementById('us02y-val')?.textContent   ?? '—',
    us10y:  document.getElementById('us10y-val')?.textContent   ?? '—',
    signal: document.getElementById('gold-badge')?.textContent  ?? '—',
  }
}
