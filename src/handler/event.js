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

'use strict';

import fs from 'fs';
import path from 'path';
import { jidNormalizedUser, toNumber, jidDecode, proto, isPnUser, isJidGroup, delay } from 'baileys';

import { telegram } from '../helper/index.js';
import { isNumber } from '../helper/text.js';
import { getRandomEmoji, getStatusEmojis } from '../helper/emoji.js';
import { getTmpPath } from '../helper/cleaner.js';

function loadConfig() {
        try {
                const configPath = path.join(process.cwd(), 'config.json');
                if (fs.existsSync(configPath)) {
                        return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                }
        } catch (err) {}
        return {};
}

function getGreeting() {
        const hour = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false });
        const h = parseInt(hour);
        if (h >= 5 && h < 11) return 'Pagi 🌆';
        if (h >= 11 && h < 15) return 'Siang 🏙️';
        if (h >= 15 && h < 18) return 'Sore 🌇';
        return 'Malam 🌃';
}

function getMediaTypeEmoji(type) {
        const mediaTypes = {
                imageMessage: ['Foto', '📷'],
                videoMessage: ['Video', '🎥'],
                audioMessage: ['Audio', '🎵'],
                stickerMessage: ['Sticker', '🎨'],
                documentMessage: ['Dokumen', '📄'],
                extendedTextMessage: ['Teks', '📝'],
                conversation: ['Teks', '📝'],
                protocolMessage: ['Protocol', '⚙️'],
                viewOnceMessageV2: ['View Once', '👁️'],
                viewOnceMessage: ['View Once', '👁️'],
                viewOnceMessageV2Extension: ['View Once', '👁️'],
                interactiveMessage: ['Interactive', '🎯'],
                listMessage: ['List', '📋'],
                buttonsMessage: ['Buttons', '🔘'],
                templateMessage: ['Template', '📃'],
                pollCreationMessage: ['Poll', '📊'],
                reactionMessage: ['Reaction', '💬'],
                liveLocationMessage: ['Live Location', '📍'],
                locationMessage: ['Location', '📍'],
                contactMessage: ['Contact', '👤'],
                contactsArrayMessage: ['Contacts', '👥'],
        };
        return mediaTypes[type] || ['Media', '📨'];
}

const storyDebounce = new Map();

function maskNumber(number) {
        if (!number) return '***';
        const clean = number.replace(/[^0-9]/g, '');
        if (clean.length <= 6) return clean;
        return clean.slice(0, 4) + '****' + clean.slice(-3);
}

function getDisplayWidth(str) {
        let width = 0;
        for (const char of str) {
                const code = char.codePointAt(0);
                if (code > 0x1F600 && code < 0x1F9FF) width += 2;
                else if (code > 0x2600 && code < 0x27BF) width += 2;
                else if (code > 0x1F300 && code < 0x1F5FF) width += 2;
                else if (code > 0x1F900 && code < 0x1F9FF) width += 2;
                else if (code > 0x2700 && code < 0x27BF) width += 2;
                else if (code > 0xFE00 && code < 0xFE0F) width += 0;
                else if (code > 0x3000 && code < 0x9FFF) width += 2;
                else if (code > 0xFF00 && code < 0xFFEF) width += 2;
                else width += 1;
        }
        return width;
}

function padEnd(str, targetWidth) {
        const currentWidth = getDisplayWidth(str);
        const padding = Math.max(0, targetWidth - currentWidth);
        return str + ' '.repeat(padding);
}

