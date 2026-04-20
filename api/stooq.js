// Vercel Edge Function — proxy untuk market data
// Mendukung: stooq.com (DXY/yields) dan Yahoo Finance
export const config = { runtime: 'edge' }

export default async function handler(req) {
  const url = new URL(req.url)
  const path = url.searchParams.get('path') || ''

  // Tentukan target berdasarkan prefix path
  let targetUrl
  if (path.startsWith('/yahoo/')) {
    // Yahoo Finance quote: /yahoo/DX-Y.NYB
    const symbol = path.replace('/yahoo/', '')
    targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
  } else {
    // stooq.com
    targetUrl = `https://stooq.com${path}`
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
        'Accept': 'text/plain,application/json,text/csv,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    const text = await res.text()
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': path.startsWith('/yahoo/') ? 'application/json' : 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return new Response(`ERROR: ${err.message}`, {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }
}
