/* =============================================
   market.js — Market data simulation & sparklines
   ============================================= */

export const marketData = {
  dxy:   [103.2, 103.8, 104.1, 103.9, 104.5, 104.3, 104.6, 104.82],
  us02y: [4.85,  4.80,  4.76,  4.79,  4.74,  4.72,  4.73,  4.71],
  us10y: [4.55,  4.50,  4.45,  4.48,  4.42,  4.40,  4.41,  4.38],
}

/**
 * Draw a sparkline onto a <canvas> element.
 * @param {string} canvasId
 * @param {number[]} data
 * @param {string} color  — stroke color
 * @param {string} fill   — optional fill color (rgba)
 */
export function drawSparkline(canvasId, data, color, fill) {
  const canvas = document.getElementById(canvasId)
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * (h - 4) - 2,
  }))

  ctx.beginPath()
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.stroke()

  if (fill) {
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
  }
}

/** Draw all three sparklines with their respective colors. */
export function drawAllSparklines() {
  drawSparkline('spark-dxy',   marketData.dxy,   '#f87171', 'rgba(248,113,113,0.06)')
  drawSparkline('spark-us02y', marketData.us02y, '#60a5fa', 'rgba(96,165,250,0.06)')
  drawSparkline('spark-us10y', marketData.us10y, '#4ade80', 'rgba(74,222,128,0.06)')
}

/** Update the Gold signal badge & summary based on current indicator values. */
export function updateGoldSignal(dxy, us02y, us10y) {
  let bullScore = 0
  if (dxy   < 104) bullScore++
  if (us02y < 4.7) bullScore++
  if (us10y < 4.4) bullScore++

  const badge   = document.getElementById('gold-badge')
  const summary = document.getElementById('gold-summary')

  if (bullScore >= 2) {
    badge.className = 'signal-badge signal-bullish'
    badge.textContent = 'BULLISH'
    summary.textContent = 'Mayoritas indikator supportive untuk Gold. DXY melemah + yield turun = kondisi ideal akumulasi XAU.'
  } else if (bullScore === 0) {
    badge.className = 'signal-badge signal-bearish'
    badge.textContent = 'BEARISH'
    summary.textContent = 'DXY kuat dan yield tinggi menekan Gold. Hati-hati dengan posisi long — tunggu reversal.'
  } else {
    badge.className = 'signal-badge signal-neutral'
    badge.textContent = 'MIXED'
    summary.textContent = 'Sinyal terbagi. DXY vs yield saling bertolak. Tunggu konfirmasi arah sebelum entry.'
  }
}

/** Simulate a market data refresh with small random noise. */
export function simulateUpdate() {
  const noise = () => (Math.random() - 0.5) * 0.2
  const dxy   = parseFloat((104.82 + noise()).toFixed(2))
  const us02y = parseFloat((4.71   + noise() * 0.1).toFixed(2))
  const us10y = parseFloat((4.38   + noise() * 0.1).toFixed(2))
  const goldP = Math.round(2387 + (Math.random() - 0.5) * 20)

  document.getElementById('dxy-val').textContent   = dxy
  document.getElementById('us02y-val').textContent = us02y + '%'
  document.getElementById('us10y-val').textContent = us10y + '%'
  document.getElementById('gold-val').textContent  = '$' + goldP.toLocaleString('id-ID')

  updateGoldSignal(dxy, us02y, us10y)

  const now = new Date().toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour12: false,
  })
  document.getElementById('last-update').textContent = now
}
