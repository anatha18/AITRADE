/* =============================================
   market.js — Real-time market data
   
   Sumber data (semua lewat proxy /api/stooq):
   - Gold (XAU/USD)  : Alpha Vantage (/api/av)
   - DXY             : Yahoo Finance  (DX-Y.NYB)
   - US02Y           : Yahoo Finance  (^IRX → 13wk, atau stooq dx.f fallback)
   - US10Y           : Yahoo Finance  (^TNX)
   ============================================= */

/* ---- Fetch Alpha Vantage via proxy ---- */
async function avFetch(params) {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`/api/av?${qs}`)
  if (!res.ok) throw new Error(`AV proxy HTTP ${res.status}`)
  return res.json()
}

/* ---- Fetch Yahoo Finance via proxy ---- */
async function fetchYahoo(symbol) {
  const res = await fetch(`/api/stooq?path=/yahoo/${encodeURIComponent(symbol)}`)
  if (!res.ok) throw new Error(`Yahoo proxy HTTP ${res.status}`)
  const json = await res.json()

  const meta   = json?.chart?.result?.[0]?.meta
  if (!meta)   throw new Error(`Yahoo: no data untuk ${symbol}`)

  const price      = meta.regularMarketPrice
  const prevClose  = meta.chartPreviousClose ?? meta.previousClose ?? price
  const change     = price - prevClose
  const changePct  = prevClose !== 0 ? (change / prevClose) * 100 : 0
  return { price, change, changePct, prevClose }
}

/* ---- Fetch stooq quote via proxy (fallback) ---- */
async function fetchStooq(symbol) {
  const path = `/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcvn&e=csv`
  const res = await fetch(`/api/stooq?path=${encodeURIComponent(path)}`)
  if (!res.ok) throw new Error(`stooq proxy HTTP ${res.status}`)
  const text  = await res.text()
  const lines = text.trim().split('\n')
  if (lines.length < 2) throw new Error(`stooq: no data untuk ${symbol}`)
  const cols  = lines[1].split(',')
  const close = parseFloat(cols[6])
  const open  = parseFloat(cols[3])
  if (isNaN(close) || close === 0) throw new Error(`stooq: data invalid untuk ${symbol} → "${lines[1]}"`)
  const change    = close - open
  const changePct = open !== 0 ? (change / open) * 100 : 0
  return { price: close, change, changePct, prevClose: open }
}

/* ---- Fetch weekly series untuk sparkline via stooq ---- */
async function fetchStooqSeries(symbol) {
  const path = `/q/d/l/?s=${encodeURIComponent(symbol)}&i=w`
  const res  = await fetch(`/api/stooq?path=${encodeURIComponent(path)}`)
  if (!res.ok) return []
  const text  = await res.text()
  const lines = text.trim().split('\n').slice(1)
  return lines.slice(-8).map(l => parseFloat(l.split(',')[4])).filter(v => !isNaN(v))
}

/* ---- Fetch Gold (XAU/USD) via Alpha Vantage ---- */
async function fetchGold() {
  const data = await avFetch({ function: 'CURRENCY_EXCHANGE_RATE', from_currency: 'XAU', to_currency: 'USD' })
  const rate  = data['Realtime Currency Exchange Rate']
  if (!rate) throw new Error('Gold: no data dari Alpha Vantage')
  return {
    price: parseFloat(rate['5. Exchange Rate']).toFixed(2),
    bid:   parseFloat(rate['8. Bid Price']).toFixed(2),
    ask:   parseFloat(rate['9. Ask Price']).toFixed(2),
  }
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
  return `<span class="${cls}">${sign}${change.toFixed(2)} (${pct.toFixed(2)}%)</span>`
}

function setText(id, val)  { const e = document.getElementById(id); if (e) e.textContent = val }
function setHtml(id, html) { const e = document.getElementById(id); if (e) e.innerHTML = html }

function updateGoldSignal(dxy, us02y, us10y, dxyChg, us02yChg, us10yChg) {
  let bull = 0
  if (dxyChg < 0)   bull++
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
  if (bull >= 2)  conc.textContent = `Bias bullish. ${sup}, akumulasi jika DXY tidak tembus level tinggi. ${res}.`
  else if (bull === 0) conc.textContent = `Bias bearish. Tekanan DXY + yield tinggi tekan XAU. ${sup} kritis. ${res}.`
  else conc.textContent = `Sinyal mixed. Pantau DXY — break di atas/bawah 104 akan konfirmasi arah. ${sup} / ${res}.`
}

let fetchCount = 0

