// Vercel serverless function — proxies Alpha Vantage
// Avoids CORS: browser → /api/av → Alpha Vantage
export default async function handler(req, res) {
  const params = new URLSearchParams(req.query)
  params.set('apikey', process.env.VITE_ALPHA_VANTAGE_KEY || '')

  try {
    const response = await fetch(`https://www.alphavantage.co/query?${params}`)
    const data = await response.json()
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