function logStoryView(data) {
        /* tambahan botId */
        const { botId, mediaType, greeting, dayName, date, time, name, number, success, reaction, delaySeconds, mode } = data;
        const cyan = '\x1b[36m';
        const white = '\x1b[37m';
        const yellow = '\x1b[33m';
        const green = '\x1b[32m';
        const blue = '\x1b[34m';
        const orange = '\x1b[38;2;255;165;0m';
        const purple = '\x1b[38;2;180;120;255m';
        const bold = '\x1b[1m';
        const reset = '\x1b[0m';
        
        const boxWidth = 35;
        const labelWidth = 14;
        const contentWidth = boxWidth - labelWidth - 5;
        const title = 'AutoReadStoryWhatsApp';
        const titlePadding = Math.floor((boxWidth - title.length) / 2);
        
        const mediaStr = `${mediaType[0]} ${mediaType[1]}`;
        const successStr = success;
        const reactionStr = reaction;
        const delayStr = delaySeconds !== null ? `${delaySeconds} detik` : '-';
        const modeStr = mode === 'Off ❌' ? 'Read Only' : 'Read+Reaction ✓';
        
        console.log(`${cyan}╭${'═'.repeat(boxWidth)}╮${reset}`);
        console.log(`${cyan}║${' '.repeat(titlePadding)}${yellow}${title}${reset}${cyan}${' '.repeat(boxWidth - titlePadding - title.length)}║${reset}`);
        console.log(`${cyan}├${'═'.repeat(boxWidth)}┤${reset}`);
        if (botId) {
        console.log(`${cyan}│${reset} ${white}⭔ Jadibot     : ${white}${padEnd(botId, contentWidth)}${reset}${cyan}${reset}`);
}
        console.log(`${cyan}│${reset} ${white}⭔ Mode        : ${green}${padEnd(modeStr, contentWidth)}${reset}${cyan}${reset}`);
        console.log(`${cyan}│${reset} ${white}⭔ Tipe Story  : ${orange}${padEnd(mediaStr, contentWidth)}${reset}${cyan}${reset}`);
        console.log(`${cyan}│${reset} ${white}⭔ Selamat     : ${purple}${padEnd(greeting, contentWidth)}${reset}${cyan}${reset}`);
        console.log(`${cyan}│${reset} ${white}⭔ Hari        : ${blue}${padEnd(dayName, contentWidth)}${reset}${cyan}${reset}`);
        console.log(`${cyan}│${reset} ${white}⭔ Tanggal     : ${yellow}${padEnd(date, contentWidth)}${reset}${cyan}${reset}`);
        console.log(`${cyan}│${reset} ${white}⭔ Waktu       : ${blue}${padEnd(time, contentWidth)}${reset}${cyan}${reset}`);
        console.log(`${cyan}│${reset} ${white}⭔ Nama        : ${white}${padEnd(name.slice(0, contentWidth - 2), contentWidth)}${reset}${cyan}${reset}`);
        console.log(`${cyan}│${reset} ${white}⭔ Nomor       : ${white}${padEnd(number, contentWidth)}${reset}${cyan}${reset}`);
        console.log(`${cyan}│${reset} ${white}⭔ Berhasil    : ${green}${padEnd(successStr, contentWidth)}${reset}${cyan}${reset}`);
        console.log(`${cyan}│${reset} ${white}⭔ Reaksi      : ${padEnd(reactionStr, contentWidth)}${reset}${cyan}${reset}`);
        console.log(`${cyan}│${reset} ${white}⭔ Delay       : ${orange}${padEnd(delayStr, contentWidth)}${reset}${cyan}${reset}`);
        console.log(`${cyan}└${'─'.repeat(13)}···${reset}`);
}

