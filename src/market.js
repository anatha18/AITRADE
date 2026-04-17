/* =============================================
   market.js — Real-time market data
   - Gold (XAU/USD): Alpha Vantage
   - DXY, US02Y, US10Y: stooq.com (no API key needed)
   ============================================= */

const AV_KEY = import.meta.env.VITE_ALPHA_VANTAGE_KEY
const AV_BASE = 'https://www.alphavantage.co/query'

async function avFetch(params) {
  const url = new URL(AV_BASE)
  url.searchParams.set('apikey', AV_KEY)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function fetchGold() {
  const data = await avFetch({ function: 'CURRENCY_EXCHANGE_RATE', from_currency: 'XAU', to_currency: 'USD' })
  const rate = data['Realtime Currency Exchange Rate']
  if (!rate) throw new Error('Gold data unavailable')
  const price = parseFloat(rate['5. Exchange Rate']).toFixed(2)
  const bid   = parseFloat(rate['8. Bid Price']).toFixed(2)
  const ask   = parseFloat(rate['9. Ask Price']).toFixed(2)
  return { price, bid, ask, time: rate['6. Last Refreshed'] }
}

// stooq.com CSV: Symbol,Date,Time,Open,High,Low,Close,Volume,Name
async function fetchStooq(symbol) {
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcvn&e=csv`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`stooq HTTP ${res.status}`)
  const text = await res.text()
  const lines = text.trim().split('\n')
  if (lines.length < 2) throw new Error(`No data for ${symbol}`)
  const cols = lines[1].split(',')
  const close = parseFloat(cols[6])
  const open  = parseFloat(cols[3])
  if (isNaN(close)) throw new Error(`Invalid stooq data for ${symbol}`)
  const change    = close - open
  const changePct = open !== 0 ? (change / open) * 100 : 0
  return { price: close, change, changePct, prevClose: open }
}

async function fetchStooqSeries(symbol) {
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=w`
  const res = await fetch(url)
  if (!res.ok) return []
  const text = await res.text()
  const lines = text.trim().split('\n').slice(1)
  return lines
    .slice(-8)
    .map(l => parseFloat(l.split(',')[4]))
    .filter(v => !isNaN(v))
}

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

function fmtChange(change, pct) {
  const sign = change >= 0 ? '▲ +' : '▼ '
  const cls  = change >= 0 ? 'up' : 'down'
  return `<span class="${cls}">${sign}${change.toFixed(2)} (${pct.toFixed(2)}%)</span>`
}

function updateGoldSignal(dxy, us02y, us10y, dxyChg, us02yChg, us10yChg) {
  let bullScore = 0
  if (dxyChg < 0)   bullScore++
  if (us02yChg < 0) bullScore++
  if (us10yChg < 0) bullScore++

  const pct  = (bullScore / 3) * 100
  const fill = document.getElementById('sb-fill')
  if (fill) fill.style.width = `${pct}%`

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

  const dxyImpact = dxy > 104
    ? `DXY ${dxy.toFixed(2)} — kuat, tekanan bearish ke Gold`
    : `DXY ${dxy.toFixed(2)} — melemah, supportive untuk Gold`
  document.getElementById('cc-dxy-text').textContent = dxyImpact

  const spread    = (us10y - us02y).toFixed(2)
  const yieldText = spread < 0
    ? `Inverted (${spread}%) — sinyal resesi, potensi bullish Gold`
    : `Normal (${spread}%) — yield curve wajar`
  document.getElementById('cc-yield-text').textContent = yieldText

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

let fetchCount = 0

export async function fetchAllMarketData() {
  const liveDot = document.getElementById('live-dot')
  if (liveDot) liveDot.classList.remove('active')

  for (const id of ['dxy-val', 'us02y-val', 'us10y-val']) {
    const el = document.getElementById(id)
    if (el) el.textContent = '...'
  }

  try {
    const [goldData, dxyQ, us02yQ, us10yQ] = await Promise.all([
      fetchGold(),
      fetchStooq('dxy'),
      fetchStooq('ust2y.b'),
      fetchStooq('ust10y.b'),
    ])

    fetchCount++
    const fetchEl = document.getElementById('stat-fetch')
    if (fetchEl) fetchEl.textContent = fetchCount

    document.getElementById('gold-price').textContent   = `$${parseFloat(goldData.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    document.getElementById('hdr-gold-val').textContent = `$${parseFloat(goldData.price).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
    document.getElementById('gold-change').innerHTML    = `<span class="neutral">Bid $${goldData.bid} / Ask $${goldData.ask}</span>`

    document.getElementById('dxy-val').textContent       = dxyQ.price.toFixed(2)
    document.getElementById('dxy-chg').innerHTML         = fmtChange(dxyQ.change, dxyQ.changePct)
    document.getElementById('hdr-dxy-val').textContent   = dxyQ.price.toFixed(2)
    document.getElementById('dxy-desc').textContent      = dxyQ.change < 0
      ? `DXY melemah ${Math.abs(dxyQ.changePct).toFixed(2)}% — potensi relief untuk Gold.`
      : `DXY menguat ${dxyQ.changePct.toFixed(2)}% — tekanan bearish pada XAU.`

    document.getElementById('us02y-val').textContent     = `${us02yQ.price.toFixed(2)}%`
    document.getElementById('us02y-chg').innerHTML       = fmtChange(us02yQ.change, us02yQ.changePct)
    document.getElementById('hdr-02y-val').textContent   = `${us02yQ.price.toFixed(2)}%`
    document.getElementById('us02y-desc').textContent    = us02yQ.change < 0
      ? `Yield 2Y turun → ekspektasi Fed cut meningkat, bullish untuk Gold.`
      : `Yield 2Y naik → Fed hawkish, tekanan pada aset non-yield.`

    document.getElementById('us10y-val').textContent     = `${us10yQ.price.toFixed(2)}%`
    document.getElementById('us10y-chg').innerHTML       = fmtChange(us10yQ.change, us10yQ.changePct)
    document.getElementById('hdr-10y-val').textContent   = `${us10yQ.price.toFixed(2)}%`
    document.getElementById('us10y-desc').textContent    = us10yQ.change < 0
      ? `Real yield turun → biaya oportunitas hold Gold berkurang, supportive.`
      : `Real yield naik → tekanan pada Gold, pertimbangkan posisi defensif.`

    updateGoldSignal(
      dxyQ.price, us02yQ.price, us10yQ.price,
      dxyQ.change, us02yQ.change, us10yQ.change
    )

    const now = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false })
    document.getElementById('last-update').textContent = now

    fetchSparklines()
    if (liveDot) liveDot.classList.add('active')

  } catch (err) {
    console.error('Market data fetch error:', err)
    document.getElementById('sc-summary').textContent = `⚠️ Gagal memuat data: ${err.message}`
    for (const id of ['dxy-val', 'us02y-val', 'us10y-val']) {
      const el = document.getElementById(id)
      if (el && el.textContent === '...') el.textContent = 'N/A'
    }
  }
}

async function fetchSparklines() {
  try {
    const [dxySeries, us02ySeries, us10ySeries] = await Promise.all([
      fetchStooqSeries('dxy'),
      fetchStooqSeries('ust2y.b'),
      fetchStooqSeries('ust10y.b'),
    ])
    drawSparkline('spark-dxy',   dxySeries,   '#f87171', 'rgba(248,113,113,0.06)')
    drawSparkline('spark-us02y', us02ySeries, '#60a5fa', 'rgba(96,165,250,0.06)')
    drawSparkline('spark-us10y', us10ySeries, '#4ade80', 'rgba(74,222,128,0.06)')
  } catch (err) {
    console.warn('Sparkline fetch failed:', err)
  }
}

export function getCurrentMarketSnapshot() {
  return {
    gold:   document.getElementById('gold-price')?.textContent ?? '—',
    dxy:    document.getElementById('dxy-val')?.textContent    ?? '—',
    us02y:  document.getElementById('us02y-val')?.textContent  ?? '—',
    us10y:  document.getElementById('us10y-val')?.textContent  ?? '—',
    signal: document.getElementById('gold-badge')?.textContent ?? '—',
  }
}
