// Vercel serverless function — proxies stooq.com
// Avoids CORS: browser → /api/stooq → stooq.com
export default async function handler(req, res) {
  const { path } = req.query
  const url = `https://stooq.com${path}`

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const text = await response.text()
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', 'text/plain')
    res.status(200).send(text)
  } catch (err) {
    res.status(500).send(`ERROR: ${err.message}`)
  }
}
