'use strict'

import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  jidNormalizedUser,
  delay
} = _require('socketon');

import fs from 'fs'
import path from 'path'
import pino from 'pino'
import QRCode from 'qrcode'
import { getRandomEmoji } from '../helper/emoji.js'
import { injectClient } from '../helper/inject.js'
import messageHandler from '../handler/message.js'
import JSONDB from '../db/json.js'
import { cleanStaleSessionFiles } from './cleaner.js'

/* ================= LOGGER ================= */
const silentLogger = pino({ level: 'silent' })

/* ================= KONSTANTA ================= */
const PAIRING_TIMEOUT_MS = 3 * 60 * 1000 // 3 menit

/* ================= STATE ================= */
const jadibotMap = new Map()
const pairingRequested = new Set()
const stoppingJadibot = new Set()
const pairingTimeout = new Map()
const pendingJadibotChoices = new Map()

/* ================= UTILS ================= */
function loadConfig() {
  try {
    const p = path.join(process.cwd(), 'config.json')
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {}
  return {}
}

function maskNumber(num) {
  const n = num.replace(/[^0-9]/g, '')
  if (n.length <= 6) return n
  return n.slice(0, 4) + '****' + n.slice(-4)
}

function isSessionValid(sessionDir) {
  return fs.existsSync(path.join(sessionDir, 'creds.json'))
}

function formatPairingCode(code) {
  // Format: XXXX-XXXX supaya lebih mudah dibaca
  const clean = String(code).replace(/[^A-Z0-9]/gi, '').toUpperCase()
  if (clean.length === 8) return clean.slice(0, 4) + '-' + clean.slice(4)
  return code
}

/* ================= PESAN RAPIH ================= */
function msgPairingCode(code, number) {
  const formatted = formatPairingCode(code)
  const masked = maskNumber(number)
  return (
    `╔══════════════════════╗\n` +
    `║   🤖  *J A D I B O T*   ║\n` +
    `╚══════════════════════╝\n\n` +
    `📱 *Nomor:* ${masked}\n\n` +
    `🔑 *Kode Pairing:*\n` +
    `┌─────────────────┐\n` +
    `│   *${formatted}*   │\n` +
    `└─────────────────┘\n\n` +
    `📋 *Cara Memasukkan Kode:*\n` +
    `1️⃣ Buka WhatsApp di HP kamu\n` +
    `2️⃣ Ketuk ⋮ (titik tiga) → *Perangkat Tertaut*\n` +
    `3️⃣ Ketuk *Tautkan Perangkat*\n` +
    `4️⃣ Pilih *Tautkan dengan nomor telepon*\n` +
    `5️⃣ Masukkan kode di atas\n\n` +
    `⏳ *Batas waktu: 3 menit*\n` +
    `⚠️ Jika gagal, ketik *.jadibot* ulang`
  )
}

function msgPairingExpired(number) {
  const masked = maskNumber(number)
  return (
    `╔══════════════════════╗\n` +
    `║   ⏰  *WAKTU HABIS*   ║\n` +
    `╚══════════════════════╝\n\n` +
    `📱 *Nomor:* ${masked}\n\n` +
    `❌ Kode pairing sudah *kedaluwarsa*\n` +
    `karena tidak digunakan dalam *3 menit*.\n\n` +
    `🔄 Sesi otomatis dihapus.\n` +
    `💡 Ketik *.jadibot ${number}* untuk coba lagi.`
  )
}

function msgConnected(number) {
  const masked = maskNumber(number)
  const now = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })

  const config = loadConfig()
  const story = config.autoReadStory || {}
  const storyOn = story.enabled !== false
  const reactOn = storyOn && story.autoReaction !== false

  let swStatus
  if (!storyOn) {
    swStatus = `❌ *AutoRead SW:* Nonaktif`
  } else if (reactOn) {
    swStatus = `✅ *AutoRead SW:* Aktif — Mode *Read + Reaction* 🎉`
  } else {
    swStatus = `✅ *AutoRead SW:* Aktif — Mode *Read Only* 👁️`
  }

  return (
    `╔══════════════════════╗\n` +
    `║  ✅  *JADIBOT AKTIF*  ║\n` +
    `╚══════════════════════╝\n\n` +
    `📱 *Nomor:* ${masked}\n` +
    `🕐 *Waktu:* ${now} WIB\n\n` +
    `🎉 Jadibot berhasil terhubung!\n` +
    `Bot sudah siap menerima perintah.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 *Status Fitur Otomatis:*\n` +
    `${swStatus}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🛠️ *Fitur Jadibot:*\n` +
    `• 👁️ Auto baca & reaction story/SW kontak\n` +
    `• 🔕 Anti-delete pesan (jika aktif)\n` +
    `• 🤖 Semua command bot bisa diakses\n` +
    `   _(hanya oleh owner via bot utama)_\n\n` +
    `📌 *Kontrol Jadibot (dari bot utama):*\n` +
    `• *.menu* — Lihat semua fitur\n` +
    `• *.readsw* — Kelola AutoRead SW\n` +
    `• *.stopjadibot ${number}* — Matikan jadibot\n` +
    `• *.listjadibot* — Daftar jadibot aktif\n\n` +
    `_Powered by Wily Bot_ 🤖`
  )
}

