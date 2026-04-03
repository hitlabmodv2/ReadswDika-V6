/**
 * ═══════════════════════════════════════════════════════════════
 *  Base Script    : Bang Dika Ardnt
 *  Recode By      : Bang Wilykun
 *  WhatsApp       : 6289688206739
 *  Telegram       : @Wilykun1994
 * ═══════════════════════════════════════════════════════════════
 *  Script ini GRATIS, tidak untuk diperjualbelikan!
 *  Jika ketahuan menjual script ini = NO UPDATE / NO FIX
 *  Hargai kerja keras developer, gunakan dengan bijak!
 * ═══════════════════════════════════════════════════════════════
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import makeWASocket, {
        delay,
        useMultiFileAuthState,
        DisconnectReason,
        Browsers,
        makeCacheableSignalKeyStore,
        areJidsSameUser,
        isLidUser,
        fetchLatestBaileysVersion,
        jidNormalizedUser,
        jidDecode,
        downloadMediaMessage,
        getContentType,
} from 'baileys';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';

import JSONDB from './src/db/json.js';
import { initBotStats } from './src/db/botStats.js';
import { injectClient } from './src/helper/inject.js';
import { getCaseName, loadConfig } from './src/helper/utils.js';
import { MemoryMonitor } from './src/helper/memoryMonitor.js';
import { getPhoneRegion, formatPhoneWithRegion } from './src/helper/phoneRegion.js';
import { ensureTmpDir, startAutoCleaner } from './src/helper/cleaner.js'; // ini baru
import { startJadibot, jadibotMap } from './src/helper/jadibot.js';
import { saveViewOnceCache, cleanOldViewOnceCache, hasViewOnceCache } from './src/helper/voCache.js';
// ini baru - yg bawah pindah ke sini
import { setupCrashGuard } from './src/helper/crashGuard.js';
import { initHotReload, getHandler, stopHotReload } from './src/helper/hotReload.js';

/* ================= VOONCE AUTO-SAVE ================= */
async function autoSaveViewOnce(message, hisoka) {
        const msg = message.message
        if (!msg) return

        let targetMsg = msg
        let isVO = false

        if (targetMsg.ephemeralMessage?.message) targetMsg = targetMsg.ephemeralMessage.message

        if (targetMsg.viewOnceMessage?.message) { targetMsg = targetMsg.viewOnceMessage.message; isVO = true }
        else if (targetMsg.viewOnceMessageV2?.message) { targetMsg = targetMsg.viewOnceMessageV2.message; isVO = true }
        else if (targetMsg.viewOnceMessageV2Extension?.message) { targetMsg = targetMsg.viewOnceMessageV2Extension.message; isVO = true }

        if (!isVO) return

        const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage']
        const mediaType = getContentType(targetMsg)
        if (!mediaTypes.includes(mediaType)) return

        const msgId = message.key.id
        if (hasViewOnceCache(msgId)) return

        try {
                console.log(`\x1b[36m[VOCache]\x1b[0m Mencoba simpan view once: ${msgId} (${mediaType})`)
                const buffer = await downloadMediaMessage(
                        { ...message, message: targetMsg },
                        'buffer',
                        {},
                        { logger: hisoka.logger, reuploadRequest: hisoka.updateMediaMessage }
                )
                const content = targetMsg[mediaType]
                saveViewOnceCache(msgId, buffer, {
                        mediaType,
                        mimetype: content?.mimetype || '',
                        caption: content?.caption || '',
                        ptt: content?.ptt || false,
                        fileName: content?.fileName || '',
                        senderName: message.pushName || '',
                        from: message.key.remoteJid || '',
                })
        } catch (err) {
                console.error(`\x1b[31m[VOCache] Gagal simpan ${msgId}:\x1b[0m`, err.message)
        }
}

/* ================= JADIBOT GLOBAL STATE ================= */
global.autoStartedJadibot = new Set();

function isJadibotSessionValid(number) {
  const dir = path.join(process.cwd(), 'jadibot', number);
  return fs.existsSync(path.join(dir, 'creds.json'));
}

if (!process.env.BOT_SESSION_NAME) process.env.BOT_SESSION_NAME = 'default';
if (!process.env.BOT_NUMBER_OWNER) process.env.BOT_NUMBER_OWNER = '1';

