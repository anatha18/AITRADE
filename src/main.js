/* =============================================
   main.js — Entry point
   ============================================= */

import './style.css'
import { fetchAllMarketData } from './market.js'
import { sendMessage, quickSend, clearSession, initChatHistory, startNewSession } from './chat.js'

/* ---- Clock ---- */
function updateClock() {
  const el = document.getElementById('clock')
  if (el) el.textContent = new Date().toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta', hour12: false,
  })
}
setInterval(updateClock, 1000)
updateClock()

/* ---- Init chat history sidebar ---- */
initChatHistory()

/* ---- Market data fetch ---- */
fetchAllMarketData()
setInterval(fetchAllMarketData, 5 * 60 * 1000)

/* ---- Buttons ---- */
document.getElementById('refresh-btn')?.addEventListener('click', fetchAllMarketData)
document.getElementById('send-btn')?.addEventListener('click', sendMessage)
document.getElementById('clear-btn')?.addEventListener('click', clearSession)
document.getElementById('new-chat-btn')?.addEventListener('click', () => startNewSession())

/* ---- Sidebar toggle (collapse/expand on desktop, slide on mobile) ---- */
let sidebarOpen = true
document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
  const sidebar = document.querySelector('.chat-history-sidebar')
  if (window.innerWidth <= 700) {
    // Mobile: slide in/out
    sidebar?.classList.toggle('open')
  } else {
    // Desktop: collapse/expand
    sidebarOpen = !sidebarOpen
    sidebar?.classList.toggle('collapsed', !sidebarOpen)
  }
})

/* ---- Quick chips ---- */
document.querySelectorAll('.qchip').forEach(btn => {
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
    this.style.height = Math.min(this.scrollHeight, 110) + 'px'
  })
  userInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  })
}
