/* =============================================
   main.js — Entry point, wires all modules
   ============================================= */

import './style.css'
import { drawAllSparklines, simulateUpdate } from './market.js'
import { sendMessage, quickSend, clearMemory, addMessage, initApiKeyPersistence } from './chat.js'

/* ---- Clock ---- */
function updateClock() {
  const el = document.getElementById('clock')
  if (!el) return
  el.textContent = new Date().toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour12: false,
  })
}
setInterval(updateClock, 1000)
updateClock()

/* ---- Init last-update timestamp ---- */
function setLastUpdate() {
  const el = document.getElementById('last-update')
  if (el) {
    el.textContent = new Date().toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour12: false,
    })
  }
}
setLastUpdate()

/* ---- Sparklines ---- */
drawAllSparklines()

/* ---- Refresh button ---- */
document.getElementById('refresh-btn')?.addEventListener('click', simulateUpdate)

/* ---- Send button ---- */
document.getElementById('send-btn')?.addEventListener('click', sendMessage)

/* ---- Clear memory button ---- */
document.getElementById('clear-btn')?.addEventListener('click', clearMemory)

/* ---- Quick question buttons ---- */
document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const q = btn.getAttribute('data-q')
    if (q) quickSend(q)
  })
})

/* ---- Textarea auto-resize + Enter to send ---- */
const userInput = document.getElementById('user-input')
if (userInput) {
  userInput.addEventListener('input', function () {
    this.style.height = 'auto'
    this.style.height = Math.min(this.scrollHeight, 120) + 'px'
  })

  userInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  })
}

/* ---- Persist API key ---- */
initApiKeyPersistence()