const botStats = initBotStats();

const sessionDir = (global.sessionDir = path.join(process.cwd(), 'sessions', process.env.BOT_SESSION_NAME));

if (process.env.BOT_MAX_RETRIES && isNaN(Number(process.env.BOT_MAX_RETRIES))) {
        console.warn('\x1b[33mWarning: BOT_MAX_RETRIES is not a valid number. Disabling max retry limit.\x1b[39m');
        delete process.env.BOT_MAX_RETRIES;
}

const logger = pino({ 
        level: process.env.BOT_LOGGER_LEVEL || 'silent',
        hooks: {
                logMethod(inputArgs, method) {
                        const msg = inputArgs[0];
                        if (typeof msg === 'string' && (msg.includes('Closing session') || msg.includes('SessionEntry'))) {
                                return;
                        }
                        return method.apply(this, inputArgs);
                }
        }
}).child({ class: 'Aja Sendiri' });

const silentLogger = pino({ level: 'silent' });

const filterLogs = (message) => {
        if (typeof message !== 'string') return false;
        const blockedPatterns = [
                'Closing stale open session',
                'Closing session:',
                'Closing session',
                'SessionEntry',
                'prekey bundle',
                'Closing open session',
                '_chains',
                'registrationId',
                'currentRatchet',
                'pendingPreKey',
                'baseKey:',
                'ephemeralKeyPair',
                'lastRemoteEphemeralKey',
                'indexInfo',
                'baseKeyType',
                'Failed to decrypt message',
                'Decrypted message with closed session',
                'Session error',
                'Bad MAC',
                'libsignal/src/crypto.js',
                'libsignal/src/session_cipher.js',
                'verifyMAC',
                'doDecryptWhisperMessage',
                'decryptWithSessions',
                'Message absent from node',
                'chainKey',
                'chainType',
                'messageKeys',
                'previousCounter',
                'rootKey',
                'pubKey',
                'privKey',
                'remoteIdentityKey',
                '<Buffer',
                'Buffer ',
                'signedKeyId',
                'preKeyId',
                'closed:',
                'used:',
                'created:'
        ];
        return blockedPatterns.some(pattern => message.includes(pattern));
};

const isSessionObject = (obj) => {
        if (!obj || typeof obj !== 'object') return false;
        return obj._chains || obj.registrationId || obj.currentRatchet || 
                   obj.indexInfo || obj.pendingPreKey || obj.ephemeralKeyPair ||
                   obj.chainKey || obj.pubKey || obj.privKey || obj.rootKey ||
                   obj.baseKey || obj.signedKeyId || obj.preKeyId;
};

const originalConsoleLog = console.log;
console.log = (...args) => {
        for (const arg of args) {
                if (typeof arg === 'string' && filterLogs(arg)) return;
                if (isSessionObject(arg)) return;
        }
        
        try {
                const fullMessage = args.map(a => {
                        if (typeof a === 'string') return a;
                        if (typeof a === 'object' && a !== null) {
                                const str = JSON.stringify(a);
                                if (str && filterLogs(str)) return '__BLOCKED__';
                                return str;
                        }
                        return String(a);
                }).join(' ');
                
                if (fullMessage.includes('__BLOCKED__') || filterLogs(fullMessage)) return;
        } catch (e) {
                // If stringify fails, check object properties directly
                for (const arg of args) {
                        if (isSessionObject(arg)) return;
                }
        }
        
        originalConsoleLog.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = (...args) => {
        const msg = args[0];
        if (typeof msg === 'string' && filterLogs(msg)) return;
        originalConsoleWarn.apply(console, args);
};

const originalConsoleError = console.error;
console.error = (...args) => {
        const msg = args[0];
        if (typeof msg === 'string' && filterLogs(msg)) return;
        originalConsoleError.apply(console, args);
};

const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, encoding, callback) => {
        if (typeof chunk === 'string') {
                if (filterLogs(chunk)) return true;
                if (chunk.includes('SessionEntry {') || chunk.includes('_chains:') || 
                    chunk.includes('registrationId:') || chunk.includes('currentRatchet:') ||
                    chunk.includes('ephemeralKeyPair:') || chunk.includes('indexInfo:') ||
                    chunk.includes('<Buffer')) return true;
        }
        return originalStdoutWrite(chunk, encoding, callback);
};

const originalStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = (chunk, encoding, callback) => {
        if (typeof chunk === 'string') {
                if (filterLogs(chunk)) return true;
                if (chunk.includes('SessionEntry {') || chunk.includes('_chains:') || 
                    chunk.includes('registrationId:') || chunk.includes('currentRatchet:') ||
                    chunk.includes('ephemeralKeyPair:') || chunk.includes('indexInfo:') ||
                    chunk.includes('<Buffer')) return true;
        }
        return originalStderrWrite(chunk, encoding, callback);
};

let reconnectCount = 0;
let memoryMonitor = null;

async function main() {
        console.log(`\x1b[36mStarting with session directory: ${sessionDir}\x1b[39m`);

        await initHotReload();

        if (memoryMonitor) {
                memoryMonitor.stop();
        }
        memoryMonitor = new MemoryMonitor({
                // ini baru
                onLimitReached: async () => {
                        console.log('Restarting cleanly...');
                if (global.hisokaClient) {
                        try {
                                global.hisokaClient.ev.removeAllListeners();
                                global.hisokaClient.ws?.close();
                        } catch {}
                }
                        process.exit(1);
                }
        }); // sampe sini
        memoryMonitor.start();
        global.memoryMonitor = memoryMonitor;

        if (reconnectCount > 0) {
                console.warn(`\x1b[33mReconnecting... Attempt ${reconnectCount}\x1b[39m`);
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version, isLatest } = await fetchLatestBaileysVersion();

        console.info(
                `\x1b[32mUsing WhatsApp version: ${version.join('.')}${
                        isLatest ? '' : ' (latest version is recommended)'
                }\x1b[39m`
        );

        const cacheMsg = new Map();
        // ini tambahan
        const MAX_CACHE_SIZE = 200;
        if (global.cacheCleaner) clearInterval(global.cacheCleaner);

                global.cacheCleaner = setInterval(() => {
        if (cacheMsg.size > MAX_CACHE_SIZE) {
                cacheMsg.clear();
                console.log('[CACHE] Message cache cleared');
                }
        }, 60000); // sampe sini
        const groups = new JSONDB('groups', sessionDir);
        const contacts = new JSONDB('contacts', sessionDir);
        const settings = new JSONDB('settings', sessionDir);

        const config = loadConfig();
        const autoOnlineConfig = config.autoOnline || {};
        
        const hisoka = injectClient(
                makeWASocket({
                        version,
                        logger,
                        auth: {
                                creds: state.creds,
                                keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
                        },
                        browser: Browsers.macOS('Chrome'), // ini baru
                        generateHighQualityLinkPreview: true,
                        syncFullHistory: true, // ini bisa true false
                        keepAliveIntervalMs: 30000, // ini baru
                        retryRequestDelayMs: 2000, // ini opsional
                        markOnlineOnConnect: autoOnlineConfig.enabled !== false,
                        cachedGroupMetadata: async jid => {
                                const group = groups.read(jid);
                                if (!group || !group.participants.length) {
                                        const metadata = await hisoka.groupMetadata(jid);
                                        groups.write(jid, metadata);
                                        return metadata;
                                }
                                return group;
                        },
                        getMessage: async key => {
                                const msg = cacheMsg.get(key.id);
                                return msg?.message || '';
                        },
                }),
                cacheMsg,
                contacts,
                groups,
                settings
        );
                hisoka.isMainBot = true;
                hisoka.botNumber = null;

        const pairingNumber = process.env.BOT_NUMBER_PAIR || false;
        if (pairingNumber && !hisoka.authState.creds?.registered) {
                try {
                        let phoneNumber = pairingNumber.replace(/[^0-9]/g, '');
                        await delay(3000);
                        let code = await hisoka.requestPairingCode(phoneNumber);
                        const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;

                        const phoneInfo = formatPhoneWithRegion(phoneNumber);

                        const cyan = '\x1b[36m';
                        const yellow = '\x1b[33m';
                        const green = '\x1b[32m';
                        const white = '\x1b[37m';
                        const magenta = '\x1b[35m';
                        const bold = '\x1b[1m';
                        const dim = '\x1b[2m';
                        const reset = '\x1b[0m';
                        
                        console.log('');
                        console.log(`${cyan}────────────────────────────────${reset}`);
                        console.log(`${bold}${green}🤖 WHATSAPP BOT PAIRING 2025${reset}`);
                        console.log(`${cyan}────────────────────────────────${reset}`);
                        console.log('');
                        console.log(`${white}📌 Kode Pairing: ${bold}${green}${formattedCode}${reset}`);
                        console.log('');
                        console.log(`${cyan}────────────────────────────────${reset}`);
                        console.log(`${bold}${magenta}📱 INFO NOMOR${reset}`);
                        console.log(`${cyan}────────────────────────────────${reset}`);
                        console.log(`${phoneInfo.flag} ${white}Negara : ${bold}${green}${phoneInfo.region}${reset}`);
                        console.log(`${yellow}📞${reset} ${white}Kode   : ${bold}${yellow}${phoneInfo.countryCode}${reset}`);
                        console.log(`${cyan}📱${reset} ${white}Nomor  : ${bold}${cyan}${phoneInfo.formatted}${reset}`);
                        console.log('');
                        console.log(`${cyan}────────────────────────────────${reset}`);
                        console.log(`${bold}${yellow}📋 CARA PAIRING${reset}`);
                        console.log(`${cyan}────────────────────────────────${reset}`);
                        console.log('');
                        console.log(`${green}1.${reset} Buka ${bold}${green}WhatsApp${reset} di HP`);
                        console.log(`${green}2.${reset} Ketuk ${bold}${yellow}⋮${reset} (titik 3) kanan atas`);
                        console.log(`${green}3.${reset} Pilih ${bold}${yellow}Perangkat Tertaut${reset}`);
                        console.log(`${green}4.${reset} Ketuk ${bold}${yellow}Tautkan Perangkat${reset}`);
                        console.log(`${green}5.${reset} Ketuk ${bold}${cyan}Tautkan dgn nomor telepon${reset}`);
                        console.log(`${green}6.${reset} Masukkan: ${bold}${green}${formattedCode.replace(/-/g, '')}${reset}`);
                        console.log('');
                        console.log(`${cyan}────────────────────────────────${reset}`);
                        console.log(`${bold}${magenta}💡 TIPS${reset}`);
                        console.log(`${cyan}────────────────────────────────${reset}`);
                        console.log(`${dim}•${reset} Pastikan HP online`);
                        console.log(`${dim}•${reset} Kode berlaku ${yellow}60 detik${reset}`);
                        console.log(`${dim}•${reset} Restart bot jika expired`);
                        console.log('');
                        console.log(`${cyan}────────────────────────────────${reset}`);
                        console.log(`${bold}${green}✅ KODE BERHASIL DIBUAT!${reset}`);
                        console.log(`${yellow}⏳ Menunggu konfirmasi WA...${reset}`);
                        console.log(`${cyan}────────────────────────────────${reset}`);
                        console.log('');
                } catch {
                        console.error('\x1b[31mFailed to request pairing code. Please check your pairing number.\x1b[39m');
                        process.exit(1);
                }
        }

        hisoka.ev.on('creds.update', saveCreds);

        hisoka.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
                if (qr && !pairingNumber) {
                        qrcode.generate(qr, { small: true }, code => {
                                console.log('\x1b[36mScan this QR code to connect:\x1b[39m\n');
                                console.log(code);
                        });
                }

                if (connection === 'open') {
                        lastDisconnect = 0;
                        reconnectCount = 0;
                        console.log(`\x1b[32mConnected successfully! ${JSON.stringify(hisoka.user, null, 2)}\x1b[39m`);

                        console.info('\x1b[36mFetching privacy settings...\x1b[39m');
                        const privacySettings = await hisoka.fetchPrivacySettings();
                        settings.write('privacy', privacySettings);

                        console.info('\x1b[36mLoading command handlers...\x1b[39m');
                        const commands = await getCaseName(path.join(process.cwd(), 'src', 'handler', 'message.js'));
                        hisoka.loadedCommands = commands;
                        console.info(`\x1b[32mLoaded ${commands.length} command handlers.\x1b[39m`);

                        const startAutoOnline = () => {
                        const config = loadConfig();
                        const autoOnline = config.autoOnline || {};

                                if (global.autoOnlineInterval) {
                                        clearInterval(global.autoOnlineInterval);
                                        global.autoOnlineInterval = null;
                                }

                                const intervalMs = (autoOnline.intervalSeconds || 30) * 1000;

                                if (autoOnline.enabled) {
                                        hisoka.sendPresenceUpdate('available');

                                        global.autoOnlineInterval = setInterval(() => {
                                        hisoka.sendPresenceUpdate('available');

                                for (const sock of jadibotMap.values()) {
                                        try {
                                if (sock?.user) {
                                        sock.sendPresenceUpdate('available');
                                        }
                                } catch {}
                        }

                }, intervalMs);
                                        console.log(`\x1b[32m[AutoOnline]\x1b[39m Started - Mode: ONLINE`);
                                } else {
                                        hisoka.sendPresenceUpdate('unavailable');

                                        global.autoOnlineInterval = setInterval(() => {
                                        hisoka.sendPresenceUpdate('unavailable');

                                for (const sock of jadibotMap.values()) {
                                        try {
                                if (sock?.user) {
                                        sock.sendPresenceUpdate('unavailable');
                                        }
                                } catch {}
                        }

                }, intervalMs);
                                        console.log(`\x1b[33m[AutoOffline]\x1b[39m Started - Mode: OFFLINE`);
                                }
                        };

                        startAutoOnline();
                        global.startAutoOnline = startAutoOnline;
                        global.hisokaClient = hisoka;

                        ensureTmpDir();
                        startAutoCleaner(6); // ini tambahan
                        cleanOldViewOnceCache(); // hapus cache vo lama (>7 hari)
                        
                        /* ===================== AUTO START SEMUA JADIBOT (STABIL) ===================== */
const jadibotDir = path.join(process.cwd(), 'jadibot');

setTimeout(() => {
  if (!fs.existsSync(jadibotDir)) {
    console.log('[JADIBOT] Folder jadibot tidak ditemukan');
    return;
  }

  const bots = fs.readdirSync(jadibotDir).filter(name => {
    const fullPath = path.join(jadibotDir, name);
    return fs.statSync(fullPath).isDirectory() && /^\d+$/.test(name);
  });

  if (!bots.length) {
    console.log('[JADIBOT] Tidak ada jadibot tersimpan');
    return;
  }

  console.log(`[JADIBOT] Auto starting ${bots.length} jadibot`);

  for (const number of bots) {
    if (global.autoStartedJadibot.has(number)) continue;
    global.autoStartedJadibot.add(number);

    if (!isJadibotSessionValid(number)) {
      console.log(`[JADIBOT] Skip ${number} (session tidak valid)`);
      continue;
    }

    console.log(`[JADIBOT] Starting jadibot ${number}`);
    startJadibot(
      number,
      () => {},
      hisoka.user.id.split(':')[0].split('@')[0]
    );
  }
}, 3000); // delay agar socket utama stabil
}

                if (connection === 'close') {
                        if (global.autoOnlineInterval) {
                                clearInterval(global.autoOnlineInterval);
                                global.autoOnlineInterval = null;
                                console.log(`\x1b[33m[AutoOnline]\x1b[39m Cleared on disconnect`);
                        }

                        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode || 0;

                        switch (statusCode) {
                                case DisconnectReason.loggedOut:
                                case DisconnectReason.forbidden:
                                        console.error('\x1b[31mSession expired or logged out. Please re-authenticate.\x1b[39m');
                                        const dirContents = await fs.promises.readdir(sessionDir);
                                        for (const file of dirContents) {
                                                if (file.startsWith('.env')) continue;
                                                await fs.promises.rm(path.join(sessionDir, file), { recursive: true, force: true });
                                        }
                                        process.exit(1);
                                        break;

                                case DisconnectReason.restartRequired:
                                        console.info('\x1b[33mRestart required. Reconnecting...\x1b[39m');
                                        // ini baru
                                        if (global.hisokaClient) {
                                               try {
                                                      global.hisokaClient.ev.removeAllListeners(); // hapus semua event lama
                                                      global.hisokaClient.ws?.close(); // tutup koneksi lama
                                               } catch {}
                                        }
                                        await main(); // sampe sini
                                        break;

                                case 408:
                                        if (hisoka.authState.creds?.registered) {
                                                console.info('\x1b[33mConnection timeout. Reconnecting...\x1b[39m');
                                                await delay(3000);
                                        } else {
                                                reconnectCount++;
                                                console.info(`\x1b[33mPairing timeout. Reconnecting in ${Math.min(5 * reconnectCount, 60)}s... (Attempt ${reconnectCount})\x1b[39m`);
                                                await delay(Math.min(5 * reconnectCount, 60) * 1000);
                                        }
                                        if (global.hisokaClient) {
                                               try {
                                                      global.hisokaClient.ev.removeAllListeners();
                                                      global.hisokaClient.ws?.close();
                                               } catch {}
                                        }
                                        await main();
                                        break;

                                default:
                                        reconnectCount++;
                                        const waitSec = Math.min(5 * reconnectCount, 60);
                                        console.error(`\x1b[31mConnection closed unexpectedly. Reconnecting in ${waitSec}s... (Attempt ${reconnectCount})\x1b[39m`);
                                        await delay(waitSec * 1000);
                                        if (global.hisokaClient) {
                                               try {
                                                      global.hisokaClient.ev.removeAllListeners();
                                                      global.hisokaClient.ws?.close();
                                               } catch {}
                                        }
                                        await main();
                                        break;
                        }
                }
        });

        hisoka.ev.on('contacts.upsert', async contactsData => {
                try {
                        await Promise.all(
                                contactsData.map(async contact => {
                                        try {
                                                const jid = await hisoka.resolveLidToPN({ remoteJid: contact.id, remoteJidAlt: contact.phoneNumber });
                                                const existingContact = (await contacts.read(jid)) || {};
                                                contacts.write(
                                                        jid,
                                                        Object.assign(
                                                                isLidUser(contact.id) ? { id: jid, lid: contact.id } : {},
                                                                { isContact: true },
                                                                existingContact,
                                                                contact
                                                        )
                                                );
                                        } catch (_) {}
                                })
                        );
                } catch (err) { console.error('[contacts.upsert]', err?.message); }
        });

        hisoka.ev.on('contacts.update', async contactsData => {
                try {
                        await Promise.all(
                                contactsData.map(async contact => {
                                        try {
                                                const jid = await hisoka.resolveLidToPN({ remoteJid: contact.id, remoteJidAlt: contact.phoneNumber });
                                                const existingContact = (await contacts.read(jid)) || {};
                                                contacts.write(
                                                        jid,
                                                        Object.assign(isLidUser(contact.id) ? { id: jid, lid: contact.id } : {}, existingContact, contact)
                                                );
                                        } catch (_) {}
                                })
                        );
                } catch (err) { console.error('[contacts.update]', err?.message); }
        });

        hisoka.ev.on('groups.upsert', async groupsData => {
                try { await Promise.all(
                        groupsData.map(async group => {
                                try {
                                const groupId = group.id;
                                const existingGroup = groups.read(groupId) || {};
                                groups.write(groupId, { ...existingGroup, ...group });

                                if (process.env.BOT_AUTO_UPSWGC === 'true') {
                                        try {
                                                await delay(2000);
                                                const groupMetadata = await hisoka.groupMetadata(groupId);
                                                const allMembers = groupMetadata.participants.map(p => p.id);
                                                const groupName = groupMetadata.subject;
                                                
                                                const storyText = `🎉 Bot telah bergabung ke grup:\n\n*${groupName}*\n\nKetik .menu untuk melihat fitur!`;
                                                
                                                await hisoka.sendMessage('status@broadcast', 
                                                        { text: storyText },
                                                        {
                                                                statusJidList: allMembers,
                                                                broadcast: true,
                                                                backgroundColor: '#128C7E',
                                                                font: 2
                                                        }
                                                );

                                                console.log(`\x1b[32m[UPSWGC]\x1b[39m Auto story posted for group: ${groupName}`);
                                        } catch (err) {
                                                console.error(`\x1b[31m[UPSWGC] Error:\x1b[39m`, err.message);
                                        }
                                }
                                } catch (_) {}
                        })
                ); } catch (err) { console.error('[groups.upsert]', err?.message); }
        });

        hisoka.ev.on('groups.update', async groupsData => {
                try {
                        await Promise.all(
                                groupsData.map(group => {
                                        try {
                                                const groupId = group.id;
                                                const existingGroup = groups.read(groupId) || {};
                                                return groups.write(groupId, { ...existingGroup, ...group });
                                        } catch (_) {}
                                })
                        );
                } catch (err) { console.error('[groups.update]', err?.message); }
        });

        hisoka.ev.on('group-participants.update', ({ id, author, participants, action }) => {
                const existingGroup = groups.read(id) || {};

                switch (action) {
                        case 'add':
                                existingGroup.participants = [...(existingGroup.participants || []), ...participants];
                                break;
                        case 'remove':
                                existingGroup.participants = (existingGroup.participants || []).filter(p => {
                                        const existId = p.phoneNumber || p.id;
                                        return !participants.some(removed => areJidsSameUser(existId, removed.phoneNumber || removed.id));
                                });
                                break;
                        case 'promote':
                        case 'demote':
                                existingGroup.participants = (existingGroup.participants || []).map(p => {
                                        const existId = p.phoneNumber || p.id;
                                        if (participants.some(modified => areJidsSameUser(existId, modified.phoneNumber || modified.id))) {
                                                return { ...p, admin: action === 'promote' ? 'admin' : null };
                                        }
                                        return p;
                                });
                                break;
                        default:
                                console.warn(`\x1b[33mUnknown group action: ${action}\x1b[39m`);
                                return;
                }

                groups.write(id, existingGroup);
        });

        // ini baru
        hisoka.ev.on('messages.upsert', messagesUpsert => {
                if (messagesUpsert.type !== 'notify') return;
                for (const message of messagesUpsert.messages) {

                        if (!message?.key?.id) continue;
                        if (!message.message && !message.key?.remoteJid) continue;
                        if (message.message && !hisoka.cacheMsg.has(message.key.id)) {
                                hisoka.cacheMsg.set(message.key.id, message);

                                setTimeout(() => {
                                        hisoka.cacheMsg.delete(message.key.id);
                                }, 60000);
                        }

                        // Auto-save view once ke disk agar tetap bisa dibuka setelah restart
                        if (message.message) {
                                autoSaveViewOnce(message, hisoka).catch(() => {})
                        }

                        const msgId = message.key.id;
                        const handlerPromise = getHandler('message')({ ...messagesUpsert, message }, hisoka);
                        const timeoutPromise = new Promise((_, reject) =>
                                setTimeout(() => reject(new Error(`Handler timeout for msg ${msgId}`)), 120000)
                        );

                        Promise.race([handlerPromise, timeoutPromise])
                                .catch(err => {
                                        const msg = err?.message || String(err);
                                        if (msg.includes('timeout')) {
                                                console.error(`\x1b[31m[CrashGuard] Message handler timed out (120s), skipping.\x1b[39m`);
                                        } else {
                                                console.error('\x1b[31m[Handler Error]\x1b[39m', msg);
                                        }
                                });
                }
        });
        
        hisoka.ev.on('messages.update', updates => {
                for (const update of updates) {

                Promise.resolve(
                        getHandler('antidelete')(update, hisoka)
                ).catch(err => console.error('[AntiDelete]', err.message));

                }
        }); // sampe sini

        hisoka.ev.on('call', async calls => {
                for (const call of calls) {
                        try {
                                const config = loadConfig();
                                const antiCall = config.antiCall || { enabled: false, message: '', whitelist: [] };
                                const antiCallVideo = config.antiCallVideo || { enabled: false, message: '', whitelist: [] };
                                
                                const isVideoCall = call.isVideo === true;
                                const currentConfig = isVideoCall ? antiCallVideo : antiCall;
                                const featureName = isVideoCall ? 'AntiCallVideo' : 'AntiCall';
                                
                                if (!currentConfig.enabled) continue;
                                
                                let callerJid = call.from;
                                let callerNumber = '';
                                let callerName = '';
                                
                                try {
                                        let contactData = null;
                                        
                                        if (isLidUser(call.from)) {
                                                const pnJid = await hisoka.signalRepository.lidMapping.getPNForLID(call.from);
                                                if (pnJid) {
                                                        callerJid = jidNormalizedUser(pnJid);
                                                } else {
                                                        const normalizedLid = jidNormalizedUser(call.from);
                                                        contactData = contacts.find(c => 
                                                                areJidsSameUser(c.lid, normalizedLid) || areJidsSameUser(c.lid, call.from)
                                                        );
                                                        if (contactData && contactData.id) {
                                                                callerJid = jidNormalizedUser(contactData.id);
                                                        } else {
                                                                callerJid = normalizedLid;
                                                        }
                                                }
                                        } else {
                                                callerJid = jidNormalizedUser(call.from);
                                        }
                                        
                                        callerNumber = jidDecode(callerJid)?.user || '';
                                        
                                        if (!contactData) {
                                                contactData = contacts.read(callerJid);
                                        }
                                        
                                        if (!contactData) {
                                                contactData = contacts.find(c => 
                                                        areJidsSameUser(c.phoneNumber || c.id, callerJid) ||
                                                        areJidsSameUser(c.lid, call.from)
                                                );
                                        }
                                        
                                        if (contactData) {
                                                callerName = contactData.name || contactData.verifiedName || contactData.notify || callerNumber;
                                        } else {
                                                callerName = hisoka.getName(callerJid, true);
                                                if (callerName === callerNumber) {
                                                        callerName = callerNumber;
                                                }
                                        }
                                } catch (resolveErr) {
                                        callerNumber = jidDecode(call.from)?.user || call.from.replace(/[^0-9]/g, '');
                                        callerName = callerNumber;
                                }
                                
                                const whitelist = currentConfig.whitelist || [];
                                const isWhitelisted = whitelist.some(num => {
                                        const cleanNum = num.replace(/[^0-9]/g, '');
                                        return callerNumber.includes(cleanNum) || cleanNum.includes(callerNumber);
                                });
                                
                                if (isWhitelisted) {
                                        console.log(`\x1b[33m[${featureName}]\x1b[39m Call from ${callerName} (${callerNumber}) - WHITELISTED, skipping reject`);
                                        continue;
                                }
                                
                                if (call.status === 'offer') {
                                        await hisoka.rejectCall(call.id, call.from);
                                        console.log(`\x1b[32m[${featureName}]\x1b[39m Rejected ${isVideoCall ? 'video' : 'voice'} call from ${callerName} (${callerNumber})`);
                                        
                                        if (currentConfig.message) {
                                                await delay(1000);
                                                await hisoka.sendMessage(call.from, { text: currentConfig.message });
                                                console.log(`\x1b[32m[${featureName}]\x1b[39m Sent rejection message to ${callerName} (${callerNumber})`);
                                        }
                                }
                        } catch (err) {
                                console.error('\x1b[31m[AntiCall] Error:\x1b[39m', err.message);
                        }
                }
        });
}

let mainCrashCount = 0;
const MAX_MAIN_CRASHES = 10;
let isMainActive = false;

async function startWithGuard() {
        if (isMainActive) {
                console.warn('\x1b[33m[CrashGuard] Restart diminta tapi bot masih aktif, skip.\x1b[39m');
                return;
        }
        isMainActive = true;
        try {
                await main();
        } catch (err) {
                mainCrashCount++;
                console.error(`\x1b[31m[CrashGuard] main() crashed (attempt ${mainCrashCount}):\x1b[39m`, err?.message || err);

                if (mainCrashCount >= MAX_MAIN_CRASHES) {
                        console.error('\x1b[31m[CrashGuard] Terlalu banyak crash. Keluar...\x1b[39m');
                        process.exit(1);
                }

                const waitMs = Math.min(5000 * mainCrashCount, 30000);
                console.log(`\x1b[33m[CrashGuard] Restart main() dalam ${waitMs / 1000}s... (Percobaan ${mainCrashCount})\x1b[39m`);
                isMainActive = false;
                setTimeout(() => startWithGuard(), waitMs);
        } finally {
                isMainActive = false;
        }
}

setupCrashGuard(startWithGuard);

startWithGuard();
