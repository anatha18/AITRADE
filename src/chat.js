/* =============================================
   chat.js — Chat + History Management
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

/* ---- Chat Sessions (history) ---- */
let sessions = []         // Array of { id, title, messages, ts }
let currentSessionId = null

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function saveSessions() {
  try { localStorage.setItem('tradeai_sessions', JSON.stringify(sessions)) } catch(e) {}
}

function loadSessions() {
  try {
    const raw = localStorage.getItem('tradeai_sessions')
    if (raw) sessions = JSON.parse(raw)
  } catch(e) { sessions = [] }
}

export function initChatHistory() {
  loadSessions()
  renderSidebarHistory()

  // Start a fresh session on load
  startNewSession()
}

function startNewSession(title = 'Sesi Baru') {
  const id = generateId()
  const session = { id, title, messages: [], ts: Date.now() }
  sessions.unshift(session)
  currentSessionId = id
  saveSessions()

  // Reset state
  conversationHistory = []
  learnedTopics       = []
  questionCount       = 0
  topicCount          = 0

  updateStats()

  const container = document.getElementById('chat-messages')
  container.innerHTML = `
    <div class="message ai">
      <div class="message-bubble">
        Halo! Saya <strong style="color:var(--accent)">TradeAI</strong> — asisten trading berbasis DeepSeek.<br><br>
        Saya sudah terhubung ke data pasar real-time. Tanya apa saja tentang Gold, DXY, yield curve, strategi, atau analisis macro.
      </div>
      <div class="message-meta">TradeAI • Sekarang</div>
    </div>`

  renderSidebarHistory()
  setActiveSidebarItem(id)
}

function renderSidebarHistory() {
  const list = document.getElementById('history-list')
  if (!list) return

  if (sessions.length === 0) {
    list.innerHTML = `<div class="history-empty">Belum ada sesi</div>`
    return
  }

  list.innerHTML = sessions.map(s => `
    <div class="history-item ${s.id === currentSessionId ? 'active' : ''}" data-id="${s.id}">
      <div class="hi-icon">💬</div>
      <div class="hi-body">
        <div class="hi-title">${escapeHtml(s.title)}</div>
        <div class="hi-meta">${s.messages.length} pesan · ${timeAgo(s.ts)}</div>
      </div>
      <button class="hi-del" data-id="${s.id}" title="Hapus">×</button>
    </div>
  `).join('')

  list.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('hi-del')) return
      loadSession(el.dataset.id)
    })
  })

  list.querySelectorAll('.hi-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      deleteSession(btn.dataset.id)
    })
  })
}

function setActiveSidebarItem(id) {
  document.querySelectorAll('.history-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id)
  })
}

function loadSession(id) {
  const session = sessions.find(s => s.id === id)
  if (!session) return

  currentSessionId    = id
  conversationHistory = session.messages.map(m => ({ role: m.role, content: m.content }))
  learnedTopics       = []
  questionCount       = session.messages.filter(m => m.role === 'user').length
  topicCount          = 0
  updateStats()

  const container = document.getElementById('chat-messages')
  container.innerHTML = ''

  if (session.messages.length === 0) {
    container.innerHTML = `
      <div class="message ai">
        <div class="message-bubble">Sesi dimuat. Lanjutkan percakapan!</div>
        <div class="message-meta">TradeAI • Sekarang</div>
      </div>`
  } else {
    session.messages.forEach(m => {
      renderMessage(m.role === 'assistant' ? 'ai' : 'user', m.content, m.time)
    })
  }

  setActiveSidebarItem(id)
  container.scrollTop = container.scrollHeight
}

function deleteSession(id) {
  sessions = sessions.filter(s => s.id !== id)
  saveSessions()
  if (currentSessionId === id) {
    if (sessions.length > 0) {
      loadSession(sessions[0].id)
    } else {
      startNewSession()
    }
  } else {
    renderSidebarHistory()
  }
}