export default async function (m, hisoka) {
        try {

                if (m.content && m.content.contextInfo && isNumber(m.content.contextInfo.expiration) && isPnUser(m.from)) {
                        const expiration = m.content.contextInfo.expiration;
                        const ephemeralSettingTimestamp = toNumber(m.content.contextInfo.ephemeralSettingTimestamp);
                        const contact = hisoka.contacts.read(m.from) || {};
                        hisoka.contacts.write(m.from, { ...contact, ephemeralSettingTimestamp, ephemeralDuration: expiration });
                }

                if (m.message.protocolMessage) {
                        const protocolMessage = m.message.protocolMessage;
                        const key = protocolMessage.key;
                        const type = protocolMessage.type;

                        switch (type) {
                                case proto.Message.ProtocolMessage.Type.EPHEMERAL_SETTING:
                                case proto.Message.ProtocolMessage.Type.EPHEMERAL_SYNC_RESPONSE: {
                                        const id = await hisoka.resolveLidToPN(key);
                                        const contact = hisoka.contacts.read(id) || {};
                                        hisoka.contacts.write(id, {
                                                ...contact,
                                                ephemeralSettingTimestamp: toNumber(
                                                        protocolMessage.ephemeralSettingTimestamp || m.message.messageTimestamp
                                                ),
                                                ephemeralDuration: protocolMessage.ephemeralExpiration,
                                        });
                                        break;
                                }
                        }
                }

                if (!m.isOwner && !m.isBot && !m.status && m.message && m.type && m.type !== 'protocolMessage' && m.type !== 'reactionMessage') {
                        const config = loadConfig();
                        const autoTyping = config.autoTyping || {};
                        const autoRecording = config.autoRecording || {};
                        
                        const isPrivate = isPnUser(m.from);
                        const isGroup = isJidGroup(m.from);
                        
                        const shouldAutoType = autoTyping.enabled && 
                                ((isPrivate && autoTyping.privateChat) || (isGroup && autoTyping.groupChat));
                        
                        const shouldAutoRecord = autoRecording.enabled && 
                                ((isPrivate && autoRecording.privateChat) || (isGroup && autoRecording.groupChat));
                        
                        if (shouldAutoType || shouldAutoRecord) {
                                (async () => {
                                        try {
                                                if (shouldAutoType && !shouldAutoRecord) {
                                                        await hisoka.sendPresenceUpdate('composing', m.from);
                                                        const delayMs = (autoTyping.delaySeconds || 5) * 1000;
                                                        await delay(delayMs);
                                                        await hisoka.sendPresenceUpdate('paused', m.from);
                                                } else if (shouldAutoRecord && !shouldAutoType) {
                                                        await hisoka.sendPresenceUpdate('recording', m.from);
                                                        const delayMs = (autoRecording.delaySeconds || 5) * 1000;
                                                        await delay(delayMs);
                                                        await hisoka.sendPresenceUpdate('paused', m.from);
                                                } else if (shouldAutoType && shouldAutoRecord) {
                                                        await hisoka.sendPresenceUpdate('composing', m.from);
                                                        const typingDelayMs = (autoTyping.delaySeconds || 5) * 1000;
                                                        await delay(typingDelayMs);
                                                        await hisoka.sendPresenceUpdate('recording', m.from);
                                                        const recordingDelayMs = (autoRecording.delaySeconds || 5) * 1000;
                                                        await delay(recordingDelayMs);
                                                        await hisoka.sendPresenceUpdate('paused', m.from);
                                                }
                                        } catch (err) {
                                                console.error('\x1b[31m[AutoTyping/Recording] Error:\x1b[39m', err.message);
                                        }
                                })();
                        }
                }
                // ─── ANTI TAG STATUS WA ──────────────────────────────────────
                // Blok ini berdiri sendiri — tidak bergantung pada !m.isOwner,
                // agar bisa mendeteksi tag dari siapa saja (termasuk owner).
                if (!m.key?.fromMe && m.key?.remoteJid === 'status@broadcast' && m.message && m.type && m.type !== 'protocolMessage' && m.type !== 'reactionMessage') {
                        const _cfg = loadConfig();
                        const antiTagSW = _cfg.antiTagSW || {};
                        if (antiTagSW.enabled) {
                                try {
                                        const botJid    = jidNormalizedUser(hisoka.user.id);
                                        const botNumber = jidDecode(botJid)?.user || '';
                                        const rawMsg    = m.raw || {};

                                        // Kumpulkan mention dari SEMUA kemungkinan lokasi Baileys:
                                        // 1. m.mentions  — sudah di-resolve oleh injectEndMessage
                                        // 2. m.statusMentionedJids — field top-level WAMessage (WhatsApp baru)
                                        // 3. contextInfo.mentionedJid dari setiap jenis pesan
                                        // 4. statusMentionedJids di dalam content pesan itu sendiri
                                        const allMentionsRaw = [
                                                ...(Array.isArray(m.mentions) ? m.mentions : []),
                                                ...(Array.isArray(m.statusMentionedJids) ? m.statusMentionedJids : []),
                                                ...(m.content?.contextInfo?.mentionedJid   || []),
                                                ...(m.content?.statusMentionedJids         || []),
                                                ...(rawMsg.imageMessage?.contextInfo?.mentionedJid         || []),
                                                ...(rawMsg.imageMessage?.statusMentionedJids               || []),
                                                ...(rawMsg.videoMessage?.contextInfo?.mentionedJid         || []),
                                                ...(rawMsg.videoMessage?.statusMentionedJids               || []),
                                                ...(rawMsg.extendedTextMessage?.contextInfo?.mentionedJid  || []),
                                                ...(rawMsg.extendedTextMessage?.statusMentionedJids        || []),
                                        ];

                                        // Log debug hanya jika ada mention (mengurangi noise di konsol)
                                        if (allMentionsRaw.length > 0) {
                                                console.log(`\x1b[35m[AntiTagSW DEBUG]\x1b[0m Status dari ${m.pushName || m.sender} ada mention:`, JSON.stringify(allMentionsRaw));
                                        }

                                        const isBotTagged = allMentionsRaw.some(jid => {
                                                try {
                                                        if (!jid) return false;
                                                        const normalized = jidNormalizedUser(jid);
                                                        return normalized === botJid ||
                                                               jid.includes(botNumber) ||
                                                               normalized.includes(botNumber);
                                                } catch { return false; }
                                        });

                                        if (isBotTagged) {
                                                // m.sender sudah di-resolve dari LID ke nomor HP oleh resolveLidToPN
                                                const taggerJid    = jidNormalizedUser(m.sender);
                                                const taggerNumber = jidDecode(taggerJid)?.user || 'Unknown';
                                                const taggerName   = m.pushName || hisoka.getName(taggerJid, true) || taggerNumber;

                                                console.log(`\x1b[33m[AntiTagSW]\x1b[0m \x1b[1m${taggerName}\x1b[0m (${taggerNumber}) men-tag bot di status`);

                                                if (antiTagSW.autoReply !== false) {
                                                        const replyMsg = antiTagSW.message || 'Hei kak! Tolong jangan tag bot di status WhatsApp ya 🙏';
                                                        await hisoka.sendMessage(taggerJid, { text: replyMsg }).catch(err => {
                                                                console.error('\x1b[31m[AntiTagSW] Gagal reply:\x1b[39m', err.message);
                                                        });
                                                }

                                                if (antiTagSW.notifyOwner !== false) {
                                                        const owners   = (_cfg.owners || []).map(n => `${n}@s.whatsapp.net`);
                                                        const notifText = `🔔 *[ANTI TAG STATUS]*\n\nSeseorang men-tag bot di status WA mereka!\n\n👤 *Nama:* ${taggerName}\n📞 *Nomor:* ${taggerNumber}\n🕐 *Waktu:* ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`;
                                                        for (const ownerJid of owners) {
                                                                await hisoka.sendMessage(ownerJid, { text: notifText }).catch(() => {});
                                                        }
                                                }
                                        }
                                } catch (tagErr) {
                                        console.error('\x1b[31m[AntiTagSW] Error:\x1b[39m', tagErr.message);
                                }
                        }
                }
                // ─────────────────────────────────────────────────────────────

                // ini baru
                if (!m.isOwner && m.key?.remoteJid === 'status@broadcast' && m.message && m.type && m.type !== 'protocolMessage' && m.type !== 'reactionMessage') { // sampe sini
                        const config = loadConfig();

                        const storyConfig = config.autoReadStory || {};
                        
                        if (storyConfig.enabled === false) return;

                        const reactStatus = getStatusEmojis();
                        let usedReaction = reactStatus.length ? getRandomEmoji('status') : '❌';

                        const useRandomDelay = storyConfig.randomDelay !== false;
                        const delayMinMs = storyConfig.delayMinMs || 1000;
                        const delayMaxMs = storyConfig.delayMaxMs || 20000;
                        const fixedDelayMs = storyConfig.fixedDelayMs || 3000;
                        
                        const delayMs = useRandomDelay 
                                ? Math.floor(Math.random() * (delayMaxMs - delayMinMs)) + delayMinMs
                                : fixedDelayMs;

                        const shouldReact = storyConfig.autoReaction !== false && reactStatus.length;

                        await new Promise(resolve => setTimeout(resolve, delayMs));

                        // Perlu 2 jenis receipt:
                        // 1. 'read'      → kirim ke poster agar mereka tahu story sudah dilihat
                        // 2. 'read-self' → sinkronisasi ke akun sendiri agar story tampil sudah dibaca
                        //                  di WhatsApp Web / HP kita (hilangkan tanda hijau/unread)
                        // Gunakan m.sender (sudah resolved dari LID ke nomor HP) sebagai participant
                        const resolvedParticipant = jidNormalizedUser(m.sender);
                        const storyKey = {
                                ...m.key,
                                remoteJid: 'status@broadcast',
                                participant: resolvedParticipant,
                                fromMe: false,
                        };
                        const readPromise = Promise.all([
                                hisoka.sendReceipts([storyKey], 'read').catch(err => {
                                        console.error('\x1b[31m[AutoRead] read failed:\x1b[39m', err.message);
                                }),
                                hisoka.sendReceipts([storyKey], 'read-self').catch(err => {
                                        console.error('\x1b[31m[AutoRead] read-self failed:\x1b[39m', err.message);
                                }),
                        ]);

                        const reactPromise = shouldReact ? hisoka.sendMessage(
                                'status@broadcast',
                                {
                                        react: { key: m.key, text: usedReaction },
                                },
                                {
                                        statusJidList: [jidNormalizedUser(hisoka.user.id), jidNormalizedUser(m.sender)],
                                }
                        ).catch((err) => {
                                console.error('\x1b[31m[Reaction Error]\x1b[39m', err.message);
                                usedReaction = '❌ Gagal';
                        }) : Promise.resolve();

                        await Promise.all([readPromise, reactPromise]);

                        const from = jidNormalizedUser(m.participant || m.sender);
                        const storyNumber = jidDecode(from)?.user || '';
                        const storyName = m.pushName || hisoka.getName(from, true) || storyNumber;
                        const messageDate = new Date(toNumber(m.messageTimestamp) * 1000);
                        
                        const now = Date.now();
                        // ini baru debounce bot utama dan jadibot
                        const botId = hisoka.user.id.split(':')[0]
                        const debounceKey = `${botId}:${from}` // sampe sini
                        const lastLog = storyDebounce.get(debounceKey);
                        const telegramConfig = loadConfig().telegram || {};
                        
                        if (lastLog) {
                                lastLog.count++;
                                storyDebounce.set(debounceKey, lastLog);
                        } else {
                                storyDebounce.set(debounceKey, { time: now, count: 1 });
                                
                                const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                                
                                const jakartaDate = new Date(messageDate.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
                                const dayName = dayNames[jakartaDate.getDay()];
                                const dateStr = `${jakartaDate.getDate()} ${monthNames[jakartaDate.getMonth()]} ${jakartaDate.getFullYear()}`;
                                const timeStr = jakartaDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '.');
                                
                                let successMsg = 'Ke Tele ✓';
                                if (!telegramConfig.enabled || !telegramConfig.chatId || !telegramConfig.token) {
                                        successMsg = 'Ke Tele ❌';
                                }

                                logStoryView({
                     /* ini tambahan */ botId: hisoka.isMainBot ? null : (hisoka.user.name || maskNumber(botId)),
                                        mediaType: getMediaTypeEmoji(m.type),
                                        greeting: getGreeting(),
                                        dayName: dayName + ' 🔁',
                                        date: dateStr + ' 🗓️',
                                        time: timeStr + ' ⏰',
                                        name: storyName,
                                        number: maskNumber(storyNumber),
                                        success: successMsg,
                                        reaction: shouldReact ? usedReaction : 'Off ❌',
                                        delaySeconds: (delayMs / 1000).toFixed(1),
                                        mode: shouldReact ? 'Read+Reaction ✓' : 'Read Only'
                                });
                                
                                setTimeout(() => {
                                        const data = storyDebounce.get(debounceKey);
                                        if (data && data.count > 1) {
                                                console.log(`\x1b[33m   └─ +${data.count - 1} story lainnya dari ${storyName}\x1b[39m`);
                                        }
                                        storyDebounce.delete(debounceKey);
                                }, 3000);
                        }

                        if (telegramConfig.enabled && telegramConfig.chatId && telegramConfig.token) {
                                const text = `<b>From :</b> <a href="https://wa.me/${jidDecode(from).user}">@${storyName}</a>
<b>Date :</b> ${new Date(toNumber(m.messageTimestamp) * 1000).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })}
${m.text ? `<b>Caption :</b>\n\n${m.text}` : ''}`.trim();

                                if (m.isMedia) {
                                        try {
                                                const media = await m.downloadMedia();
                                                
                                                if (!media || media.length === 0) {
                                                        await telegram.send(telegramConfig.chatId, text + '\n\n<i>(Media tidak tersedia)</i>', { type: 'text', parse_mode: 'HTML' });
                                                } else {
                                                        const ext = m.type === 'imageMessage' ? 'jpg' : m.type === 'videoMessage' ? 'mp4' : m.type === 'audioMessage' ? 'mp3' : 'bin';
                                                        const tmpFile = getTmpPath(`story_${Date.now()}.${ext}`);
                                                        
                                                        try {
                                                                fs.writeFileSync(tmpFile, media);
                                                                
                                                                await telegram.send(telegramConfig.chatId, media, {
                                                                        caption: text,
                                                                        type: m.type.replace('Message', ''),
                                                                        parse_mode: 'HTML',
                                                                });
                                                                
                                                                fs.unlinkSync(tmpFile);
                                                        } catch (err) {
                                                                if (fs.existsSync(tmpFile)) {
                                                                        fs.unlinkSync(tmpFile);
                                                                }
                                                                console.error('\x1b[31m[AutoReadSW] Error sending to Telegram:\x1b[39m', err.message);
                                                        }
                                                }
                                        } catch (downloadErr) {
                                                console.error('\x1b[33m[AutoReadSW] Media unavailable:\x1b[39m', downloadErr.message);
                                                await telegram.send(telegramConfig.chatId, text + '\n\n<i>(Media tidak tersedia)</i>', { type: 'text', parse_mode: 'HTML' }).catch(() => {});
                                        }
                                } else {
                                        await telegram.send(telegramConfig.chatId, text, { type: 'text', parse_mode: 'HTML' });
                                }
                        }
                }
        } catch (e) {
                console.error(`\x1b[31mError in event handler:\x1b[39m\n`, e);
        }
}
