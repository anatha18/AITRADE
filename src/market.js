/* =============================================
   market.js — Real-time market data via Alpha Vantage
   ============================================= */

const AV_KEY = import.meta.env.VITE_ALPHA_VANTAGE_KEY
const BASE    = 'https://www.alphavantage.co/query'

// Symbols: AV uses specific symbols for these
const SYMBOLS = {
  gold:  { fn: 'CURRENCY_EXCHANGE_RATE', from: 'XAU', to: 'USD' },
  dxy:   { fn: 'GLOBAL_QUOTE', symbol: 'DX-Y.NYB' },
  us02y: { fn: 'GLOBAL_QUOTE', symbol: 'US2YT=X'  },
  us10y: { fn: 'GLOBAL_QUOTE', symbol: 'TNX'       },
}

// Historical daily data for sparklines (weekly series)
const SERIES_SYMBOLS = {
  dxy:   'DX-Y.NYB',
  us02y: 'US2YT=X',
  us10y: 'TNX',
}

let fetchCount = 0

/* ---- Generic fetch with AV ---- */
async function avFetch(params) {
  const url = new URL(BASE)
  url.searchParams.set('apikey', AV_KEY)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/* ---- Fetch Gold price (XAU/USD) ---- */
async function fetchGold() {
  const data = await avFetch({ function: 'CURRENCY_EXCHANGE_RATE', from_currency: 'XAU', to_currency: 'USD' })
  const rate  = data['Realtime Currency Exchange Rate']
  if (!rate) throw new Error('Gold data unavailable')
  const price  = parseFloat(rate['5. Exchange Rate']).toFixed(2)
  const bid    = parseFloat(rate['8. Bid Price']).toFixed(2)
  const ask    = parseFloat(rate['9. Ask Price']).toFixed(2)
  return { price, bid, ask, time: rate['6. Last Refreshed'] }
}

/* ---- Fetch a GLOBAL_QUOTE ---- */
async function fetchQuote(symbol) {
  const data  = await avFetch({ function: 'GLOBAL_QUOTE', symbol })
  const quote = data['Global Quote']
  if (!quote || !quote['05. price']) throw new Error(`No quote for ${symbol}`)
  return {
    price:      parseFloat(quote['05. price']),
    change:     parseFloat(quote['09. change']),
    changePct:  parseFloat(quote['10. change percent'].replace('%', '')),
    prevClose:  parseFloat(quote['08. previous close']),
  }
}

/* ---- Fetch weekly time series for sparkline ---- */
async function fetchSeries(symbol) {
  const data   = await avFetch({ function: 'TIME_SERIES_WEEKLY', symbol })
  const series = data['Weekly Time Series']
  if (!series) return []
  return Object.entries(series)
    .slice(0, 8)
    .reverse()
    .map(([, v]) => parseFloat(v['4. close']))
}

/* ---- Draw sparkline on canvas ---- */
export function drawSparkline(canvasId, data, color, fillColor) {
  const canvas = document.getElementById(canvasId)
  if (!canvas || !data.length) return
  const ctx = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height
  ctx.clearRect(0, 0, w, h)

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 0.001

  const pts = data.map((v, i) => ({
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

/* ---- Format change string ---- */
function fmtChange(change, pct) {
  const sign  = change >= 0 ? '▲ +' : '▼ '
  const cls   = change >= 0 ? 'up' : 'down'
  return `<span class="${cls}">${sign}${change.toFixed(2)} (${pct.toFixed(2)}%)</span>`
}

/* ---- Update Gold signal ---- */
function updateGoldSignal(dxy, us02y, us10y, dxyChg, us02yChg, us10yChg) {
  let bullScore = 0
  let totalSignals = 3

  // DXY falling = bullish gold
  if (dxyChg < 0) bullScore++
  // Short yield falling = bullish (Fed cut expectation)
  if (us02yChg < 0) bullScore++
  // Long yield falling = bullish (real yield down)
  if (us10yChg < 0) bullScore++

  const pct  = (bullScore / totalSignals) * 100
  const fill = document.getElementById('sb-fill')
  if (fill) fill.style.width = `${pct}%`

  const badge   = document.getElementById('gold-badge')
  const summary = document.getElementById('sc-summary')

  if (bullScore >= 2) {
    badge.className = 'signal-badge signal-bullish'
    badge.textContent = 'BULLISH'
    summary.textContent = 'Mayoritas indikator mendukung Gold. DXY/yield turun — kondisi favorable untuk XAU.'
  } else if (bullScore === 0) {
    badge.className = 'signal-badge signal-bearish'
    badge.textContent = 'BEARISH'
    summary.textContent = 'DXY kuat, yield tinggi menekan Gold. Hati-hati posisi long — tunggu reversal signal.'
  } else {
    badge.className = 'signal-badge signal-neutral'
    badge.textContent = 'MIXED'
    summary.textContent = 'Sinyal terbagi antara DXY dan yield. Tunggu konfirmasi arah sebelum entry.'
  }

  // DXY impact text
  const dxyImpact = dxy > 104
    ? `DXY ${dxy.toFixed(2)} — kuat, tekanan bearish ke Gold`
    : `DXY ${dxy.toFixed(2)} — melemah, supportive untuk Gold`
  document.getElementById('cc-dxy-text').textContent = dxyImpact

  // Yield curve text
  const spread = (us10y - us02y).toFixed(2)
  const yieldText = spread < 0
    ? `Inverted (${spread}%) — sinyal resesi, potensi bullish Gold`
    : `Normal (${spread}%) — yield curve wajar`
  document.getElementById('cc-yield-text').textContent = yieldText

  // Conclusion
  const supLevel = 'Support ~$2,300–$2,340'
  const resLevel = 'Resistance ~$2,420–$2,480'
  const conclusionEl = document.getElementById('cc-conclusion')
  if (bullScore >= 2) {
    conclusionEl.textContent = `Bias bullish. ${supLevel}, bias akumulasi jika DXY tidak tembus level tinggi. ${resLevel}.`
  } else if (bullScore === 0) {
    conclusionEl.textContent = `Bias bearish. Tekanan DXY + yield tinggi tekan XAU. ${supLevel} kritis. ${resLevel}.`
  } else {
    conclusionEl.textContent = `Sinyal mixed. Pantau pergerakan DXY — break di atas/bawah 104 akan konfirmasi arah. ${supLevel} / ${resLevel}.`
  }
}

/* ---- Main: fetch all market data ---- */
export async function fetchAllMarketData() {
  const liveDot = document.getElementById('live-dot')
  if (liveDot) liveDot.classList.remove('active')

  try {
    // Fetch in parallel — Gold + three quotes + weekly series
    const [goldData, dxyQ, us02yQ, us10yQ] = await Promise.all([
      fetchGold(),
      fetchQuote(SERIES_SYMBOLS.dxy),
      fetchQuote(SERIES_SYMBOLS.us02y),
      fetchQuote(SERIES_SYMBOLS.us10y),
    ])

    fetchCount++
    document.getElementById('stat-fetch').textContent = fetchCount

    // ---- GOLD ----
    document.getElementById('gold-price').textContent   = `$${parseFloat(goldData.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    document.getElementById('hdr-gold-val').textContent = `$${parseFloat(goldData.price).toLocaleString('en-US', { minimumFractionDigits: 0 })}`

    // ---- DXY ----
    const dxyEl = document.getElementById('dxy-val')
    if (dxyEl) dxyEl.textContent = dxyQ.price.toFixed(2)
    document.getElementById('dxy-chg').innerHTML  = fmtChange(dxyQ.change, dxyQ.changePct)
    document.getElementById('hdr-dxy-val').textContent = dxyQ.price.toFixed(2)
    document.getElementById('dxy-desc').textContent = dxyQ.change < 0
      ? `DXY melemah ${Math.abs(dxyQ.changePct).toFixed(2)}% — potensi relief untuk Gold.`
      : `DXY menguat ${dxyQ.changePct.toFixed(2)}% — tekanan bearish pada XAU.`

    // ---- US02Y ----
    document.getElementById('us02y-val').textContent  = `${us02yQ.price.toFixed(2)}%`
    document.getElementById('us02y-chg').innerHTML    = fmtChange(us02yQ.change, us02yQ.changePct)
    document.getElementById('hdr-02y-val').textContent = `${us02yQ.price.toFixed(2)}%`
    document.getElementById('us02y-desc').textContent = us02yQ.change < 0
      ? `Yield 2Y turun → ekspektasi Fed cut meningkat, bullish untuk Gold.`
      : `Yield 2Y naik → Fed hawkish, tekanan pada aset non-yield.`

    // ---- US10Y ----
    document.getElementById('us10y-val').textContent  = `${us10yQ.price.toFixed(2)}%`
    document.getElementById('us10y-chg').innerHTML    = fmtChange(us10yQ.change, us10yQ.changePct)
    document.getElementById('hdr-10y-val').textContent = `${us10yQ.price.toFixed(2)}%`
    document.getElementById('us10y-desc').textContent = us10yQ.change < 0
      ? `Real yield turun → biaya oportunitas hold Gold berkurang, supportive.`
      : `Real yield naik → tekanan pada Gold, pertimbangkan posisi defensif.`

    // ---- Update gold change display ----
    // (Gold spot doesn't have direct change from AV CURRENCY_EXCHANGE_RATE, use bid/ask spread as proxy)
    document.getElementById('gold-change').innerHTML = `<span class="neutral">Bid $${goldData.bid} / Ask $${goldData.ask}</span>`

    // ---- Gold signal composite ----
    updateGoldSignal(
      dxyQ.price, us02yQ.price, us10yQ.price,
      dxyQ.change, us02yQ.change, us10yQ.change
    )

    // ---- Last update time ----
    const now = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false })
    document.getElementById('last-update').textContent = now

    // ---- Fetch sparklines (separate, slower — weekly series) ----
    fetchSparklines()

    if (liveDot) liveDot.classList.add('active')

  } catch (err) {
    console.error('Market data fetch error:', err)
    // Show fallback / error state
    document.getElementById('sc-summary').textContent = `⚠️ Gagal memuat data: ${err.message}. Cek API Key Alpha Vantage.`
  }
}

/* ---- Fetch & draw sparklines (non-blocking) ---- */
async function fetchSparklines() {
  try {
    const [dxySeries, us02ySeries, us10ySeries] = await Promise.all([
      fetchSeries(SERIES_SYMBOLS.dxy),
      fetchSeries(SERIES_SYMBOLS.us02y),
      fetchSeries(SERIES_SYMBOLS.us10y),
    ])
    drawSparkline('spark-dxy',   dxySeries,   '#f87171', 'rgba(248,113,113,0.06)')
    drawSparkline('spark-us02y', us02ySeries, '#60a5fa', 'rgba(96,165,250,0.06)')
    drawSparkline('spark-us10y', us10ySeries, '#4ade80', 'rgba(74,222,128,0.06)')
  } catch (err) {
    console.warn('Sparkline fetch failed:', err)
  }
}

/* ---- Public getter for current market state (used by chat) ---- */
export function getCurrentMarketSnapshot() {
  return {
    gold:  document.getElementById('gold-price')?.textContent ?? '—',
    dxy:   document.getElementById('dxy-val')?.textContent    ?? '—',
    us02y: document.getElementById('us02y-val')?.textContent  ?? '—',
    us10y: document.getElementById('us10y-val')?.textContent  ?? '—',
    signal: document.getElementById('gold-badge')?.textContent ?? '—',
  }
}
