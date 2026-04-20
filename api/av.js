// Vercel Edge Function — proxy Alpha Vantage (avoids browser CORS)
export const config = { runtime: 'edge' }

export default async function handler(req) {
  const url = new URL(req.url)
  const params = url.searchParams
  params.set('apikey', process.env.VITE_ALPHA_VANTAGE_KEY || '')

  try {
    const res = await fetch(`https://www.alphavantage.co/query?${params}`)
    const data = await res.text()
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
