/* =============================================
   chat.js — DeepSeek AI Chat Logic
   ============================================= */

const DEEPSEEK_API = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = 'deepseek-chat'
const SESSION_KEY = 'tradeai_dskey'

/* ---- State ---- */
let conversationHistory = []
let learnedTopics       = []
let questionCount       = 0
let topicCount          = 0

/* ---- Keyword groups for topic learning ---- */
const KEYWORD_GROUPS = [
  ['gold',         'XAU',       'emas'],
  ['DXY',          'dolar',     'dollar'],
  ['yield',        'US02Y',     'US10Y',       'obligasi'],
  ['Fed',          'FOMC',      'suku bunga'],
  ['Bitcoin',      'kripto',    'crypto'],
  ['support',      'resistance','level'],
  ['scalping',     'swing trading', 'position'],
  ['risk management','stop loss','take profit'],
  ['Elliott',      'wave',      'fibonacci'],
  ['moving average','RSI',      'MACD'],
  ['fundamental',  'NFP',       'CPI',         'inflasi'],
  ['forex',        'EUR',       'GBP',         'JPY'],
]

/* ---- Helpers ---- */
function getApiKey() {
  return document.getElementById('api-key').value.trim()
}

function getCurrentMarketContext() {
  return `
DXY: ${document.getElementById('dxy-val').textContent}
US02Y: ${document.getElementById('us02y-val').textContent}
US10Y: ${document.getElementById('us10y-val').textContent}
Gold (XAU/USD): ${document.getElementById('gold-val').textContent}
Gold Signal: ${document.getElementById('gold-badge').textContent}
`
}

function buildSystemPrompt() {
  const memoryContext = learnedTopics.length > 0
    ? `\n\nTopik yang telah dipelajari dari pengguna ini:\n${learnedTopics.map(t => `- ${t}`).join('\n')}`
    : ''

  return `Kamu adalah AI Trading Assistant profesional yang fokus pada analisis pasar keuangan, khususnya Gold (XAU/USD), Forex, dan instrumen derivatif. Kamu berbicara dalam Bahasa Indonesia dengan gaya yang profesional namun mudah dipahami.

Data pasar saat ini:
${getCurrentMarketContext()}

Kemampuan utamamu:
1. Analisis DXY, US02Y, US10Y dan dampaknya terhadap Gold
2. Technical & fundamental analysis
3. Risk management dan money management
4. Strategi trading (scalping, swing, position trading)
5. Interpretasi yield curve dan kebijakan Fed
6. Analisis korelasi antar aset

Instruksi penting:
- Selalu berikan analisis berdasarkan data pasar terkini yang diberikan
- Ingat preferensi dan topik yang sudah didiskusikan dengan pengguna
- Tambahkan disclaimer bahwa ini bukan saran keuangan jika membahas rekomendasi spesifik
- Jawab dengan concise tapi informatif, gunakan struktur yang jelas
- Jika ada topik baru yang penting, ekstrak dan simpan sebagai insight${memoryContext}`
}

/* ---- DOM Helpers ---- */
export function addMessage(role, text) {
  const container = document.getElementById('chat-messages')
  const div       = document.createElement('div')
  div.className   = `message ${role}`

  const time = new Date().toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })

  div.innerHTML = `
    <div class="message-bubble">${text.replace(/\n/g, '<br>')}</div>
    <div class="message-meta">${role === 'ai' ? 'TradeAI' : 'Anda'} • ${time}</div>`

  container.appendChild(div)
  container.scrollTop = container.scrollHeight
}

export function showTyping() {
  const container = document.getElementById('chat-messages')
  const div       = document.createElement('div')
  div.className   = 'message ai'
  div.innerHTML   = `<div class="typing-indicator">
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  </div>`
  container.appendChild(div)
  container.scrollTop = container.scrollHeight
  return div
}

/* ---- Topic Learning ---- */
function learnTopic(question) {
  const q = question.toLowerCase()
  for (const group of KEYWORD_GROUPS) {
    const matched = group[0]
    if (group.some(k => q.includes(k.toLowerCase()))) {
      if (!learnedTopics.includes(matched)) {
        learnedTopics.push(matched)
        topicCount++
        document.getElementById('stat-t').textContent = topicCount
        updateMemoryUI()
      }
      break
    }
  }
}

function updateMemoryUI() {
  const list = document.getElementById('memory-list')
  if (learnedTopics.length === 0) {
    list.innerHTML = '<div class="memory-empty">Belum ada topik yang dipelajari.</div>'
    document.getElementById('mem-count').textContent = '0 topik tersimpan'
    return
  }

  list.innerHTML = learnedTopics
    .slice(-6)
    .map(
      t => `<div class="memory-item" data-topic="${t}">
              <div class="memory-dot"></div>
              <span>${t}</span>
            </div>`
    )
    .join('')

  // Attach click handlers for memory items
  list.querySelectorAll('.memory-item').forEach(el => {
    el.addEventListener('click', () => {
      const topic = el.dataset.topic
      quickSend(`Ceritakan lebih lanjut tentang ${topic} dalam konteks trading`)
    })
  })

  document.getElementById('mem-count').textContent = `${learnedTopics.length} topik tersimpan`
}

/* ---- Core Send ---- */
export async function sendMessage() {
  const input  = document.getElementById('user-input')
  const apiKey = getApiKey()
  const text   = input.value.trim()

  if (!text) return
  if (!apiKey) {
    addMessage('ai', '⚠️ Mohon masukkan DeepSeek API Key terlebih dahulu di kolom di atas.')
    return
  }

  addMessage('user', text)
  input.value = ''
  input.style.height = 'auto'

  questionCount++
  document.getElementById('stat-q').textContent  = questionCount
  document.getElementById('msg-count').textContent = `${questionCount} pesan`

  conversationHistory.push({ role: 'user', content: text })

  const typingEl = showTyping()
  const sendBtn  = document.getElementById('send-btn')
  sendBtn.disabled = true

  try {
    const response = await fetch(DEEPSEEK_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
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

    const data = await response.json()

    if (data.error) throw new Error(data.error.message || 'API Error')

    const reply = data.choices[0].message.content
    conversationHistory.push({ role: 'assistant', content: reply })

    typingEl.remove()
    addMessage('ai', reply)
    learnTopic(text)
  } catch (err) {
    typingEl.remove()
    addMessage(
      'ai',
      `❌ Error: ${err.message}\n\nPastikan API Key DeepSeek valid dan format: sk-...`
    )
  }

  sendBtn.disabled = false
}

export function quickSend(text) {
  document.getElementById('user-input').value = text
  sendMessage()
}

export function clearMemory() {
  learnedTopics       = []
  conversationHistory = []
  questionCount       = 0
  topicCount          = 0

  document.getElementById('stat-q').textContent   = '0'
  document.getElementById('stat-t').textContent   = '0'
  document.getElementById('msg-count').textContent = '0 pesan'
  updateMemoryUI()

  document.getElementById('chat-messages').innerHTML = `
    <div class="message ai">
      <div class="message-bubble">Memory telah dihapus. Saya siap memulai sesi baru! Apa yang ingin Anda diskusikan?</div>
      <div class="message-meta">TradeAI • Sekarang</div>
    </div>`
}

/* ---- Persist API key in sessionStorage ---- */
export function initApiKeyPersistence() {
  const keyInput = document.getElementById('api-key')
  const saved    = sessionStorage.getItem(SESSION_KEY)
  if (saved) keyInput.value = saved

  keyInput.addEventListener('change', () => {
    sessionStorage.setItem(SESSION_KEY, keyInput.value)
  })
}