function saveMessageToSession(role, content, time) {
  const session = sessions.find(s => s.id === currentSessionId)
  if (!session) return
  session.messages.push({ role, content, time })
  // Update title from first user message
  if (role === 'user' && session.messages.filter(m => m.role === 'user').length === 1) {
    session.title = content.slice(0, 40) + (content.length > 40 ? '…' : '')
  }
  saveSessions()
  renderSidebarHistory()
  setActiveSidebarItem(currentSessionId)
}

/* ---- Helpers ---- */
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function timeAgo(ts) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Baru saja'
  if (m < 60) return `${m} mnt lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  return `${Math.floor(h / 24)} hari lalu`
}

function updateStats() {
  const qEl = document.getElementById('stat-q')
  const tEl = document.getElementById('stat-t')
  const mcEl = document.getElementById('msg-count')
  if (qEl)  qEl.textContent  = questionCount
  if (tEl)  tEl.textContent  = topicCount
  if (mcEl) mcEl.textContent = `${questionCount} pesan`
}

/* ---- Keywords for topic learning ---- */
const KEYWORD_GROUPS = [
  ['gold', 'XAU', 'emas'],
  ['DXY', 'dolar', 'dollar'],
  ['yield', 'US02Y', 'US10Y', 'obligasi'],
  ['Fed', 'FOMC', 'suku bunga'],
  ['Bitcoin', 'kripto', 'crypto'],
  ['support', 'resistance', 'level'],
  ['scalping', 'swing', 'position trading'],
  ['risk management', 'stop loss', 'take profit'],
  ['Elliott', 'fibonacci', 'wave'],
  ['moving average', 'RSI', 'MACD'],
  ['fundamental', 'NFP', 'CPI', 'inflasi'],
  ['forex', 'EUR', 'GBP', 'JPY'],
]

function buildSystemPrompt() {
  const snap   = getCurrentMarketSnapshot()
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

/* ---- DOM render helpers ---- */
function renderMessage(role, text, time) {
  const container = document.getElementById('chat-messages')
  const div = document.createElement('div')
  div.className = `message ${role}`

  const t = time || new Date().toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta', hour12: false, hour: '2-digit', minute: '2-digit',
  })

  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')

  div.innerHTML = `
    <div class="message-bubble">${html}</div>
    <div class="message-meta">${role === 'ai' ? 'TradeAI' : 'Anda'} • ${t}</div>`

  container.appendChild(div)
  container.scrollTop = container.scrollHeight
  return t
}

export function addMessage(role, text) {
  const time = renderMessage(role, text)
  saveMessageToSession(role === 'ai' ? 'assistant' : 'user', text, time)
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

function learnTopic(question) {
  const q = question.toLowerCase()
  for (const group of KEYWORD_GROUPS) {
    if (group.some(k => q.includes(k.toLowerCase()))) {
      const key = group[0]
      if (!learnedTopics.includes(key)) {
        learnedTopics.push(key)
        topicCount++
        const tEl = document.getElementById('stat-t')
        if (tEl) tEl.textContent = topicCount
      }
      break
    }
  }
}

/* ---- Core send ---- */
export async function sendMessage() {
  const input = document.getElementById('user-input')
  const text  = input.value.trim()
  if (!text) return

  if (!DEEPSEEK_KEY || DEEPSEEK_KEY === 'your_deepseek_key_here') {
    addMessage('ai', '⚠️ DeepSeek API Key belum dikonfigurasi. Masukkan key ke file `.env` (VITE_DEEPSEEK_KEY=sk-...) lalu restart dev server.')
    return
  }

  addMessage('user', text)
  input.value = ''
  input.style.height = 'auto'

  questionCount++
  updateStats()

  conversationHistory.push({ role: 'user', content: text })

  const typingEl = showTyping()
  const sendBtn  = document.getElementById('send-btn')
  if (sendBtn) sendBtn.disabled = true

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

  if (sendBtn) sendBtn.disabled = false
}

export function quickSend(text) {
  document.getElementById('user-input').value = text
  sendMessage()
}

export function clearSession() {
  startNewSession()
}

export { startNewSession }