function msgLoggedOut(number, remainingList) {
  const masked = maskNumber(number)
  const now = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })

  let listPart
  if (remainingList.length === 0) {
    listPart = `❌ Tidak ada jadibot aktif saat ini.`
  } else {
    const items = remainingList.map((v, i) => `│ ${i + 1}. +${v}`).join('\n')
    listPart = (
      `📊 *Jadibot Masih Aktif (${remainingList.length}):*\n` +
      `┌─────────────────────\n` +
      `${items}\n` +
      `└─────────────────────`
    )
  }

  return (
    `╔══════════════════════╗\n` +
    `║  ⚠️  *JADIBOT LOGOUT*  ║\n` +
    `╚══════════════════════╝\n\n` +
    `📱 *Nomor:* ${masked}\n` +
    `🕐 *Waktu:* ${now} WIB\n\n` +
    `🚨 Jadibot ini telah *di-logout* dari\n` +
    `WhatsApp (Perangkat Tertaut dihapus).\n\n` +
    `🗑️ Sesi otomatis dihapus.\n\n` +
    `${listPart}\n\n` +
    `💡 Ketik *.jadibot ${number}* untuk\n` +
    `menghubungkan kembali.`
  )
}

/* ================= START JADIBOT ================= */
async function startJadibot(number, sendReply, mainBotNumber) {
  number = number.replace(/[^0-9]/g, '')
  const sessionDir = path.join(process.cwd(), 'jadibot', number)

  fs.mkdirSync(sessionDir, { recursive: true })

  // Bersihkan pre-key stale & session lama sebelum load
  cleanStaleSessionFiles(sessionDir)

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: silentLogger,
    printQRInTerminal: false
  })

  sock.isMainBot = false
  sock.mainBotNumber = mainBotNumber

  injectClient(
    sock,
    new Map(),
    new JSONDB('contacts', sessionDir),
    new JSONDB('groups', sessionDir),
    new JSONDB('settings', sessionDir)
  )

  sock.ev.on('creds.update', saveCreds)

  /* ================= CONNECTION ================= */
  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    const reason = lastDisconnect?.error?.output?.statusCode

    /* ===== PAIRING CODE — TIMEOUT 3 MENIT ===== */
    if (
      connection === 'connecting' &&
      !state.creds?.registered &&
      !pairingRequested.has(number)
    ) {
      pairingRequested.add(number)

      // Kirim kode pairing setelah koneksi stabil (dengan retry)
      setTimeout(async () => {
        let retries = 3
        while (retries > 0) {
          try {
            const code = await sock.requestPairingCode(number)
            await sendReply(msgPairingCode(code, number))
            break
          } catch (err) {
            retries--
            console.error(`[JADIBOT] Gagal request pairing code ${number} (sisa retry: ${retries}):`, err?.message)
            if (retries > 0) await delay(2000)
          }
        }
        if (retries === 0) {
          try {
            await sendReply(
              `╔══════════════════════╗\n` +
              `║   ❌  *GAGAL PAIRING*   ║\n` +
              `╚══════════════════════╝\n\n` +
              `⚠️ Gagal mendapatkan kode pairing untuk *${maskNumber(number)}*.\n` +
              `Koneksi terputus sebelum kode berhasil dibuat.\n\n` +
              `💡 Ketik *.jadibot ${number}* untuk coba lagi.`
            )
          } catch {}
        }
      }, 2000)

      // ⏱️ AUTO STOP setelah 3 MENIT jika belum terhubung
      const timeout = setTimeout(async () => {
        if (state.creds?.registered || jadibotMap.has(number)) return

        console.log(`[JADIBOT] ⏰ Pairing timeout 3 menit → ${number} → sesi dihapus`)

        pairingRequested.delete(number)
        pairingTimeout.delete(number)

        // Tutup socket
        try {
          sock.ev.removeAllListeners()
          if (sock.ws) sock.ws.close()
        } catch {}

        // Hapus sesi
        setTimeout(() => {
          if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true })
          }
        }, 500)

        // Kirim notif ke pengirim
        try {
          await sendReply(msgPairingExpired(number))
        } catch {}
      }, PAIRING_TIMEOUT_MS)

      pairingTimeout.set(number, timeout)
    }

    /* ===== CONNECTED ===== */
    if (connection === 'open') {
      jadibotMap.set(number, sock)
      pairingRequested.delete(number)

      if (pairingTimeout.has(number)) {
        clearTimeout(pairingTimeout.get(number))
        pairingTimeout.delete(number)
      }

      console.log(`[JADIBOT] ✅ ${number} CONNECTED`)

      // Kirim pesan sambutan rapih ke pengirim
      try {
        await sendReply(msgConnected(number))
      } catch {}
    }

    /* ===== DISCONNECTED ===== */
    if (connection === 'close') {
      if (pairingTimeout.has(number)) {
        clearTimeout(pairingTimeout.get(number))
        pairingTimeout.delete(number)
      }

      pairingRequested.delete(number)

      /* STOP MANUAL DARI BOT UTAMA */
      if (stoppingJadibot.has(number)) {
        stoppingJadibot.delete(number)
        jadibotMap.delete(number)
        console.log(`[JADIBOT] ${number} STOPPED BY MAIN BOT`)
        return
      }

      /* ===== LOGOUT PAKSA DARI WHATSAPP ===== */
      if (reason === DisconnectReason.loggedOut) {
        // Hapus dari map DULU baru ambil sisa list (agar nomor ini tidak muncul di list)
        jadibotMap.delete(number)

        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true })
        }

        console.log(`[JADIBOT] ⚠️ ${number} LOGOUT PAKSA → session dihapus`)

        // Kirim notif real-time ke owner beserta sisa list jadibot aktif
        const remainingList = [...jadibotMap.keys()]
        try {
          await sendReply(msgLoggedOut(number, remainingList))
        } catch (err) {
          console.error(`[JADIBOT] Gagal kirim notif logout ${number}:`, err?.message)
        }
        return
      }

      /* ===== SESSION SUDAH TIDAK ADA ===== */
      if (!isSessionValid(sessionDir)) {
        jadibotMap.delete(number)
        console.log(`[JADIBOT] ${number} session tidak ada, tidak restart`)
        return
      }

      /* ===== RECONNECT NORMAL ===== */
      console.log(`[JADIBOT] ${number} reconnecting...`)
      // Tutup socket lama DULU sebelum buat yang baru
      // agar WA tidak kick socket lama dengan alasan loggedOut
      // yang akan memicu penghapusan sesi secara salah
      try {
        sock.ev.removeAllListeners()
        if (sock.ws) sock.ws.close()
      } catch {}
      setTimeout(() => {
        startJadibot(number, sendReply, mainBotNumber)
      }, 3000)
    }
  })

  /* ================= MESSAGE ================= */
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      if (!msg.message) continue

      try {
        await messageHandler(
          { message: msg, type: 'notify' },
          sock
        )
      } catch (err) {
        console.error('[JADIBOT MESSAGE ERROR]', err)
      }
    }
  })
}

