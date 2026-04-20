// Vercel Edge Function — proxy market data
// Routes:
//   /yahoo/{symbol}       → Yahoo Finance quote (interval=1d&range=5d)
//   /yahoo-hist/{symbol}  → Yahoo Finance historical (interval=1d&range=1mo)
//   default               → stooq.com passthrough
export const config = { runtime: 'edge' }

export default async function handler(req) {
  const url  = new URL(req.url)
  const path = url.searchParams.get('path') || ''

  let targetUrl, contentType = 'text/plain'

  if (path.startsWith('/yahoo-hist/')) {
    const symbol = path.replace('/yahoo-hist/', '')
    targetUrl    = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1mo`
    contentType  = 'application/json'
  } else if (path.startsWith('/yahoo/')) {
    const symbol = path.replace('/yahoo/', '')
    targetUrl    = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`
    contentType  = 'application/json'
  } else {
    targetUrl = `https://stooq.com${path}`
  }

  try {
    const res  = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://finance.yahoo.com',
        'Referer': 'https://finance.yahoo.com/',
      },
    })
    const text = await res.text()
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}