export async function fetchAllMarketData() {
  const liveDot = document.getElementById('live-dot')
  if (liveDot) liveDot.classList.remove('active')

  for (const id of ['dxy-val', 'us02y-val', 'us10y-val', 'gold-price']) {
    const el = document.getElementById(id)
    if (el) el.innerHTML = '<span class="loading-dot">···</span>'
  }

  // DXY: coba Yahoo dulu, fallback ke stooq dx.f
  async function fetchDXY() {
    try { return await fetchYahoo('DX-Y.NYB') }
    catch { return await fetchStooq('dx.f') }
  }

  // US02Y: Yahoo ^IRX (13-week T-bill sebagai proxy short rate)
  async function fetchUS02Y() {
    try { return await fetchYahoo('%5EIRX') }    // ^IRX
    catch { return await fetchStooq('ust2y.b') }
  }

  // US10Y: Yahoo ^TNX
  async function fetchUS10Y() {
    try { return await fetchYahoo('%5ETNX') }    // ^TNX
    catch { return await fetchStooq('ust10y.b') }
  }

  const results = await Promise.allSettled([
    fetchGold(),
    fetchDXY(),
    fetchUS02Y(),
    fetchUS10Y(),
  ])

  const [goldR, dxyR, us02yR, us10yR] = results

  // ---- GOLD ----
  if (goldR.status === 'fulfilled') {
    const g = goldR.value
    const priceStr = `$${parseFloat(g.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    setText('gold-price',   priceStr)
    setText('hdr-gold-val', `$${parseFloat(g.price).toLocaleString('en-US', { minimumFractionDigits: 0 })}`)
    setHtml('gold-change',  `<span class="neutral">Bid $${g.bid} / Ask $${g.ask}</span>`)
  } else {
    setText('gold-price', '$N/A')
    console.warn('Gold gagal:', goldR.reason?.message)
  }

  // ---- DXY ----
  if (dxyR.status === 'fulfilled') {
    const q = dxyR.value
    setText('dxy-val',      q.price.toFixed(2))
    setHtml('dxy-chg',      fmtChange(q.change, q.changePct))
    setText('hdr-dxy-val',  q.price.toFixed(2))
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
    setText('us02y-val',    `${q.price.toFixed(2)}%`)
    setHtml('us02y-chg',    fmtChange(q.change, q.changePct))
    setText('hdr-02y-val',  `${q.price.toFixed(2)}%`)
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
    setText('us10y-val',    `${q.price.toFixed(2)}%`)
    setHtml('us10y-chg',    fmtChange(q.change, q.changePct))
    setText('hdr-10y-val',  `${q.price.toFixed(2)}%`)
    setText('us10y-desc', q.change < 0
      ? `Real yield turun → biaya oportunitas hold Gold berkurang, supportive.`
      : `Real yield naik → tekanan pada Gold, pertimbangkan posisi defensif.`)
  } else {
    setText('us10y-val', 'N/A')
    console.warn('US10Y gagal:', us10yR.reason?.message)
  }

  // ---- Gold signal ----
  if (dxyR.status === 'fulfilled' && us02yR.status === 'fulfilled' && us10yR.status === 'fulfilled') {
    updateGoldSignal(
      dxyR.value.price,   us02yR.value.price,   us10yR.value.price,
      dxyR.value.change,  us02yR.value.change,  us10yR.value.change,
    )
  } else {
    const failed = [goldR,dxyR,us02yR,us10yR]
      .map((r,i) => r.status==='rejected' ? ['Gold','DXY','US02Y','US10Y'][i] : null)
      .filter(Boolean)
    setText('sc-summary', `⚠️ Gagal memuat: ${failed.join(', ')}. Buka console untuk detail.`)
  }

  // ---- Stats & timestamp ----
  fetchCount++
  setText('stat-fetch',  fetchCount)
  setText('last-update', new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false }))
  if (liveDot) liveDot.classList.add('active')

  // ---- Sparklines (non-blocking) ----
  fetchSparklines()
}

async function fetchSparklines() {
  try {
    const [d, u2, u10] = await Promise.all([
      fetchStooqSeries('dx.f'),
      fetchStooqSeries('ust2y.b'),
      fetchStooqSeries('ust10y.b'),
    ])
    drawSparkline('spark-dxy',   d,   '#f87171', 'rgba(248,113,113,0.06)')
    drawSparkline('spark-us02y', u2,  '#60a5fa', 'rgba(96,165,250,0.06)')
    drawSparkline('spark-us10y', u10, '#4ade80', 'rgba(74,222,128,0.06)')
  } catch (err) {
    console.warn('Sparkline gagal (non-critical):', err)
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
