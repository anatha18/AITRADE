/* =============================================
   market.js — Real-time market data
   
   Gold (XAU/USD SPOT): gold-api.com
   → Gratis, no API key, CORS enabled, spot price
   → Sama seperti yang dipakai Oanda/Forex.com
   
   DXY, US02Y, US10Y: Yahoo Finance via proxy
   ============================================= */

/* ---- Gold Spot via gold-api.com (langsung, no proxy) ---- */
async function fetchGoldSpot() {
  const res  = await fetch('https://api.gold-api.com/price/XAU')
  if (!res.ok) throw new Error(`gold-api HTTP ${res.status}`)
  const data = await res.json()
  // Response: { price, prev_close_price, ch, chp, ask, bid, ... }
  if (!data.price) throw new Error('gold-api: no price data')
  const price     = data.price
  const prevClose = data.prev_close_price ?? price
  const change    = data.ch  ?? (price - prevClose)
  const changePct = data.chp ?? (prevClose !== 0 ? (change / prevClose) * 100 : 0)
  const bid       = data.bid ?? price
  const ask       = data.ask ?? price
  return { price, change, changePct, prevClose, bid, ask }
}

/* ---- Yahoo Finance via proxy (DXY, yields) ---- */
async function fetchYahoo(symbol) {
  const res  = await fetch(`/api/stooq?path=/yahoo/${encodeURIComponent(symbol)}`)
  if (!res.ok) throw new Error(`Yahoo proxy HTTP ${res.status}`)
  const json = await res.json()
  const meta = json?.chart?.result?.[0]?.meta
  if (!meta || !meta.regularMarketPrice) throw new Error(`Yahoo: no data untuk ${symbol}`)
  const price     = meta.regularMarketPrice
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price
  const change    = price - prevClose
  const changePct = prevClose !== 0 ? (change / prevClose) * 100 : 0
  return { price, change, changePct, prevClose }
}

/* ---- Draw sparkline ---- */
export function drawSparkline(canvasId, data, color, fillColor) {
  const canvas = document.getElementById(canvasId)
  if (!canvas || !data.length) return
  const ctx = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height
  ctx.clearRect(0, 0, w, h)
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 0.001
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * (h - 4) - 2,
  }))
  ctx.beginPath()
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke()
  if (fillColor) {
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath()
    ctx.fillStyle = fillColor; ctx.fill()
  }
}

function fmtChange(change, pct) {
  const sign = change >= 0 ? '▲ +' : '▼ '
  const cls  = change >= 0 ? 'up' : 'down'
  return `<span class="${cls}">${sign}${Math.abs(change).toFixed(2)} (${Math.abs(pct).toFixed(2)}%)</span>`
}

function setText(id, val)  { const e = document.getElementById(id); if (e) e.textContent = val }
function setHtml(id, html) { const e = document.getElementById(id); if (e) e.innerHTML   = html }

function updateGoldSignal(dxy, us02y, us10y, dxyChg, us02yChg, us10yChg) {
  let bull = 0
  if (dxyChg   < 0) bull++
  if (us02yChg < 0) bull++
  if (us10yChg < 0) bull++

  const fill = document.getElementById('sb-fill')
  if (fill) fill.style.width = `${(bull / 3) * 100}%`

  const badge = document.getElementById('gold-badge')
  const summ  = document.getElementById('sc-summary')
  if (bull >= 2) {
    badge.className = 'signal-badge signal-bullish'; badge.textContent = 'BULLISH'
    summ.textContent = 'Mayoritas indikator mendukung Gold. DXY/yield turun — kondisi favorable untuk XAU.'
  } else if (bull === 0) {
    badge.className = 'signal-badge signal-bearish'; badge.textContent = 'BEARISH'
    summ.textContent = 'DXY kuat, yield tinggi menekan Gold. Hati-hati posisi long — tunggu reversal signal.'
  } else {
    badge.className = 'signal-badge signal-neutral'; badge.textContent = 'MIXED'
    summ.textContent = 'Sinyal terbagi antara DXY dan yield. Tunggu konfirmasi arah sebelum entry.'
  }

  setText('cc-dxy-text', dxy > 104
    ? `DXY ${dxy.toFixed(2)} — kuat, tekanan bearish ke Gold`
    : `DXY ${dxy.toFixed(2)} — melemah, supportive untuk Gold`)

  const spread = (us10y - us02y).toFixed(2)
  setText('cc-yield-text', spread < 0
    ? `Inverted (${spread}%) — sinyal resesi, potensi bullish Gold`
    : `Normal (${spread}%) — yield curve wajar`)

  const sup = 'Support ~$2,300–$2,340', res = 'Resistance ~$2,420–$2,480'
  const conc = document.getElementById('cc-conclusion')
  if (bull >= 2)       conc.textContent = `Bias bullish. ${sup}, akumulasi jika DXY tidak tembus level tinggi. ${res}.`
  else if (bull === 0) conc.textContent = `Bias bearish. Tekanan DXY + yield tinggi tekan XAU. ${sup} kritis. ${res}.`
  else                 conc.textContent = `Sinyal mixed. Pantau DXY — break di atas/bawah 104 konfirmasi arah. ${sup} / ${res}.`
}

let fetchCount = 0

