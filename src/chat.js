/* =============================================
   chat.js — DeepSeek AI Chat (API key from .env)
   ============================================= */

import { getCurrentMarketSnapshot } from './market.js'

const DEEPSEEK_API   = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = 'deepseek-chat'
const DEEPSEEK_KEY   = import.meta.env.VITE_DEEPSEEK_KEY

/* ---- State ---- */
let conversationHistory = []
let learnedTopics       = []
let questionCount       = 0
let topicCount          = 0

/* ---- Keyword groups for topic extraction ---- */
const KEYWORD_GROUPS = [
  ['gold',           'XAU',       'emas'],
  ['DXY',            'dolar',     'dollar'],
  ['yield',          'US02Y',     'US10Y',    'obligasi'],
  ['Fed',            'FOMC',      'suku bunga'],
  ['Bitcoin',        'kripto',    'crypto'],
  ['support',        'resistance','level'],
  ['scalping',       'swing',     'position trading'],
  ['risk management','stop loss', 'take profit'],
  ['Elliott',        'fibonacci', 'wave'],
  ['moving average', 'RSI',       'MACD'],
  ['fundamental',    'NFP',       'CPI',      'inflasi'],
  ['forex',          'EUR',       'GBP',      'JPY'],
]

/* ---- Build system prompt with live market data ---- */
function buildSystemPrompt() {
  const snap = getCurrentMarketSnapshot()
  const memCtx = learnedTopics.length > 0
    ? `\n\nTopik yang dipelajari dari pengguna:\n${learnedTopics.map(t => `- ${t}`).join('\n')}`
    : ''

  return `Kamu adalah AI Trading Assistant profesional — TradeAI — yang fokus pada analisis pasar keuangan khususnya Gold (XAU/USD), Forex, dan instrumen derivatif. Berbicara dalam Bahasa Indonesia, profesional namun mudah dipahami.

Data pasar LIVE saat ini:
- XAU/USD (Gold): ${snap.gold}
- DXY (USD Index): ${snap.dxy}
- US02Y (2-Year Yield): ${snap.us02y}
- US10Y (10-Year Yield): ${snap.us10y}
- Gold Signal: ${snap.signal}

Keahlian:
1. Analisis macro: DXY, yield curve, Fed policy → dampak ke Gold
2. Technical & fundamental analysis
3. Risk management, money management, position sizing
4. Strategi trading: scalping, swing, position trading
5. Interpretasi yield curve, spread 2Y-10Y, inversion
6. Korelasi antar aset (Gold, USD, bonds, equities)

Aturan:
- Selalu reference data live di atas dalam analisis
- Ingat topik yang sudah didiskusikan (context window)
- Tambahkan disclaimer "bukan saran keuangan" untuk rekomendasi spesifik
- Jawab concise, terstruktur, gunakan angka nyata dari data live
- Bila sinyal bertentangan, jelaskan konfliknya secara objektif${memCtx}`
}

/* ---- DOM helpers ---- */
export function addMessage(role, text) {
  const container = document.getElementById('chat-messages')
  const div = document.createElement('div')
  div.className = `message ${role}`

  const time = new Date().toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta', hour12: false, hour: '2-digit', minute: '2-digit',
  })

  // Simple markdown: **bold**, newlines
  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')

  div.innerHTML = `
    <div class="message-bubble">${html}</div>
    <div class="message-meta">${role === 'ai' ? 'TradeAI' : 'Anda'} • ${time}</div>`

  container.appendChild(div)
  container.scrollTop = container.scrollHeight
}

export function showTyping() {
  const container = document.getElementById('chat-messages')
  const div = document.createElement('div')
  div.className = 'message ai'
  div.innerHTML = `<div class="typing-indicator">
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  </div>`
  container.appendChild(div)
  container.scrollTop = container.scrollHeight
  return div
}

/* ---- Topic learning ---- */
function learnTopic(question) {
  const q = question.toLowerCase()
  for (const group of KEYWORD_GROUPS) {
    if (group.some(k => q.includes(k.toLowerCase()))) {
      const key = group[0]
      if (!learnedTopics.includes(key)) {
        learnedTopics.push(key)
        topicCount++
        document.getElementById('stat-t').textContent = topicCount
      }
      break
    }
  }
}

/* ---- Core send ---- */
export async function sendMessage() {
  const input  = document.getElementById('user-input')
  const text   = input.value.trim()
  if (!text) return

  if (!DEEPSEEK_KEY || DEEPSEEK_KEY === 'your_deepseek_key_here') {
    addMessage('ai', '⚠️ DeepSeek API Key belum dikonfigurasi. Masukkan key ke file `.env` (VITE_DEEPSEEK_KEY=sk-...) lalu restart dev server.')
    return
  }

  addMessage('user', text)
  input.value = ''
  input.style.height = 'auto'

  questionCount++
  document.getElementById('stat-q').textContent   = questionCount
  document.getElementById('msg-count').textContent = `${questionCount} pesan`

  conversationHistory.push({ role: 'user', content: text })

  const typingEl = showTyping()
  document.getElementById('send-btn').disabled = true

  try {
    const res = await fetch(DEEPSEEK_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          ...conversationHistory,
        ],
        max_tokens: 1200,
        temperature: 0.7,
      }),
    })

    const data = await res.json()
    if (data.error) throw new Error(data.error.message || 'API Error')

    const reply = data.choices[0].message.content
    conversationHistory.push({ role: 'assistant', content: reply })

    typingEl.remove()
    addMessage('ai', reply)
    learnTopic(text)

  } catch (err) {
    typingEl.remove()
    addMessage('ai', `❌ Error: ${err.message}\n\nPastikan VITE_DEEPSEEK_KEY di file .env valid (format: sk-...).`)
  }

  document.getElementById('send-btn').disabled = false
}

export function quickSend(text) {
  document.getElementById('user-input').value = text
  sendMessage()
}

export function clearSession() {
  learnedTopics       = []
  conversationHistory = []
  questionCount       = 0
  topicCount          = 0

  document.getElementById('stat-q').textContent    = '0'
  document.getElementById('stat-t').textContent    = '0'
  document.getElementById('msg-count').textContent  = '0 pesan'

  document.getElementById('chat-messages').innerHTML = `
    <div class="message ai">
      <div class="message-bubble">Sesi baru dimulai! Data market masih aktif. Apa yang ingin Anda analisis?</div>
      <div class="message-meta">TradeAI • Sekarang</div>
    </div>`
}