/* ================= START JADIBOT QR ================= */
async function startJadibotQR(number, sendReply, sendImage, mainBotNumber) {
  number = number.replace(/[^0-9]/g, '')
  const sessionDir = path.join(process.cwd(), 'jadibot', number)

  fs.mkdirSync(sessionDir, { recursive: true })
  cleanStaleSessionFiles(sessionDir)

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: silentLogger,
    printQRInTerminal: false
  })

  sock.isMainBot = false
  sock.mainBotNumber = mainBotNumber

  injectClient(
    sock,
    new Map(),
    new JSONDB('contacts', sessionDir),
    new JSONDB('groups', sessionDir),
    new JSONDB('settings', sessionDir)
  )

  sock.ev.on('creds.update', saveCreds)

  let qrSentCount = 0
  let hasConnected = false

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    const reason = lastDisconnect?.error?.output?.statusCode

    /* ===== KIRIM QR CODE ===== */
    if (qr) {
      qrSentCount++
      try {
        const qrBuffer = await QRCode.toBuffer(qr, { type: 'png', width: 512, margin: 2 })
        const caption =
          `╔══════════════════════╗\n` +
          `║   🤖  *J A D I B O T*  ║\n` +
          `╚══════════════════════╝\n\n` +
          `📱 *Nomor:* ${maskNumber(number)}\n` +
          `🔄 *QR ke-${qrSentCount}*\n\n` +
          `📋 *Cara Scan:*\n` +
          `1️⃣ Buka WhatsApp di HP kamu\n` +
          `2️⃣ Ketuk ⋮ (titik tiga) → *Perangkat Tertaut*\n` +
          `3️⃣ Ketuk *Tautkan Perangkat*\n` +
          `4️⃣ Scan QR di atas\n\n` +
          `⏳ QR berlaku ±60 detik\n` +
          `⚠️ Jika QR expired, QR baru akan dikirim otomatis`
        await sendImage(qrBuffer, caption)
        console.log(`[JADIBOT QR] QR ke-${qrSentCount} dikirim untuk ${number}`)
      } catch (err) {
        console.error(`[JADIBOT QR] Gagal kirim QR ${number}:`, err?.message)
      }
    }

    /* ===== CONNECTED ===== */
    if (connection === 'open') {
      hasConnected = true
      jadibotMap.set(number, sock)
      console.log(`[JADIBOT QR] ✅ ${number} CONNECTED via QR`)
      try {
        await sendReply(msgConnected(number))
      } catch {}
    }

    /* ===== DISCONNECTED ===== */
    if (connection === 'close') {
      if (stoppingJadibot.has(number)) {
        stoppingJadibot.delete(number)
        jadibotMap.delete(number)
        console.log(`[JADIBOT QR] ${number} STOPPED BY MAIN BOT`)
        return
      }

      if (reason === DisconnectReason.loggedOut) {
        jadibotMap.delete(number)
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true })
        }
        console.log(`[JADIBOT QR] ⚠️ ${number} LOGOUT PAKSA → session dihapus`)
        const remainingList = [...jadibotMap.keys()]
        try {
          await sendReply(msgLoggedOut(number, remainingList))
        } catch {}
        return
      }

      // Jika sudah pernah connect via QR, selalu coba reconnect
      // (creds.json mungkin belum tersimpan tepat waktu sebelum disconnect sesaat)
      if (hasConnected || isSessionValid(sessionDir)) {
        console.log(`[JADIBOT QR] ${number} reconnecting via QR...`)
        // Tutup socket lama DULU sebelum buat yang baru
        // agar WA tidak kick socket lama dengan alasan loggedOut
        // yang akan memicu penghapusan sesi secara salah
        try {
          sock.ev.removeAllListeners()
          if (sock.ws) sock.ws.close()
        } catch {}
        setTimeout(() => {
          startJadibotQR(number, sendReply, sendImage, mainBotNumber)
        }, 3000)
        return
      }

      jadibotMap.delete(number)
      console.log(`[JADIBOT QR] ${number} session tidak ada, tidak restart`)
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (!msg.message) continue
      try {
        await messageHandler({ message: msg, type: 'notify' }, sock)
      } catch (err) {
        console.error('[JADIBOT QR MESSAGE ERROR]', err)
      }
    }
  })
}

