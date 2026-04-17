/* =============================================
   main.js — Entry point
   ============================================= */

import './style.css'
import { fetchAllMarketData } from './market.js'
import { sendMessage, quickSend, clearSession } from './chat.js'

/* ---- Clock ---- */
function updateClock() {
  const el = document.getElementById('clock')
  if (el) el.textContent = new Date().toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta', hour12: false,
  })
}
setInterval(updateClock, 1000)
updateClock()

/* ---- Initial market fetch + auto-refresh every 5 min ---- */
fetchAllMarketData()
setInterval(fetchAllMarketData, 5 * 60 * 1000)

/* ---- Manual refresh button ---- */
document.getElementById('refresh-btn')?.addEventListener('click', fetchAllMarketData)

/* ---- Send ---- */
document.getElementById('send-btn')?.addEventListener('click', sendMessage)

/* ---- Clear session ---- */
document.getElementById('clear-btn')?.addEventListener('click', clearSession)

/* ---- Quick chip buttons ---- */
document.querySelectorAll('.qchip').forEach(btn => {
  btn.addEventListener('click', () => {
    const q = btn.getAttribute('data-q')
    if (q) quickSend(q)
  })
})

/* ---- Textarea: auto-resize + Enter to send ---- */
const userInput = document.getElementById('user-input')
if (userInput) {
  userInput.addEventListener('input', function () {
    this.style.height = 'auto'
    this.style.height = Math.min(this.scrollHeight, 110) + 'px'
  })
  userInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  })
}