export async function fetchAllMarketData() {
  const liveDot = document.getElementById('live-dot')
  if (liveDot) liveDot.classList.remove('active')

  for (const id of ['dxy-val', 'us02y-val', 'us10y-val', 'gold-price']) {
    const el = document.getElementById(id)
    if (el) el.innerHTML = '<span class="loading-dot">···</span>'
  }

  const results = await Promise.allSettled([
    fetchGoldSpot(),           // XAU/USD spot — gold-api.com (gratis, no key)
    fetchYahoo('DX-Y.NYB'),   // DXY
    fetchYahoo('%5EFVX'),     // ^FVX 5yr yield
    fetchYahoo('%5ETNX'),     // ^TNX 10yr yield
  ])

  const [goldR, dxyR, us02yR, us10yR] = results

  // ---- GOLD SPOT ----
  if (goldR.status === 'fulfilled') {
    const g = goldR.value
    setText('gold-price',   `$${g.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    setText('hdr-gold-val', `$${g.price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`)
    setHtml('gold-change',  fmtChange(g.change, g.changePct))
  } else {
    setText('gold-price', '$N/A')
    console.warn('Gold gagal:', goldR.reason?.message)
  }

  // ---- DXY ----
  if (dxyR.status === 'fulfilled') {
    const q = dxyR.value
    setText('dxy-val',     q.price.toFixed(2))
    setHtml('dxy-chg',     fmtChange(q.change, q.changePct))
    setText('hdr-dxy-val', q.price.toFixed(2))
    setText('dxy-desc', q.change < 0
      ? `DXY melemah ${Math.abs(q.changePct).toFixed(2)}% — potensi relief untuk Gold.`
      : `DXY menguat ${q.changePct.toFixed(2)}% — tekanan bearish pada XAU.`)
  } else {
    setText('dxy-val', 'N/A')
    console.warn('DXY gagal:', dxyR.reason?.message)
  }

  // ---- US02Y ----
  if (us02yR.status === 'fulfilled') {
    const q = us02yR.value
    setText('us02y-val',   `${q.price.toFixed(2)}%`)
    setHtml('us02y-chg',   fmtChange(q.change, q.changePct))
    setText('hdr-02y-val', `${q.price.toFixed(2)}%`)
    setText('us02y-desc', q.change < 0
      ? `Yield 2Y turun → ekspektasi Fed cut meningkat, bullish untuk Gold.`
      : `Yield 2Y naik → Fed hawkish, tekanan pada aset non-yield.`)
  } else {
    setText('us02y-val', 'N/A')
    console.warn('US02Y gagal:', us02yR.reason?.message)
  }

  // ---- US10Y ----
  if (us10yR.status === 'fulfilled') {
    const q = us10yR.value
    setText('us10y-val',   `${q.price.toFixed(2)}%`)
    setHtml('us10y-chg',   fmtChange(q.change, q.changePct))
    setText('hdr-10y-val', `${q.price.toFixed(2)}%`)
    setText('us10y-desc', q.change < 0
      ? `Real yield turun → biaya oportunitas hold Gold berkurang, supportive.`
      : `Real yield naik → tekanan pada Gold, pertimbangkan posisi defensif.`)
  } else {
    setText('us10y-val', 'N/A')
    console.warn('US10Y gagal:', us10yR.reason?.message)
  }

  // ---- Gold signal composite ----
  if (dxyR.status === 'fulfilled' && us02yR.status === 'fulfilled' && us10yR.status === 'fulfilled') {
    updateGoldSignal(
      dxyR.value.price,  us02yR.value.price,  us10yR.value.price,
      dxyR.value.change, us02yR.value.change, us10yR.value.change,
    )
  } else {
    const failed = [goldR, dxyR, us02yR, us10yR]
      .map((r, i) => r.status === 'rejected' ? ['Gold','DXY','US02Y','US10Y'][i] : null)
      .filter(Boolean)
    if (failed.length) setText('sc-summary', `⚠️ Gagal memuat: ${failed.join(', ')}`)
  }

  fetchCount++
  setText('stat-fetch',  fetchCount)
  setText('last-update', new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false }))
  if (liveDot) liveDot.classList.add('active')

  fetchSparklines()
}

async function fetchSparklines() {
  async function getYahooSeries(symbol) {
    try {
      const res    = await fetch(`/api/stooq?path=/yahoo-hist/${encodeURIComponent(symbol)}`)
      const json   = await res.json()
      const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
      return closes.filter(v => v !== null && !isNaN(v)).slice(-8)
    } catch { return [] }
  }
  try {
    const [d, u2, u10] = await Promise.all([
      getYahooSeries('DX-Y.NYB'),
      getYahooSeries('%5EFVX'),
      getYahooSeries('%5ETNX'),
    ])
    drawSparkline('spark-dxy',   d,   '#f87171', 'rgba(248,113,113,0.06)')
    drawSparkline('spark-us02y', u2,  '#60a5fa', 'rgba(96,165,250,0.06)')
    drawSparkline('spark-us10y', u10, '#4ade80', 'rgba(74,222,128,0.06)')
  } catch (err) {
    console.warn('Sparkline gagal:', err)
  }
}

export function getCurrentMarketSnapshot() {
  return {
    gold:   document.getElementById('gold-price')?.textContent  ?? '—',
    dxy:    document.getElementById('dxy-val')?.textContent     ?? '—',
    us02y:  document.getElementById('us02y-val')?.textContent   ?? '—',
    us10y:  document.getElementById('us10y-val')?.textContent   ?? '—',
    signal: document.getElementById('gold-badge')?.textContent  ?? '—',
  }
}