/* ================= STOP JADIBOT ================= */
async function stopJadibot(number, sendReply) {
  number = number.replace(/[^0-9]/g, '')
  const sock = jadibotMap.get(number)

  if (!sock) {
    return sendReply(
      `╔══════════════════════╗\n` +
      `║   ❌  *GAGAL STOP*   ║\n` +
      `╚══════════════════════╝\n\n` +
      `Jadibot *${maskNumber(number)}* tidak aktif atau sudah dihentikan.`
    )
  }

  const sessionDir = path.join(process.cwd(), 'jadibot', number)

  stoppingJadibot.add(number)

  try {
    sock.ev.removeAllListeners()
    if (sock.ws) sock.ws.close()
  } catch {}

  jadibotMap.delete(number)
  stoppingJadibot.delete(number)

  setTimeout(() => {
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true })
    }
  }, 500)

  sendReply(
    `╔══════════════════════╗\n` +
    `║  🛑  *JADIBOT STOP*  ║\n` +
    `╚══════════════════════╝\n\n` +
    `✅ Jadibot *${maskNumber(number)}* berhasil dihentikan.\n` +
    `🗑️ Sesi telah dihapus.\n\n` +
    `💡 Ketik *.jadibot ${number}* untuk aktifkan kembali.`
  )
}

/* ================= EXPORT ================= */
export {
  startJadibot,
  startJadibotQR,
  stopJadibot,
  jadibotMap,
  pendingJadibotChoices
}
