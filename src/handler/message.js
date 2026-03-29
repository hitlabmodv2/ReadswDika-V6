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
import os from 'os';
import { isJidGroup, downloadMediaMessage, getContentType } from 'baileys';
import { exec } from 'child_process';
import util from 'util';

import { msToTime, loadConfig, saveConfig } from '../helper/utils.js';
import { getUptimeFormatted, getBotStats } from '../db/botStats.js';
import { startJadibot, stopJadibot, jadibotMap } from '../helper/jadibot.js';
// yg bawah pindah ke sini
import { injectMessage } from '../helper/inject.js';
import listenEvent from './event.js';

function isMainBot(hisoka) {
    return hisoka?.isMainBot === true;
}

function getSenderNumber(m) {
    if (m.key?.participant) return m.key.participant.split('@')[0];
    if (m.key?.remoteJid) return m.key.remoteJid.split('@')[0];
    return null;
}

function isAllowedForJadibot(m, hisoka) {
    if (m.key?.fromMe) return true;

    const senderNumber = getSenderNumber(m);
    if (!senderNumber) return false;

    if (senderNumber === hisoka.mainBotNumber) return true;

    const botNumber = hisoka.user?.id?.split(':')[0]?.split('@')[0];
    if (senderNumber === botNumber) return true;

    return false;
}

function logCommand(m, hisoka, command) {
        if (process.env.BOT_LOG_MESSAGE !== 'true') return;
        const location = m.isGroup ? `"${hisoka.getName(m.from)}"` : 'Private Chat';
        console.log(`\x1b[32m[CMD]\x1b[39m \x1b[36m.${command}\x1b[39m - ${m.pushName} @ ${location}`);
}

function extractMediaFromMessage(quotedMsg) {
        let targetMessage = quotedMsg;
        let foundViewOnce = false;

        if (quotedMsg.ephemeralMessage?.message) {
                targetMessage = quotedMsg.ephemeralMessage.message;
        }

        if (targetMessage.viewOnceMessage?.message) {
                targetMessage = targetMessage.viewOnceMessage.message;
                foundViewOnce = true;
        }

        if (targetMessage.viewOnceMessageV2?.message) {
                targetMessage = targetMessage.viewOnceMessageV2.message;
                foundViewOnce = true;
        }

        if (targetMessage.viewOnceMessageV2Extension?.message) {
                targetMessage = targetMessage.viewOnceMessageV2Extension.message;
                foundViewOnce = true;
        }

        const mediaTypes = [
                'imageMessage',
                'videoMessage',
                'audioMessage',
                'documentMessage',
                'stickerMessage'
        ];

        for (const mediaType of mediaTypes) {
                if (targetMessage[mediaType]) {
                        return {
                                mediaMessage: targetMessage[mediaType],
                                mediaType: mediaType,
                                isViewOnce: foundViewOnce || 
                                        targetMessage[mediaType].viewOnce === true ||
                                        quotedMsg.viewOnceMessage ||
                                        quotedMsg.viewOnceMessageV2 ||
                                        quotedMsg.viewOnceMessageV2Extension
                        };
                }
        }

        return null;
}

function isViewOnceMessage(quotedMsg) {
        if (quotedMsg.viewOnceMessage) return true;
        if (quotedMsg.viewOnceMessageV2) return true;
        if (quotedMsg.viewOnceMessageV2Extension) return true;

        if (quotedMsg.ephemeralMessage?.message) {
                const ephemeralContent = quotedMsg.ephemeralMessage.message;
                if (ephemeralContent.viewOnceMessage) return true;
                if (ephemeralContent.viewOnceMessageV2) return true;
                if (ephemeralContent.viewOnceMessageV2Extension) return true;

                const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
                for (const type of mediaTypes) {
                        if (ephemeralContent[type]?.viewOnce) return true;
                }
        }

        const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
        for (const type of mediaTypes) {
                if (quotedMsg[type]?.viewOnce) return true;
        }

        return false;
}

export default async function ({ message, type: messagesType }, hisoka) {
        try {
                const m = await injectMessage(hisoka, message);

                if (!m || !m.message) return;

                await listenEvent(m, hisoka);

                const quoted = m.isMedia ? m : m.isQuoted ? m.quoted : m;
                const text = m.text;
                const query = m.query || quoted.query;

                if (!m.key) return;
                if (m.isBot) return;
                if (messagesType === 'append') return;

                // AutoSimi
                if (m.isGroup && !m.text?.startsWith('.')) {
                        try {
                                const config = loadConfig();
                                const autoSimi = config.autoSimi || {};
                                
                                if (autoSimi.enabled && autoSimi.apiKey) {
                                        const botId = hisoka.user?.id || '';
                                        const botNumber = botId.split(':')[0] || botId.split('@')[0];
                                        const botJid = botNumber + '@s.whatsapp.net';
                                        const botLid = hisoka.user?.lid || '';
                                        
                                        const mentionedJids = m.mentions || 
                                                             m.message?.extendedTextMessage?.contextInfo?.mentionedJid || 
                                                             m.message?.imageMessage?.contextInfo?.mentionedJid ||
                                                             m.message?.videoMessage?.contextInfo?.mentionedJid ||
                                                             m.message?.stickerMessage?.contextInfo?.mentionedJid ||
                                                             m.content?.contextInfo?.mentionedJid ||
                                                             [];
                                        
                                        const isBotMentioned = mentionedJids.some(jid => {
                                                if (!jid) return false;
                                                const jidNumber = jid.split(':')[0]?.split('@')[0] || jid.split('@')[0];
                                                return jid === botJid || 
                                                       jid === botId || 
                                                       jid === botLid ||
                                                       jid?.includes(botNumber) ||
                                                       jidNumber === botNumber;
                                        }) || m.text?.includes('@' + botNumber);
                                        
                                        const isReplyToBot = m.isQuoted && m.quoted?.key?.fromMe;
                                        
                                        if (isBotMentioned || isReplyToBot) {
                                                let userMessage = m.text?.trim() || '';
                                                
                                                if (userMessage) {
                                                        userMessage = userMessage.replace(/@\d+/g, '').replace(/@bot/gi, '').trim();
                                                }
                                                
                                                const mediaType = m.type;
                                                if (!userMessage && mediaType) {
                                                        if (mediaType.includes('sticker')) {
                                                                userMessage = 'Pengguna mengirim sticker lucu';
                                                        } else if (mediaType.includes('image')) {
                                                                userMessage = 'Pengguna mengirim gambar';
                                                        } else if (mediaType.includes('video')) {
                                                                userMessage = 'Pengguna mengirim video';
                                                        } else if (mediaType.includes('audio')) {
                                                                userMessage = 'Pengguna mengirim voice note';
                                                        } else if (mediaType.includes('document')) {
                                                                userMessage = 'Pengguna mengirim dokumen';
                                                        } else {
                                                                userMessage = 'Halo!';
                                                        }
                                                }
                                                
                                                if (!userMessage) userMessage = 'Halo!';
                                                
                                                const now = new Date();
                                                const hours = now.getHours();
                                                const timeOfDay = hours < 11 ? 'pagi' : hours < 15 ? 'siang' : hours < 18 ? 'sore' : 'malam';
                                                const currentTime = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                                                const currentDate = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                                                const userName = m.pushName || 'Kak';
                                                
                                                let quotedContext = '';
                                                if (isReplyToBot && m.quoted?.text) {
                                                        quotedContext = `\n[Konteks: Kamu sebelumnya bilang "${m.quoted.text.substring(0, 100)}"]`;
                                                }
                                                
                                                const systemPrompt = `Kamu adalah SimSimi, chatbot pintar yang bisa ngobrol nyambung dan real-time!

INFORMASI REAL-TIME:
- Waktu sekarang: ${currentTime} WIB (${timeOfDay})
- Tanggal: ${currentDate}
- Nama pengguna: ${userName}${quotedContext}

ATURAN WAJIB:
1. SELALU jawab NYAMBUNG dengan pertanyaan/topik user - pahami konteks dan maksudnya
2. Gunakan info real-time di atas untuk jawaban yang relevan (misal: "Selamat ${timeOfDay} ${userName}!")
3. Pakai bahasa Indonesia gaul/santai: wkwk, hehe, dong, sih, nih, kan, lho, deh, anjir, goks, mantap
4. WAJIB pakai emoji yang relevan (1-3 emoji)
5. Jawab SINGKAT tapi NYAMBUNG (1-3 kalimat)
6. Kalau ditanya waktu/tanggal, kasih info yang benar dari data di atas
7. Kalau ada yang curhat, dengerin dan respon dengan empati
8. Kalau ada yang nanya sesuatu, jawab dengan helpful tapi tetap santai
9. JANGAN pakai markdown, asterisk, atau format khusus
10. Kalau ditanya siapa kamu, jawab "Aku SimSimi~ temen ngobrol kamu 🐥"

CONTOH NYAMBUNG:
- User: "lagi ngapain?" -> "Lagi nemenin kamu ngobrol nih ${userName}~ kamu sendiri lagi ngapain jam segini? 😄"
- User: "jam berapa?" -> "Sekarang jam ${currentTime} ${timeOfDay} kak! ⏰"
- User: "hari apa?" -> "Hari ini ${currentDate} kak~ 📅"
- User: "bosen" -> "Sama dong ${userName}, makanya chat aku terus biar ga bosen wkwk 😆"
- User: "laper" -> "Waduh ${timeOfDay} gini emang jam makan sih, makan dulu gih! 🍽️"`;
                                                
                                                const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                                                        method: 'POST',
                                                        headers: {
                                                                'Content-Type': 'application/json',
                                                                'Authorization': `Bearer ${autoSimi.apiKey}`
                                                        },
                                                        body: JSON.stringify({
                                                                model: 'llama-3.1-8b-instant',
                                                                messages: [
                                                                        { role: 'system', content: systemPrompt },
                                                                        { role: 'user', content: userMessage }
                                                                ],
                                                                max_tokens: 150,
                                                                temperature: 0.9
                                                        })
                                                });
                                                
                                                const data = await res.json();
                                                const response = data.choices?.[0]?.message?.content;
                                                
                                                if (response && response.trim()) {
                                                        await m.reply(response.trim());
                                                        console.log(`\x1b[36m[AutoSimi]\x1b[39m Reply to ${m.pushName} in "${hisoka.getName(m.from)}" | Trigger: ${isBotMentioned ? 'mention' : 'reply'}`);
                                                }
                                        }
                                }
                        } catch (autoSimiError) {
                                console.error('\x1b[31m[AutoSimi] Error:\x1b[39m', autoSimiError.message);
                        }
                }
                
                if (hisoka?.isMainBot === true) {
                    if (!m.isOwner) return;
                }

                if (hisoka?.isMainBot === false) {
                    if (!isAllowedForJadibot(m, hisoka)) return;
                }
                
                if (!hisoka.pendingYoutubeDownloads) {
                        hisoka.pendingYoutubeDownloads = new Map();
                }

                if (m.isQuoted && m.quoted?.key?.id) {
                        const quotedId = m.quoted.key.id;
                        const pendingData = hisoka.pendingYoutubeDownloads.get(quotedId);
                        if (pendingData) {
                                const cleanText = text?.trim()?.charAt(0);
                                if (cleanText !== '1' && cleanText !== '2') {
                                        await m.reply('❌ Pilihan tidak valid!\n\nReply dengan:\n*1* untuk Audio (MP3)\n*2* untuk Video (MP4)');
                                        return;
                                }
                                const choice = cleanText;
                                
                                try {
                                        const loadingMsg = await m.reply(choice === '1' ? '⏳ Mengunduh audio...' : '⏳ Mengunduh video...');
                                        
                                        const { Innertube, Platform } = await import('youtubei.js');
                                        
                                        Platform.shim.eval = async (data, env) => {
                                                const properties = [];
                                                if (env && env.n) {
                                                        properties.push(`n: exportedVars.nFunction("${env.n}")`);
                                                }
                                                if (env && env.sig) {
                                                        properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
                                                }
                                                const code = `${data.output}\nreturn { ${properties.join(', ')} }`;
                                                try {
                                                        return new Function(code)();
                                                } catch (e) {
                                                        return {};
                                                }
                                        };
                                        
                                        const youtube = await Innertube.create({
                                                fetch: fetch,
                                                generate_session_locally: true,
                                                retrieve_player: true,
                                                lang: 'id',
                                                location: 'ID'
                                        });
                                        
                                        const info = await youtube.getInfo(pendingData.videoId);
                                        
                                        if (choice === '1') {
                                                let audioBuffer = null;
                                                const audioQualities = ['lowest', '144p', '240p', '360p'];
                                                
                                                for (const qual of audioQualities) {
                                                        try {
                                                                const stream = await info.download({
                                                                        type: 'video+audio',
                                                                        quality: qual
                                                                });
                                                                const chunks = [];
                                                                for await (const chunk of stream) {
                                                                        chunks.push(chunk);
                                                                }
                                                                audioBuffer = Buffer.concat(chunks);
                                                                console.log(`[Play] Audio downloaded with quality: ${qual}`);
                                                                break;
                                                        } catch (e) {
                                                                console.log(`[Play] Audio quality ${qual} failed:`, e.message);
                                                                continue;
                                                        }
                                                }
                                                
                                                if (!audioBuffer) {
                                                        try {
                                                                const stream = await info.download({
                                                                        type: 'audio',
                                                                        quality: 'best'
                                                                });
                                                                const chunks = [];
                                                                for await (const chunk of stream) {
                                                                        chunks.push(chunk);
                                                                }
                                                                audioBuffer = Buffer.concat(chunks);
                                                                console.log('[Play] Audio downloaded with audio-only stream');
                                                        } catch (e) {
                                                                console.log('[Play] Audio-only failed:', e.message);
                                                        }
                                                }
                                                
                                                if (audioBuffer && audioBuffer.length < 50 * 1024 * 1024) {
                                                        const sizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(2);
                                                        await hisoka.sendMessage(m.from, {
                                                                audio: audioBuffer,
                                                                mimetype: 'audio/mpeg',
                                                                ptt: false
                                                        }, { quoted: m });
                                                        await m.reply(`✅ *Audio Berhasil!*\n\n🎵 *${pendingData.title}*\n👤 ${pendingData.channel}\n📁 ${sizeMB} MB`);
                                                } else if (audioBuffer) {
                                                        await m.reply('⚠️ Audio terlalu besar (>50MB)');
                                                } else {
                                                        await m.reply('❌ Gagal mengunduh audio. Coba pilih opsi 2 (video).');
                                                }
                                        } else {
                                                let videoBuffer = null;
                                                let downloadedQuality = '';
                                                const qualities = ['360p', '480p', '720p', 'best'];
                                                
                                                for (const qual of qualities) {
                                                        try {
                                                                const stream = await info.download({
                                                                        type: 'video+audio',
                                                                        quality: qual
                                                                });
                                                                const chunks = [];
                                                                for await (const chunk of stream) {
                                                                        chunks.push(chunk);
                                                                }
                                                                videoBuffer = Buffer.concat(chunks);
                                                                downloadedQuality = qual;
                                                                break;
                                                        } catch (qualErr) {
                                                                continue;
                                                        }
                                                }
                                                
                                                if (videoBuffer && videoBuffer.length < 100 * 1024 * 1024) {
                                                        const sizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(2);
                                                        await hisoka.sendMessage(m.from, {
                                                                video: videoBuffer,
                                                                mimetype: 'video/mp4',
                                                                caption: `✅ *Video Berhasil!*\n\n🎬 *${pendingData.title}*\n👤 ${pendingData.channel}\n📁 ${sizeMB} MB\n📺 ${downloadedQuality}`
                                                        }, { quoted: m });
                                                } else if (videoBuffer) {
                                                        await m.reply('⚠️ Video terlalu besar (>100MB)');
                                                } else {
                                                        await m.reply('❌ Gagal mengunduh video');
                                                }
                                        }
                                        
                                        logCommand(m, hisoka, choice === '1' ? 'play-audio' : 'play-video');
                                } catch (error) {
                                        console.error('\x1b[31m[Play Download] Error:\x1b[39m', error.message);
                                        await m.reply(`❌ Error: ${error.message}`);
                                }
                                return;
                        }
                }

                switch (m.command) {

                        case 'ht':
                        case 'all': {
                                if (!m.isGroup) return;

                                const group = hisoka.groups.read(m.from);
                                const participants = group.participants.map(v => v.phoneNumber || v.id);

                                const msg = await hisoka.messageModify(m.from, /text|conversation/i.test(m.type) && query ? m : quoted, {
                                        quoted: undefined,
                                        text: `@${m.from}\n\n${query}`.trim(),
                                        mentions: participants.map(v => ({ id: v })).concat({ id: m.from, name: 'everyone' }),
                                });

                                await hisoka.relayMessage(m.from, msg.message);
                                logCommand(m, hisoka, 'hidetag');
                                break;
                        }

                        case 'q':
                        case 'quoted': {
                                if (!m.isQuoted) {
                                        await m.reply('No quoted message found.');
                                        return;
                                }

                                const message = hisoka.cacheMsg.get(m.quoted.key.id);
                                if (!message) {
                                        await m.reply('Quoted message not found.');
                                        return;
                                }

                                const IMessage = await injectMessage(hisoka, message);
                                if (!IMessage.isQuoted) {
                                        await m.reply('Quoted message not found.');
                                        return;
                                }

                                await m.reply({ forward: IMessage.quoted });
                                logCommand(m, hisoka, 'quoted');
                                break;
                        }

                                case 'p':
                                case 'ping' : {
                                try {
                                        const msg = await m.reply('⏳ _Checking..._');
                                        const latency = Math.abs(Date.now() - m.messageTimestamp * 1000);
                                        const stats = getBotStats();
                                        const sessionUptime = process.uptime();
                                        
                                        const memUsage = process.memoryUsage();
                                        const memUsedMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
                                        const memTotalMB = (memUsage.heapTotal / 1024 / 1024).toFixed(2);
                                        
                                        const now = new Date();
                                        const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
                                        const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
                                        
                                        const jakartaHour = parseInt(now.toLocaleTimeString('id-ID', { hour: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }));
                                        let greetingTime, greetingEmoji;
                                        if (jakartaHour >= 4 && jakartaHour < 11) {
                                                greetingTime = 'Pagi';
                                                greetingEmoji = '🌅';
                                        } else if (jakartaHour >= 11 && jakartaHour < 15) {
                                                greetingTime = 'Siang';
                                                greetingEmoji = '☀️';
                                        } else if (jakartaHour >= 15 && jakartaHour < 18) {
                                                greetingTime = 'Sore';
                                                greetingEmoji = '🌇';
                                        } else {
                                                greetingTime = 'Malam';
                                                greetingEmoji = '🌙';
                                        }
                                        
                                        const speedText = latency < 100 ? 'Cepat' : latency < 500 ? 'Normal' : 'Lambat';
                                        const speedEmoji = latency < 100 ? '🚀' : latency < 500 ? '⚡' : '🐢';
                                        
                                        const sessSeconds = Math.floor(sessionUptime);
                                        const sessMinutes = Math.floor(sessSeconds / 60);
                                        const sessHours = Math.floor(sessMinutes / 60);
                                        const sessDays = Math.floor(sessHours / 24);
                                        const sessFormatted = `${sessDays}d ${sessHours % 24}h ${sessMinutes % 60}m`;
                                        
                                        const cpuCores = os.cpus().length;
                                        const cpuModel = os.cpus()[0]?.model?.split(' ')[0] || 'Unknown';
                                        const totalMemGB = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
                                        const freeMemGB = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);
                                        const usedMemGB = (totalMemGB - freeMemGB).toFixed(1);
                                        const memPercent = ((usedMemGB / totalMemGB) * 100).toFixed(0);
                                        const nodeVersion = process.version;
                                        const platform = process.platform;
                                        
                                        const pingText = `
╭═════════════════════╮
║        🏓 *PONG!* 🏓        
├═════════════════════┤
│ 👋 Selamat  » ${greetingTime} ${greetingEmoji}
│ ${speedEmoji} Speed  » ${speedText}
│ ⚡ Latency  » ${latency}ms
│ 🕐 Waktu  » ${timeStr}
│ 📅 Tanggal  » ${dateStr}
├═════════════════════┤
║        📊 *BOT STATUS*        
├═════════════════════┤
│ ⏱️ Uptime  » ${stats.uptime.days}d ${stats.uptime.hours}h ${stats.uptime.minutes}m
│ 🔄 Session  » ${sessFormatted}
│ 🔁 Restart  » ${stats.totalRestarts}x
│ 🟢 Status  » Online
├═════════════════════┤
║        💻 *SYSTEM INFO*        
├═════════════════════┤
│ 🧠 CPU  » ${cpuCores} Core
│ 📟 RAM  » ${usedMemGB}/${totalMemGB}GB (${memPercent}%)
│ 💾 Bot Mem  » ${memUsedMB}MB
│ 🖥️ Platform  » ${platform}
│ 📦 NodeJS  » ${nodeVersion}
╰═════════════════════╯`;

                                        let ppUrl;
                                        try {
                                                ppUrl = await hisoka.profilePictureUrl(hisoka.user.id, 'image');
                                        } catch {
                                                ppUrl = null;
                                        }

                                        if (ppUrl) {
                                                await hisoka.sendMessage(m.from, {
                                                        image: { url: ppUrl },
                                                        caption: pingText
                                                }, { quoted: m });
                                        } else {
                                                await m.reply({ edit: msg.key, text: pingText });
                                        }
                                        
                                        logCommand(m, hisoka, 'ping');
                                } catch (err) {
                                        console.error('\x1b[31mPing error:\x1b[39m', err.message);
                                }
                                break;
                        }

                        case '>':
                        case 'eval': {
                                let result;
                                try {
                                        const code = query || text;
                                        result = /await/i.test(code) ? await eval('(async() => { ' + code + ' })()') : await eval(code);
                                } catch (error) {
                                        result = error;
                                }

                                await m.reply(util.format(result));
                                logCommand(m, hisoka, 'eval');
                                break;
                        }

                        case '$':
                        case 'bash': {
                                try {
                                        exec(query, (error, stdout, stderr) => {
                                                if (error) {
                                                        return m.throw(util.format(error));
                                                }
                                                if (stderr) {
                                                        return m.throw(stderr);
                                                }
                                                if (stdout) {
                                                        return m.reply(stdout);
                                                }
                                                return m.throw('Command executed successfully, but no output.');
                                        });
                                        logCommand(m, hisoka, 'bash');
                                } catch (error) {
                                        await m.reply(util.format(error));
                                        return;
                                }
                                break;
                        }

                        case 'group':
                        case 'listgroup': {
                                const groups = Object.values(await hisoka.groupFetchAllParticipating());
                                groups.map(g => hisoka.groups.write(g.id, g));

                                let text = `*Total ${groups.length} groups*\n`;
                                text += `\n*Total Participants in all groups:* ${Array.from(groups).reduce(
                                        (a, b) => a + b.participants.length,
                                        0
                                )}\n\n`;
                                groups
                                        .filter(group => isJidGroup(group.id))
                                        .forEach((group, i) => {
                                                text += `${i + 1}. *${group.subject}* - ${group.participants.length} participants\n`;
                                        });

                                await m.reply(text.trim());
                                logCommand(m, hisoka, 'groups');
                                break;
                        }

                        case 'contact':
                        case 'listcontact': {
                                const contacts = Array.from(hisoka.contacts.values()).filter(c => c.id);
                                let text = '*Total:*\n\n';
                                text += `- All Contacts: ${contacts.length}\n`;
                                text += `- Saved Contacts: ${contacts.filter(v => v.isContact).length}\n`;
                                text += `- Not Saved Contacts: ${contacts.filter(v => !v.isContact).length}\n`;
                                await m.reply(text.trim());
                                logCommand(m, hisoka, 'contacts');
                                break;
                        }

                        case 'menu': {
                                const uptime = process.uptime();
                                const hours = Math.floor(uptime / 3600);
                                const minutes = Math.floor((uptime % 3600) / 60);
                                const readMore = String.fromCharCode(8206).repeat(4001)
                                
                                let text = `
╭═════『 *LIST MENU* 』═════╮
║ 🤖 Bot Aktif Selama : ${hours}h ${minutes}m
╰═════════════════════╯

╭───〔 *Basic* 〕
│ ∘ .menu
│ ∘ .ping
│ ∘ .info
│ ∘ .memory
│ ∘ .ram
╰───────────────╯
${readMore}
╭───〔 *Auto Response* 〕
│ ∘ .typing
│ ∘ .recording
│ ∘ .online
│ ∘ .readsw
│ ∘ .addemoji
│ ∘ .delemoji
│ ∘ .listemoji
│ ∘ .antidel
│ ∘ .anticall
│ ∘ .anticallvid
│ ∘ .telegram
╰───────────────╯

╭───〔 *Group & Message* 〕
│ ∘ .hidetag
│ ∘ .quoted
│ ∘ .rvo
│ ∘ .s
│ ∘ .toimg
╰───────────────╯

╭───〔 *Channel React* 〕
│ ∘ .react
│ ∘ .cekreact
│ ∘ .setreactapi
╰───────────────╯

╭───〔 *Download* 〕
│ ∘ .play
│ ∘ .ytmp3
│ ∘ .ytmp4
│ ∘ .tt
│ ∘ .ig
│ ∘ .fb
╰───────────────╯

╭───〔 *Owner* 〕
│ ∘ .listowner
│ ∘ .addowner
│ ∘ .delowner
╰───────────────╯

╭───〔 *Advanced* 〕
│ ∘ .eval
│ ∘ .bash
╰───────────────╯

╭───〔 *Other* 〕
│ ∘ .simi
│ ∘ .group
│ ∘ .contact
╰───────────────╯`;

                                const imagePath = path.join(process.cwd(), 'img', 'menu.png');
                                if (fs.existsSync(imagePath)) {
                                        await hisoka.sendMessage(m.from, {
                                                image: fs.readFileSync(imagePath),
                                                caption: text
                                        }, { quoted: m });
                                } else {
                                        await m.reply(text);
                                }
                                logCommand(m, hisoka, 'menu');
                                break;
                        }

                        case 'info': {
                                try {
                                        const config = loadConfig();
                                        
                                        const autoTyping = config.autoTyping || {};
                                        const autoRecording = config.autoRecording || {};
                                        const autoOnline = config.autoOnline || {};
                                        const autoReadStory = config.autoReadStory || {};
                                        const antiDelete = config.antiDelete || {};
                                        const antiCall = config.antiCall || {};
                                        const antiCallVideo = config.antiCallVideo || {};
                                        const telegram = config.telegram || {};
                                        const autoSimi = config.autoSimi || {};
                                        
                                        const statusIcon = (enabled) => enabled ? '✅' : '❌';
                                        
                                        const features = [
                                                {
                                                        name: 'Auto Typing',
                                                        icon: '📝',
                                                        enabled: autoTyping.enabled,
                                                        details: autoTyping.enabled ? [
                                                                `├ Private: ${statusIcon(autoTyping.privateChat !== false)}`,
                                                                `├ Group: ${statusIcon(autoTyping.groupChat !== false)}`,
                                                                `└ Delay: ${autoTyping.delaySeconds || 5}s`
                                                        ] : []
                                                },
                                                {
                                                        name: 'Auto Recording',
                                                        icon: '🎤',
                                                        enabled: autoRecording.enabled,
                                                        details: autoRecording.enabled ? [
                                                                `├ Private: ${statusIcon(autoRecording.privateChat !== false)}`,
                                                                `├ Group: ${statusIcon(autoRecording.groupChat !== false)}`,
                                                                `└ Delay: ${autoRecording.delaySeconds || 5}s`
                                                        ] : []
                                                },
                                                {
                                                        name: 'Auto Online',
                                                        icon: '🟢',
                                                        enabled: autoOnline.enabled,
                                                        details: autoOnline.enabled ? [
                                                                `└ Interval: ${autoOnline.intervalSeconds || 30}s`
                                                        ] : []
                                                },
                                                {
                                                        name: 'Auto Read Story',
                                                        icon: '👁️',
                                                        enabled: autoReadStory.enabled,
                                                        details: autoReadStory.enabled ? [
                                                                `├ Reaction: ${statusIcon(autoReadStory.autoReaction !== false)}`,
                                                                `└ Random Delay: ${statusIcon(autoReadStory.randomDelay !== false)}`
                                                        ] : []
                                                },
                                                {
                                                        name: 'Auto Simi',
                                                        icon: '🤖',
                                                        enabled: autoSimi.enabled,
                                                        details: autoSimi.enabled ? [
                                                                `└ Group Only: ✅`
                                                        ] : []
                                                },
                                                {
                                                        name: 'Anti Delete',
                                                        icon: '🗑️',
                                                        enabled: antiDelete.enabled,
                                                        details: antiDelete.enabled ? [
                                                                `├ Private: ${statusIcon(antiDelete.privateChat)}`,
                                                                `└ Group: ${statusIcon(antiDelete.groupChat)}`
                                                        ] : []
                                                },
                                                {
                                                        name: 'Telegram Notif',
                                                        icon: '📲',
                                                        enabled: telegram.enabled,
                                                        details: telegram.enabled ? [
                                                                `└ Chat ID: ${telegram.chatId ? '✅ Terset' : '❌ Belum'}`
                                                        ] : []
                                                },
                                                                {
                                                                        name: 'Anti Call',
                                                                        icon: '📞',
                                                                        enabled: antiCall.enabled,
                                                                        details: antiCall.enabled ? [
                                                                                `└ Whitelist: ${(antiCall.whitelist || []).length} nomor`
                                                                        ] : []
                                                                },
                                                                {
                                                                        name: 'Anti Call Video',
                                                                        icon: '📹',
                                                                        enabled: antiCallVideo.enabled,
                                                                        details: antiCallVideo.enabled ? [
                                                                                `└ Whitelist: ${(antiCallVideo.whitelist || []).length} nomor`
                                                                        ] : []
                                                                }
                                        ];
                                        
                                        const activeFeatures = features.filter(f => f.enabled);
                                        const inactiveFeatures = features.filter(f => !f.enabled);
                                        const sortedFeatures = [...activeFeatures, ...inactiveFeatures];
                                        
                                        const userName = m.pushName || 'Kak';
                                        
                                        let text = `Halo ${userName}! Berikut info bot:\n\n`;
text += `╭═══『 *INFO BOT* 』═══╮\n`;
text += `│\n`;

for (const feature of sortedFeatures) {
    text += `│ ${feature.icon} *${feature.name}*\n`;
    text += `│ ${statusIcon(feature.enabled)} ${feature.enabled ? 'Aktif' : 'Nonaktif'}\n`;
    for (const detail of feature.details) {
        text += `│ ${detail}\n`;
    }
    text += `│\n`;
}

text += `╰═════════════════════╯\n`;
text += `\n_Gunakan command masing-masing fitur untuk mengubah pengaturan, ${userName}_`;
                                        
                                        const imagePath = path.join(process.cwd(), 'img', 'menu.png');
                                        if (fs.existsSync(imagePath)) {
                                                await hisoka.sendMessage(m.from, {
                                                        image: fs.readFileSync(imagePath),
                                                        caption: text
                                                }, { quoted: m });
                                        } else {
                                                await m.reply(text);
                                        }
                                        logCommand(m, hisoka, 'info');
                                } catch (error) {
                                        console.error('\x1b[31m[Info] Error:\x1b[39m', error.message);
                                        await m.reply(`Mohon maaf, terjadi kesalahan: ${error.message}`);
                                }
                                break;
                        }

                        case 'addown':
                        case 'addowner': {
                                if (!isMainBot(hisoka)) return;
                                if (!m.isOwner) return;
                                try {
                                        if (!m.isOwner) {
                                                await m.reply('Mohon maaf, Kak. Fitur ini hanya untuk owner bot.');
                                                break;
                                        }
                                        
                                        if (!query) {
                                                await m.reply('Mohon masukkan nomor yang ingin ditambahkan.\n\nContoh:\n.addowner 6289667923162\n.addowner +62 896-6792-3162');
                                                break;
                                        }
                                        
                                        const cleanNumber = query.replace(/[\s\-\+\(\)]/g, '').replace(/^0/, '62');
                                        
                                        if (!/^\d{10,15}$/.test(cleanNumber)) {
                                                await m.reply('Format nomor tidak valid, Kak. Pastikan nomor telepon benar.');
                                                break;
                                        }
                                        
                                        const config = loadConfig();
                                        const owners = config.owners || [];
                                        
                                        if (owners.includes(cleanNumber)) {
                                                await m.reply(`Nomor ${cleanNumber} sudah terdaftar sebagai owner, Kak.`);
                                                break;
                                        }
                                        
                                        owners.push(cleanNumber);
                                        config.owners = owners;
                                        saveConfig(config);
                                        
                                        await m.reply(`✅ Berhasil menambahkan owner baru!\n\n📞 Nomor: ${cleanNumber}\n👥 Total Owner: ${owners.length}`);
                                        logCommand(m, hisoka, 'addowner');
                                } catch (error) {
                                        console.error('\x1b[31m[AddOwner] Error:\x1b[39m', error.message);
                                        await m.reply(`Mohon maaf, terjadi kesalahan: ${error.message}`);
                                }
                                break;
                        }

                        case 'delown':
                        case 'delowner': {
                                if (!isMainBot(hisoka)) return;
                                if (!m.isOwner) return;
                                try {
                                        if (!m.isOwner) {
                                                await m.reply('Mohon maaf, Kak. Fitur ini hanya untuk owner bot.');
                                                break;
                                        }
                                        
                                        if (!query) {
                                                await m.reply('Mohon masukkan nomor yang ingin dihapus.\n\nContoh:\n.delowner 6289667923162');
                                                break;
                                        }
                                        
                                        const cleanNumber = query.replace(/[\s\-\+\(\)]/g, '').replace(/^0/, '62');
                                        
                                        const config = loadConfig();
                                        const owners = config.owners || [];
                                        
                                        if (!owners.includes(cleanNumber)) {
                                                await m.reply(`Nomor ${cleanNumber} tidak terdaftar sebagai owner, Kak.`);
                                                break;
                                        }
                                        
                                        if (owners.length <= 1) {
                                                await m.reply('Tidak bisa menghapus owner terakhir, Kak. Minimal harus ada 1 owner.');
                                                break;
                                        }
                                        
                                        const newOwners = owners.filter(o => o !== cleanNumber);
                                        config.owners = newOwners;
                                        saveConfig(config);
                                        
                                        await m.reply(`✅ Berhasil menghapus owner!\n\n📞 Nomor: ${cleanNumber}\n👥 Sisa Owner: ${newOwners.length}`);
                                        logCommand(m, hisoka, 'delowner');
                                } catch (error) {
                                        console.error('\x1b[31m[DelOwner] Error:\x1b[39m', error.message);
                                        await m.reply(`Mohon maaf, terjadi kesalahan: ${error.message}`);
                                }
                                break;
                        }

                        case 'owner':
                        case 'own': {
                                try {
                                        const config = loadConfig();
                                        const owners = config.owners || [];
                                        
                                        if (owners.length === 0) {
                                                await m.reply('Belum ada owner yang terdaftar.');
                                                break;
                                        }
                                        
                                        let text = `╭═══『 *DAFTAR OWNER* 』═══╮\n`;
text += `│\n`;
text += `│ 👥 *Total:* ${owners.length} owner\n`;
text += `│\n`;

owners.forEach((owner, index) => {
    text += `│ ${index + 1}. 📞 ${owner}\n`;
});

text += `│\n`;
text += `╰═════════════════════╯\n`;
text += `\n*Command:*\n`;
text += `.addowner <nomor> - Tambah owner\n`;
text += `.delowner <nomor> - Hapus owner`;
                                        
                                        await m.reply(text);
                                        logCommand(m, hisoka, 'listowner');
                                } catch (error) {
                                        console.error('\x1b[31m[ListOwner] Error:\x1b[39m', error.message);
                                        await m.reply(`Mohon maaf, terjadi kesalahan: ${error.message}`);
                                }
                                break;
                        }

                        case 'memory': {
                                try {
                                        const memMonitor = global.memoryMonitor;
                                        if (!memMonitor) {
                                                await m.reply('Memory monitor tidak tersedia.');
                                                break;
                                        }

                                        const status = memMonitor.getStatus();
                                        const uptime = process.uptime();

                                        let text = `╭═══『 *💾 MEMORY STATUS* 』═══╮\n`;
text += `│\n`;
text += `│ *📊 Process Memory*\n`;
text += `│ • Current: ${status.currentFormatted}\n`;
text += `│ • Limit: ${status.limitFormatted}\n`;
text += `│ • Usage: ${status.percentage}%\n`;
text += `│\n`;
text += `│ *🔧 Heap Memory*\n`;
text += `│ • Total: ${status.heap.totalFormatted}\n`;
text += `│ • Used: ${status.heap.usedFormatted}\n`;
text += `│\n`;
text += `│ *🖥️ System Memory (Server)*\n`;
text += `│ • Total: ${status.system.totalFormatted}\n`;
text += `│ • Used: ${status.system.usedFormatted}\n`;
text += `│ • Free: ${status.system.freeFormatted}\n`;
text += `│\n`;
text += `│ *⚙️ Monitor Config*\n`;
text += `│ • Enabled: ${status.enabled ? '✅ Yes' : '❌ No'}\n`;
text += `│ • Auto Detect: ${status.autoDetect ? '✅ ' + status.autoDetectPercentage + '%' : '❌ Manual'}\n`;
text += `│ • Check Interval: ${status.checkInterval / 1000}s\n`;
text += `│ • Log Usage: ${status.logUsage ? '✅ Yes' : '❌ No'}\n`;
text += `│ • Uptime: ${msToTime(uptime * 1000)}\n`;
text += `│\n`;
text += `╰═════════════════════╯`;

                                        if (parseFloat(status.percentage) >= 80) {
                                                text += `\n\n⚠️ *Warning:* Memory usage tinggi! Auto-restart akan terjadi jika mencapai limit.`;
                                        }

                                        await m.reply(text);
                                        logCommand(m, hisoka, 'memory');
                                } catch (error) {
                                        console.error('\x1b[31m[Memory] Error:\x1b[39m', error.message);
                                        await m.reply(`Error: ${error.message}`);
                                }
                                break;
                        }

                        case 'rvo':
                        case 'vo': {
                                try {
                                        if (!m.isQuoted) {
                                                await m.reply(`*📱 Cara Penggunaan View Once*

*Command:* .rvo / .viewonce / .vo
*Action:* Reply pesan view once yang ingin dibuka

*Format yang Didukung:*
• 🖼️ Gambar View Once
• 🎥 Video View Once
• 🎵 Audio View Once
• 📄 Dokumen View Once
• 🏷️ Sticker View Once

*Contoh Penggunaan:*
1. Reply pesan view once
2. Ketik: .rvo
3. Media akan dikirim ulang tanpa view once`);
                                                break;
                                        }

                                        const quotedMsg = m.content?.contextInfo?.quotedMessage;
                                        if (!quotedMsg) {
                                                await m.reply('Tidak ada pesan yang di-reply.');
                                                break;
                                        }

                                        const mediaInfo = extractMediaFromMessage(quotedMsg);

                                        if (!mediaInfo) {
                                                await m.reply('Media tidak ditemukan dalam pesan yang di-reply.');
                                                break;
                                        }

                                        if (!mediaInfo.isViewOnce) {
                                                await m.reply('Pesan ini bukan view once. Gunakan command ini hanya untuk pesan view once.');
                                                break;
                                        }

                                        await hisoka.sendMessage(m.from, { react: { text: '⏳', key: m.key } });

                                        const contextInfo = m.content?.contextInfo;
                                        const quotedParticipant = contextInfo?.participant;
                                        const quotedStanzaId = contextInfo?.stanzaId;

                                        const messageKey = {
                                                remoteJid: m.from,
                                                fromMe: quotedParticipant ? false : (contextInfo?.fromMe || false),
                                                id: quotedStanzaId,
                                                participant: isJidGroup(m.from) ? quotedParticipant : undefined
                                        };

                                        let downloadMessage = {};
                                        downloadMessage[mediaInfo.mediaType] = mediaInfo.mediaMessage;

                                        const buffer = await downloadMediaMessage(
                                                {
                                                        message: downloadMessage,
                                                        key: messageKey
                                                },
                                                'buffer',
                                                {},
                                                {
                                                        logger: hisoka.logger,
                                                        reuploadRequest: hisoka.updateMediaMessage
                                                }
                                        );

                                        const jakartaTime = new Date().toLocaleString('id-ID', {
                                                timeZone: 'Asia/Jakarta',
                                                weekday: 'long',
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                second: '2-digit'
                                        });

                                        const caption = mediaInfo.mediaMessage.caption || '';
                                        let mediaTypeDisplay = '';
                                        let sendOptions = {};

                                        const formatCaption = (type, originalCaption = '') => {
                                                return `╭═══『 *📱 VIEW ONCE MEDIA* 』═══╮
│
│ *🎯 Type:* ${type}
│ *⏰ Waktu:* ${jakartaTime} WIB
│ *💬 Caption:* ${originalCaption || 'No caption'}
│ *📱 Sender:* ${m.quoted?.pushName || m.pushName || 'Unknown'}
│ *✅ Status:* Berhasil dibuka
│
╰═════════════════════╯

_📱 View once berhasil dibuka!_`;
                                        };

                                        switch (mediaInfo.mediaType) {
                                                case 'imageMessage':
                                                        mediaTypeDisplay = '🖼️ Image';
                                                        sendOptions = {
                                                                image: buffer,
                                                                caption: formatCaption(mediaTypeDisplay, caption)
                                                        };
                                                        break;

                                                case 'videoMessage':
                                                        mediaTypeDisplay = '🎥 Video';
                                                        sendOptions = {
                                                                video: buffer,
                                                                caption: formatCaption(mediaTypeDisplay, caption)
                                                        };
                                                        break;

                                                case 'audioMessage':
                                                        mediaTypeDisplay = '🎵 Audio';
                                                        sendOptions = {
                                                                audio: buffer,
                                                                mimetype: mediaInfo.mediaMessage.mimetype || 'audio/ogg; codecs=opus',
                                                                ptt: mediaInfo.mediaMessage.ptt || false
                                                        };
                                                        break;

                                                case 'documentMessage':
                                                        mediaTypeDisplay = '📄 Document';
                                                        sendOptions = {
                                                                document: buffer,
                                                                caption: formatCaption(mediaTypeDisplay, caption),
                                                                mimetype: mediaInfo.mediaMessage.mimetype || 'application/octet-stream',
                                                                fileName: mediaInfo.mediaMessage.fileName || 'ViewOnce_Document'
                                                        };
                                                        break;

                                                case 'stickerMessage':
                                                        mediaTypeDisplay = '🏷️ Sticker';
                                                        sendOptions = {
                                                                sticker: buffer
                                                        };
                                                        break;

                                                default:
                                                        throw new Error(`Unsupported media type: ${mediaInfo.mediaType}`);
                                        }

                                        const myNumber = hisoka.user.id.split(':')[0] + '@s.whatsapp.net';
                                        await hisoka.sendMessage(myNumber, sendOptions);

                                        await hisoka.sendMessage(m.from, { react: { text: '✅', key: m.key } });

                                        logCommand(m, hisoka, 'rvo');
                                } catch (error) {
                                        console.error('\x1b[31m[RVO] Error:\x1b[39m', error.message);
                                        await hisoka.sendMessage(m.from, { react: { text: '❌', key: m.key } });
                                        await m.reply(`Gagal membuka view once: ${error.message}`);
                                }
                                break;
                        }

                        case 'ram': {
                                try {
                                        const { formatBytes, getCurrentMemoryUsage, getSystemMemoryInfo } = await import('../helper/memoryMonitor.js');
                                        
                                        const memUsage = getCurrentMemoryUsage();
                                        const systemMem = getSystemMemoryInfo();
                                        const memLimit = global.memoryMonitor?.memoryLimit || systemMem.total;
                                        const percentage = ((memUsage.rss / memLimit) * 100).toFixed(1);
                                        const systemPercentage = ((systemMem.used / systemMem.total) * 100).toFixed(1);
                                        
                                        let text = `╭═══『 *RAM STATUS* 』═══╮\n`;
text += `│\n`;
text += `│ *Process Memory*\n`;
text += `│ ${formatBytes(memUsage.rss)} / ${formatBytes(memLimit)}\n`;
text += `│ Usage: ${percentage}%\n`;
text += `│\n`;
text += `│ *System Memory*\n`;
text += `│ ${formatBytes(systemMem.used)} / ${formatBytes(systemMem.total)}\n`;
text += `│ Usage: ${systemPercentage}%\n`;
text += `│\n`;
text += `╰═════════════════════╯`;
                                        
                                        await m.reply(text);
                                        logCommand(m, hisoka, 'cekram');
                                } catch (error) {
                                        console.error('\x1b[31m[CekRAM] Error:\x1b[39m', error.message);
                                        await m.reply(`Error: ${error.message}`);
                                }
                                break;
                        }

                        case 'typing':
                        case 'typ': {
                                if (!isMainBot(hisoka)) return;
                                if (!m.isOwner) return;
                                try {
                                        const config = loadConfig();
                                        const autoTyping = config.autoTyping || { enabled: false, delaySeconds: 5, privateChat: true, groupChat: true };
                                        const args = query ? query.toLowerCase().split(' ') : [];
                                        
                                        if (args.length === 0) {
                                                let text = `╭═══『 *AUTO TYPING* 』═══╮\n`;
text += `│\n`;
text += `│ *Status:* ${autoTyping.enabled ? '✅ Aktif' : '❌ Nonaktif'}\n`;
text += `│ *Delay:* ${autoTyping.delaySeconds || 5} detik\n`;
text += `│ *Private Chat:* ${autoTyping.privateChat !== false ? '✅' : '❌'}\n`;
text += `│ *Group Chat:* ${autoTyping.groupChat !== false ? '✅' : '❌'}\n`;
text += `│\n`;
text += `│ *Penggunaan:*\n`;
text += `│ .typing on/off\n`;
text += `│ .typing set <detik>\n`;
text += `│ .typing private on/off\n`;
text += `│ .typing group on/off\n`;
text += `│\n`;
text += `╰═════════════════════╯`;
                                                await m.reply(text);
                                                break;
                                        }
                                        
                                        if (args[0] === 'on') {
                                                if (autoTyping.enabled) {
                                                        await m.reply('ℹ️ Auto Typing sudah aktif sebelumnya');
                                                } else {
                                                        config.autoTyping = { ...autoTyping, enabled: true };
                                                        saveConfig(config);
                                                        await m.reply('✅ Auto Typing diaktifkan');
                                                }
                                        } else if (args[0] === 'off') {
                                                if (!autoTyping.enabled) {
                                                        await m.reply('ℹ️ Auto Typing sudah nonaktif sebelumnya');
                                                } else {
                                                        config.autoTyping = { ...autoTyping, enabled: false };
                                                        saveConfig(config);
                                                        await m.reply('❌ Auto Typing dinonaktifkan');
                                                }
                                        } else if (args[0] === 'set' && args[1]) {
                                                const seconds = parseInt(args[1]);
                                                if (isNaN(seconds) || seconds < 1 || seconds > 60) {
                                                        await m.reply('❌ Delay harus antara 1-60 detik');
                                                        break;
                                                }
                                                config.autoTyping = { ...autoTyping, delaySeconds: seconds };
                                                saveConfig(config);
                                                await m.reply(`✅ Delay Auto Typing diset ke ${seconds} detik`);
                                        } else if (args[0] === 'private' && args[1]) {
                                                const enabled = args[1] === 'on';
                                                config.autoTyping = { ...autoTyping, privateChat: enabled };
                                                saveConfig(config);
                                                await m.reply(`${enabled ? '✅' : '❌'} Auto Typing untuk Private Chat ${enabled ? 'diaktifkan' : 'dinonaktifkan'}`);
                                        } else if (args[0] === 'group' && args[1]) {
                                                const enabled = args[1] === 'on';
                                                config.autoTyping = { ...autoTyping, groupChat: enabled };
                                                saveConfig(config);
                                                await m.reply(`${enabled ? '✅' : '❌'} Auto Typing untuk Group Chat ${enabled ? 'diaktifkan' : 'dinonaktifkan'}`);
                                        } else {
                                                await m.reply('❌ Perintah tidak valid. Gunakan .typing untuk melihat bantuan.');
                                        }
                                        
                                        logCommand(m, hisoka, 'typing');
                                } catch (error) {
                                        console.error('\x1b[31m[Typing] Error:\x1b[39m', error.message);
                                        await m.reply(`Error: ${error.message}`);
                                }
                                break;
                        }

                        case 'recording':
                        case 'record': {
                                if (!isMainBot(hisoka)) return;
                                if (!m.isOwner) return;
                                try {
                                        const config = loadConfig();
                                        const autoRecording = config.autoRecording || { enabled: false, delaySeconds: 5, privateChat: true, groupChat: true };
                                        const args = query ? query.toLowerCase().split(' ') : [];
                                        
                                        if (args.length === 0) {
                                                let text = `╭═══『 *AUTO RECORDING* 』═══╮\n`;
text += `│\n`;
text += `│ *Status:* ${autoRecording.enabled ? '✅ Aktif' : '❌ Nonaktif'}\n`;
text += `│ *Delay:* ${autoRecording.delaySeconds || 5} detik\n`;
text += `│ *Private Chat:* ${autoRecording.privateChat !== false ? '✅' : '❌'}\n`;
text += `│ *Group Chat:* ${autoRecording.groupChat !== false ? '✅' : '❌'}\n`;
text += `│\n`;
text += `│ *Penggunaan:*\n`;
text += `│ .recording on/off\n`;
text += `│ .recording set <detik>\n`;
text += `│ .recording private on/off\n`;
text += `│ .recording group on/off\n`;
text += `│\n`;
text += `╰═════════════════════╯`;
                                                await m.reply(text);
                                                break;
                                        }
                                        
                                        if (args[0] === 'on') {
                                                if (autoRecording.enabled) {
                                                        await m.reply('ℹ️ Auto Recording sudah aktif sebelumnya');
                                                } else {
                                                        config.autoRecording = { ...autoRecording, enabled: true };
                                                        saveConfig(config);
                                                        await m.reply('✅ Auto Recording diaktifkan');
                                                }
                                        } else if (args[0] === 'off') {
                                                if (!autoRecording.enabled) {
                                                        await m.reply('ℹ️ Auto Recording sudah nonaktif sebelumnya');
                                                } else {
                                                        config.autoRecording = { ...autoRecording, enabled: false };
                                                        saveConfig(config);
                                                        await m.reply('❌ Auto Recording dinonaktifkan');
                                                }
                                        } else if (args[0] === 'set' && args[1]) {
                                                const seconds = parseInt(args[1]);
                                                if (isNaN(seconds) || seconds < 1 || seconds > 60) {
                                                        await m.reply('❌ Delay harus antara 1-60 detik');
                                                        break;
                                                }
                                                config.autoRecording = { ...autoRecording, delaySeconds: seconds };
                                                saveConfig(config);
                                                await m.reply(`✅ Delay Auto Recording diset ke ${seconds} detik`);
                                        } else if (args[0] === 'private' && args[1]) {
                                                const enabled = args[1] === 'on';
                                                config.autoRecording = { ...autoRecording, privateChat: enabled };
                                                saveConfig(config);
                                                await m.reply(`${enabled ? '✅' : '❌'} Auto Recording untuk Private Chat ${enabled ? 'diaktifkan' : 'dinonaktifkan'}`);
                                        } else if (args[0] === 'group' && args[1]) {
                                                const enabled = args[1] === 'on';
                                                config.autoRecording = { ...autoRecording, groupChat: enabled };
                                                saveConfig(config);
                                                await m.reply(`${enabled ? '✅' : '❌'} Auto Recording untuk Group Chat ${enabled ? 'diaktifkan' : 'dinonaktifkan'}`);
                                        } else {
                                                await m.reply('❌ Perintah tidak valid. Gunakan .recording untuk melihat bantuan.');
                                        }
                                        
                                        logCommand(m, hisoka, 'recording');
                                } catch (error) {
                                        console.error('\x1b[31m[Recording] Error:\x1b[39m', error.message);
                                        await m.reply(`Error: ${error.message}`);
                                }
                                break;
                        }

                        case 'simi': {
                                if (!isMainBot(hisoka)) return;
                                if (!m.isOwner) return;
                                try {
                                        const config = loadConfig();
                                        const autoSimi = config.autoSimi || { enabled: false, apiKey: '' };
                                        const args = query ? query.split(' ') : [];
                                        
                                        if (args.length === 0) {
                                                const hasKey = autoSimi.apiKey && autoSimi.apiKey.length > 10;
                                                const maskedKey = hasKey ? `${autoSimi.apiKey.slice(0, 8)}...${autoSimi.apiKey.slice(-4)}` : 'Belum diset';
                                                
                                                let text = `╭═══『 *SIMI* 』═══╮\n`;
text += `│\n`;
text += `│ *Status:* ${autoSimi.enabled ? '✅ Aktif' : '❌ Nonaktif'}\n`;
text += `│ *API Key:* ${maskedKey}\n`;
text += `│ *AI Model:* Llama 3.1 (Groq)\n`;
text += `│ *Mode:* Group Only\n`;
text += `│ *Trigger:* Reply pesan bot\n`;
text += `│\n`;
text += `│ *Info:*\n`;
text += `│ Bot akan otomatis membalas\n`;
text += `│ ketika seseorang mereply\n`;
text += `│ pesan bot di grup.\n`;
text += `│\n`;
text += `│ *Penggunaan:*\n`;
text += `│ .autosimi on/off\n`;
text += `│ .autosimi key <api_key>\n`;
text += `│\n`;
text += `│ *Dapatkan API Key Gratis:*\n`;
text += `│ https://console.groq.com\n`;
text += `│ (14,400 request/hari GRATIS)\n`;
text += `│\n`;
text += `╰═════════════════════╯`;
                                                await m.reply(text);
                                                break;
                                        }
                                        
                                        if (args[0].toLowerCase() === 'on') {
                                                if (!autoSimi.apiKey) {
                                                        await m.reply('❌ API Key belum diset!\n\nGunakan: .autosimi key <api_key>\n\nDapatkan API key gratis di: https://console.groq.com');
                                                } else if (autoSimi.enabled) {
                                                        await m.reply('ℹ️ Auto Simi sudah aktif sebelumnya');
                                                } else {
                                                        config.autoSimi = { ...autoSimi, enabled: true };
                                                        saveConfig(config);
                                                        await m.reply('✅ Auto Simi diaktifkan\n\n🤖 Bot akan membalas otomatis ketika ada yang reply pesan bot di grup.');
                                                }
                                        } else if (args[0].toLowerCase() === 'off') {
                                                if (!autoSimi.enabled) {
                                                        await m.reply('ℹ️ Auto Simi sudah nonaktif sebelumnya');
                                                } else {
                                                        config.autoSimi = { ...autoSimi, enabled: false };
                                                        saveConfig(config);
                                                        await m.reply('❌ Auto Simi dinonaktifkan');
                                                }
                                        } else if (args[0].toLowerCase() === 'key' && args[1]) {
                                                const newKey = args.slice(1).join(' ').trim();
                                                if (newKey.length < 20) {
                                                        await m.reply('❌ API Key tidak valid. Pastikan key dari https://console.groq.com');
                                                } else {
                                                        config.autoSimi = { ...autoSimi, apiKey: newKey };
                                                        saveConfig(config);
                                                        await m.reply(`✅ API Key berhasil diset!\n\nGunakan .autosimi on untuk mengaktifkan.`);
                                                }
                                        } else {
                                                await m.reply('❌ Perintah tidak valid. Gunakan .autosimi untuk melihat bantuan.');
                                        }
                                        
                                        logCommand(m, hisoka, 'autosimi');
                                } catch (error) {
                                        console.error('\x1b[31m[AutoSimi] Error:\x1b[39m', error.message);
                                        await m.reply(`Error: ${error.message}`);
                                }
                                break;
                        }

                        case 'antidel':
                        case 'ad': {
                                if (!isMainBot(hisoka)) return;
                                if (!m.isOwner) return;
                                try {
                                        const config = loadConfig();
                                        const antiDelete = config.antiDelete || { enabled: false, privateChat: false, groupChat: false };
                                        const args = query ? query.toLowerCase().split(' ') : [];
                                        
                                        const bothEnabled = antiDelete.privateChat && antiDelete.groupChat;
                                        
                                        if (args.length === 0) {
                                                let text = `╭═══『 *ANTI DELETE* 』═══╮\n`;
text += `│\n`;
text += `│ *Status:* ${antiDelete.enabled ? '✅ Aktif' : '❌ Nonaktif'}\n`;
text += `│ *Private Chat:* ${antiDelete.privateChat ? '✅' : '❌'}\n`;
text += `│ *Group Chat:* ${antiDelete.groupChat ? '✅' : '❌'}\n`;
text += `│\n`;
if (bothEnabled && antiDelete.enabled) {
    text += `│ ⚠️ *Catatan:*\n`;
    text += `│ Private & Group aktif bersamaan\n`;
    text += `│ dapat menyebabkan banyak notifikasi.\n`;
    text += `│ Disarankan aktifkan salah satu saja.\n`;
    text += `│\n`;
}
text += `│ *Info:*\n`;
text += `│ Pesan yang dihapus akan dikirim\n`;
text += `│ ke chat pribadi bot Anda.\n`;
text += `│\n`;
text += `│ *Didukung:*\n`;
text += `│ • Teks, Gambar, Video\n`;
text += `│ • Audio, Sticker, Dokumen\n`;
text += `│\n`;
text += `│ *Penggunaan:*\n`;
text += `│ .antidel on/off\n`;
text += `│ .antidel private on/off\n`;
text += `│ .antidel group on/off\n`;
text += `│ .antidel all on/off\n`;
text += `│\n`;
text += `╰═════════════════════╯`;
                                                await m.reply(text);
                                                break;
                                        }
                                        
                                        if (args[0] === 'on') {
                                                if (antiDelete.enabled) {
                                                        await m.reply('ℹ️ Anti Delete sudah aktif sebelumnya, Kak');
                                                } else {
                                                        config.antiDelete = { ...antiDelete, enabled: true };
                                                        saveConfig(config);
                                                        let reply = '✅ Anti Delete berhasil diaktifkan\n\n📨 Pesan yang dihapus akan dikirim ke chat pribadi bot';
                                                        if (antiDelete.privateChat && antiDelete.groupChat) {
                                                                reply += '\n\n⚠️ *Catatan:* Private & Group Chat keduanya aktif. Ini dapat menyebabkan banyak notifikasi.';
                                                        }
                                                        await m.reply(reply);
                                                }
                                        } else if (args[0] === 'off') {
                                                if (!antiDelete.enabled) {
                                                        await m.reply('ℹ️ Anti Delete sudah nonaktif sebelumnya, Kak');
                                                } else {
                                                        config.antiDelete = { ...antiDelete, enabled: false };
                                                        saveConfig(config);
                                                        await m.reply('✅ Anti Delete berhasil dinonaktifkan');
                                                }
                                        } else if (args[0] === 'private' && args[1]) {
                                                const enabled = args[1] === 'on';
                                                config.antiDelete = { ...antiDelete, privateChat: enabled };
                                                saveConfig(config);
                                                let reply = `${enabled ? '✅' : '❌'} Anti Delete untuk Private Chat berhasil ${enabled ? 'diaktifkan' : 'dinonaktifkan'}`;
                                                if (enabled && antiDelete.groupChat) {
                                                        reply += '\n\n⚠️ *Catatan:* Private & Group Chat keduanya aktif. Ini dapat menyebabkan banyak notifikasi.';
                                                }
                                                await m.reply(reply);
                                        } else if (args[0] === 'group' && args[1]) {
                                                const enabled = args[1] === 'on';
                                                config.antiDelete = { ...antiDelete, groupChat: enabled };
                                                saveConfig(config);
                                                let reply = `${enabled ? '✅' : '❌'} Anti Delete untuk Group Chat berhasil ${enabled ? 'diaktifkan' : 'dinonaktifkan'}`;
                                                if (enabled && antiDelete.privateChat) {
                                                        reply += '\n\n⚠️ *Catatan:* Private & Group Chat keduanya aktif. Ini dapat menyebabkan banyak notifikasi.';
                                                }
                                                await m.reply(reply);
                                        } else if (args[0] === 'all' && args[1]) {
                                                const enabled = args[1] === 'on';
                                                config.antiDelete = { ...antiDelete, privateChat: enabled, groupChat: enabled };
                                                saveConfig(config);
                                                let reply = `${enabled ? '✅' : '❌'} Anti Delete untuk Private & Group Chat berhasil ${enabled ? 'diaktifkan' : 'dinonaktifkan'}`;
                                                if (enabled) {
                                                        reply += '\n\n⚠️ *Catatan:* Mengaktifkan keduanya dapat menyebabkan banyak notifikasi. Gunakan dengan bijak ya, Kak.';
                                                }
                                                await m.reply(reply);
                                        } else {
                                                await m.reply('Mohon maaf, Kak. Perintah tidak valid.\nGunakan .antidel untuk melihat bantuan.');
                                        }
                                        
                                        logCommand(m, hisoka, 'antidel');
                                } catch (error) {
                                        console.error('\x1b[31m[AntiDelete] Error:\x1b[39m', error.message);
                                        await m.reply(`Mohon maaf, terjadi kesalahan: ${error.message}`);
                                }
                                break;
                        }

                        case 'readsw': {
                                if (!isMainBot(hisoka)) return;
                                if (!m.isOwner) return;
                                try {
                                        const config = loadConfig();
                                        const storyConfig = config.autoReadStory || {
                                                enabled: true,
                                                autoReaction: true,
                                                randomDelay: true,
                                                delayMinMs: 1000,
                                                delayMaxMs: 20000,
                                                fixedDelayMs: 3000
                                        };
                                        const args = query ? query.toLowerCase().split(' ') : [];
                                        
                                        if (args.length === 0) {
                                                let statusText = '';
                                                if (!storyConfig.enabled) {
                                                        statusText = '❌ Nonaktif';
                                                } else if (storyConfig.autoReaction !== false) {
                                                        statusText = '✅ Read + Reaction';
                                                } else {
                                                        statusText = '✅ Read Only';
                                                }
                                                
                                                let text = `╭═══『 *AUTO READ STORY* 』═══╮\n`;
text += `│\n`;
text += `│ *Status:* ${statusText}\n`;
text += `│ *Reaction:* ${storyConfig.autoReaction !== false ? '✅ Aktif' : '❌ Nonaktif'}\n`;
text += `│ *Random Delay:* ${storyConfig.randomDelay !== false ? '✅' : '❌'}\n`;
text += `│ *Delay Min:* ${(storyConfig.delayMinMs || 1000) / 1000} detik\n`;
text += `│ *Delay Max:* ${(storyConfig.delayMaxMs || 20000) / 1000} detik\n`;
text += `│ *Fixed Delay:* ${(storyConfig.fixedDelayMs || 3000) / 1000} detik\n`;
text += `│\n`;
text += `│ *Penggunaan:*\n`;
text += `│ .readsw true - Read + Reaction\n`;
text += `│ .readsw false - Read Only\n`;
text += `│ .readsw off - Nonaktifkan\n`;
text += `│ .readsw delay <min> <max>\n`;
text += `│   (dalam detik, contoh: delay 1 20)\n`;
text += `│\n`;
text += `╰═════════════════════╯`;
                                                await m.reply(text);
                                                break;
                                        }
                                        
                                        const buildStatusReply = (cfg, action) => {
                                                const delayMin = (cfg.delayMinMs || 1000) / 1000;
                                                const delayMax = (cfg.delayMaxMs || 20000) / 1000;
                                                const fixedDelay = (cfg.fixedDelayMs || 3000) / 1000;
                                                const isRandom = cfg.randomDelay !== false;
                                                const modeText = cfg.autoReaction !== false ? 'Read + Reaction' : 'Read Only';
                                                
                                                let text = `╭═══『 *AUTO READ STORY* 』═══╮\n`;
text += `│\n`;
text += `│ ${action}\n`;
text += `│\n`;
text += `│ *Mode:* ${modeText}\n`;
text += `│ *Delay:* ${isRandom ? `${delayMin}-${delayMax}s (random)` : `${fixedDelay}s (fixed)`}\n`;
text += `│\n`;
text += `╰═════════════════════╯`;
                                                return text;
                                        };
                                        
                                        if (args[0] === 'true' || args[0] === 'on') {
                                                if (storyConfig.enabled && storyConfig.autoReaction !== false) {
                                                        await m.reply('ℹ️ Auto Read Story + Reaction sudah aktif sebelumnya');
                                                } else {
                                                        config.autoReadStory = { ...storyConfig, enabled: true, autoReaction: true };
                                                        saveConfig(config);
                                                        await m.reply(buildStatusReply(config.autoReadStory, '✅ *Diaktifkan!*'));
                                                }
                                        } else if (args[0] === 'false') {
                                                if (storyConfig.enabled && storyConfig.autoReaction === false) {
                                                        await m.reply('ℹ️ Auto Read Story (tanpa reaction) sudah aktif sebelumnya');
                                                } else {
                                                        config.autoReadStory = { ...storyConfig, enabled: true, autoReaction: false };
                                                        saveConfig(config);
                                                        await m.reply(buildStatusReply(config.autoReadStory, '✅ *Diaktifkan (Read Only)!*'));
                                                }
                                        } else if (args[0] === 'off') {
                                                if (!storyConfig.enabled) {
                                                        await m.reply('ℹ️ Auto Read Story sudah nonaktif sebelumnya');
                                                } else {
                                                        config.autoReadStory = { ...storyConfig, enabled: false };
                                                        saveConfig(config);
                                                        await m.reply('❌ Auto Read Story dinonaktifkan');
                                                }
                                        } else if (args[0] === 'delay' && args[1] && args[2]) {
                                                const minDelay = parseInt(args[1]);
                                                const maxDelay = parseInt(args[2]);
                                                
                                                if (isNaN(minDelay) || isNaN(maxDelay)) {
                                                        await m.reply('❌ Delay harus berupa angka. Contoh: .readsw delay 1 20');
                                                        break;
                                                }
                                                
                                                if (minDelay < 1 || maxDelay > 60) {
                                                        await m.reply('❌ Delay min harus >= 1 detik dan max <= 60 detik');
                                                        break;
                                                }
                                                
                                                if (minDelay >= maxDelay) {
                                                        await m.reply('❌ Delay min harus lebih kecil dari delay max');
                                                        break;
                                                }
                                                
                                                config.autoReadStory = {
                                                        ...storyConfig,
                                                        delayMinMs: minDelay * 1000,
                                                        delayMaxMs: maxDelay * 1000,
                                                        randomDelay: true
                                                };
                                                saveConfig(config);
                                                await m.reply(buildStatusReply(config.autoReadStory, `✅ *Delay diubah!*`));
                                        } else if (args[0] === 'delay' && args[1] && !args[2]) {
                                                const fixedDelay = parseInt(args[1]);
                                                
                                                if (isNaN(fixedDelay) || fixedDelay < 1 || fixedDelay > 60) {
                                                        await m.reply('❌ Delay harus antara 1-60 detik');
                                                        break;
                                                }
                                                
                                                config.autoReadStory = {
                                                        ...storyConfig,
                                                        fixedDelayMs: fixedDelay * 1000,
                                                        randomDelay: false
                                                };
                                                saveConfig(config);
                                                await m.reply(buildStatusReply(config.autoReadStory, `✅ *Fixed delay diubah!*`));
                                        } else {
                                                await m.reply('❌ Perintah tidak valid. Gunakan .readsw untuk melihat bantuan.');
                                        }
                                        
                                        logCommand(m, hisoka, 'readsw');
                                } catch (error) {
                                        console.error('\x1b[31m[ReadSW] Error:\x1b[39m', error.message);
                                        await m.reply(`Error: ${error.message}`);
                                }
                                break;
                        }

                        case 'telegram':
                        case 'tele': {
                                if (!isMainBot(hisoka)) return;
                                if (!m.isOwner) return;
                                try {
                                        const config = loadConfig();
                                        const telegramConfig = config.telegram || {
                                                enabled: true,
                                                token: '',
                                                chatId: ''
                                        };
                                        const telegramQuery = m.query ? m.query.toLowerCase().trim() : '';
                                        const args = telegramQuery ? telegramQuery.split(' ') : [];
                                        const validCommands = ['on', 'off', 'true', 'false', 'token', 'chatid', 'chat_id', 'id', 'tutorial', 'help', 'test', 'cek', 'check'];
                                        
                                        const validateToken = async (token) => {
                                                try {
                                                        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
                                                        const data = await res.json();
                                                        if (data.ok) {
                                                                return { valid: true, botName: data.result.first_name, username: data.result.username };
                                                        }
                                                        return { valid: false, error: data.description };
                                                } catch (e) {
                                                        return { valid: false, error: e.message };
                                                }
                                        };
                                        
                                        const validateChatId = async (token, chatId) => {
                                                try {
                                                        const res = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${chatId}`);
                                                        const data = await res.json();
                                                        if (data.ok) {
                                                                return { valid: true, chatType: data.result.type, chatTitle: data.result.first_name || data.result.title };
                                                        }
                                                        return { valid: false, error: data.description };
                                                } catch (e) {
                                                        return { valid: false, error: e.message };
                                                }
                                        };
                                        
                                        const showHelp = async () => {
                                                const statusText = telegramConfig.enabled ? '✅ Aktif' : '❌ Nonaktif';
                                                
                                                let tokenStatus = '❌ Belum diset';
                                                let botInfo = '';
                                                if (telegramConfig.token) {
                                                        const tokenCheck = await validateToken(telegramConfig.token);
                                                        if (tokenCheck.valid) {
                                                                tokenStatus = `✅ Valid`;
                                                                botInfo = `\n┃ *Bot:* @${tokenCheck.username}`;
                                                        } else {
                                                                tokenStatus = `❌ Invalid`;
                                                        }
                                                }
                                                
                                                let chatIdStatus = '❌ Belum diset';
                                                let chatInfo = '';
                                                if (telegramConfig.chatId && telegramConfig.token) {
                                                        const chatCheck = await validateChatId(telegramConfig.token, telegramConfig.chatId);
                                                        if (chatCheck.valid) {
                                                                chatIdStatus = `✅ Valid`;
                                                                chatInfo = `\n┃ *Chat:* ${chatCheck.chatTitle}`;
                                                        } else {
                                                                chatIdStatus = `❌ Invalid`;
                                                        }
                                                } else if (telegramConfig.chatId && !telegramConfig.token) {
                                                        chatIdStatus = '⚠️ Set token dulu';
                                                }
                                                
                                                let text = `╭═══『 *TELEGRAM NOTIF* 』═══╮\n`;
text += `│\n`;
text += `│ *Status:* ${statusText}\n`;
text += `│ *Token:* ${tokenStatus}${botInfo}\n`;
text += `│ *Chat ID:* ${chatIdStatus}${chatInfo}\n`;
text += `│\n`;
text += `│ *Penggunaan:*\n`;
text += `│ .telegram on - Aktifkan\n`;
text += `│ .telegram off - Nonaktifkan\n`;
text += `│ .telegram token <token>\n`;
text += `│ .telegram chatid <id>\n`;
text += `│ .telegram test - Test kirim\n`;
text += `│ .telegram tutorial - Cara dapat\n`;
text += `│\n`;
text += `│ *Info:*\n`;
text += `│ Fitur ini mengirim story WA\n`;
text += `│ ke bot Telegram kamu\n`;
text += `│\n`;
text += `│ _Multi-prefix, tanpa titik_\n`;
text += `│ _bot tetap merespon_\n`;
text += `╰═════════════════╯`;
                                                return text;
                                        };
                                        
                                        const showTutorial = () => {
                                                let text = `╭═══『 *TUTORIAL TELEGRAM* 』═══╮\n`;
text += `│\n`;
text += `│ *📱 CARA DAPAT BOT TOKEN:*\n`;
text += `│\n`;
text += `│ 1. Buka Telegram\n`;
text += `│ 2. Cari @BotFather\n`;
text += `│ 3. Ketik /newbot\n`;
text += `│ 4. Masukkan nama bot\n`;
text += `│ 5. Masukkan username bot\n`;
text += `│    (harus diakhiri 'bot')\n`;
text += `│ 6. Copy token yang diberikan\n`;
text += `│ 7. Gunakan:\n`;
text += `│    .telegram token <token>\n`;
text += `│\n`;
text += `│ *🆔 CARA DAPAT CHAT ID:*\n`;
text += `│\n`;
text += `│ 1. Buka Telegram\n`;
text += `│ 2. Cari @userinfobot\n`;
text += `│ 3. Klik Start\n`;
text += `│ 4. Bot akan kirim ID kamu\n`;
text += `│ 5. Copy angka ID tersebut\n`;
text += `│ 6. Gunakan:\n`;
text += `│    .telegram chatid <id>\n`;
text += `│\n`;
text += `│ *⚠️ PENTING:*\n`;
text += `│ Setelah dapat token, kamu\n`;
text += `│ HARUS chat bot kamu dulu\n`;
text += `│ (klik Start) agar bot bisa\n`;
text += `│ mengirim pesan ke kamu!\n`;
text += `│\n`;
text += `╰═════════════════════╯`;
                                                return text;
                                        };
                                        
                                        if (args.length === 0 || !validCommands.includes(args[0])) {
                                                await m.reply(await showHelp());
                                                break;
                                        }
                                        
                                        if (args[0] === 'tutorial' || args[0] === 'help') {
                                                await m.reply(showTutorial());
                                        } else if (args[0] === 'test' || args[0] === 'cek' || args[0] === 'check') {
                                                if (!telegramConfig.token || !telegramConfig.chatId) {
                                                        await m.reply('❌ Token dan Chat ID harus diset dulu!\n\nGunakan .telegram tutorial untuk panduan.');
                                                        break;
                                                }
                                                
                                                try {
                                                        const testMsg = `✅ *Test Berhasil!*\n\nBot WhatsApp kamu berhasil terhubung ke Telegram.\n\n_Pesan ini dikirim pada ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}_`;
                                                        const res = await fetch(`https://api.telegram.org/bot${telegramConfig.token}/sendMessage`, {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                        chat_id: telegramConfig.chatId,
                                                                        text: testMsg,
                                                                        parse_mode: 'Markdown'
                                                                })
                                                        });
                                                        const data = await res.json();
                                                        
                                                        if (data.ok) {
                                                                await m.reply('✅ Test berhasil! Cek Telegram kamu.');
                                                        } else {
                                                                await m.reply(`❌ Gagal: ${data.description}\n\nPastikan kamu sudah Start bot di Telegram.`);
                                                        }
                                                } catch (e) {
                                                        await m.reply(`❌ Error: ${e.message}`);
                                                }
                                        } else if (args[0] === 'on' || args[0] === 'true') {
                                                if (telegramConfig.enabled) {
                                                        await m.reply('ℹ️ Telegram notifikasi sudah aktif sebelumnya');
                                                } else {
                                                        config.telegram = { ...telegramConfig, enabled: true };
                                                        saveConfig(config);
                                                        await m.reply('✅ Telegram notifikasi diaktifkan');
                                                }
                                        } else if (args[0] === 'off' || args[0] === 'false') {
                                                if (!telegramConfig.enabled) {
                                                        await m.reply('ℹ️ Telegram notifikasi sudah nonaktif sebelumnya');
                                                } else {
                                                        config.telegram = { ...telegramConfig, enabled: false };
                                                        saveConfig(config);
                                                        await m.reply('❌ Telegram notifikasi dinonaktifkan');
                                                }
                                        } else if (args[0] === 'token' && args[1]) {
                                                const token = (m.query || '').replace(/^token\s*/i, '').trim();
                                                config.telegram = { ...telegramConfig, token: token };
                                                saveConfig(config);
                                                await m.reply('✅ Token Telegram berhasil diupdate');
                                        } else if ((args[0] === 'chatid' || args[0] === 'chat_id' || args[0] === 'id') && args[1]) {
                                                const chatIdValue = (m.query || '').replace(/^(chatid|chat_id|id)\s*/i, '').trim();
                                                config.telegram = { ...telegramConfig, chatId: chatIdValue };
                                                saveConfig(config);
                                                await m.reply('✅ Chat ID Telegram berhasil diupdate');
                                        } else if (args[0] === 'token' && !args[1]) {
                                                await m.reply('❌ Format: .telegram token <bot_token>');
                                        } else if ((args[0] === 'chatid' || args[0] === 'chat_id' || args[0] === 'id') && !args[1]) {
                                                await m.reply('❌ Format: .telegram chatid <chat_id>');
                                        } else {
                                                await m.reply(showHelp());
                                        }
                                        
                                        logCommand(m, hisoka, 'telegram');
                                } catch (error) {
                                        console.error('\x1b[31m[Telegram] Error:\x1b[39m', error.message);
                                        await m.reply(`Error: ${error.message}`);
                                }
                                break;
                        }

                        case 'add': {
                                if (!isMainBot(hisoka)) return;
                                if (!m.isOwner) return;
                                if (!query || !query.toLowerCase().startsWith('emoji')) break;
                                try {
                                        const { addEmojis, listEmojis } = await import('../helper/emoji.js');
                                        
                                        const emojiInput = query.replace(/^emoji\s*/i, '').trim();
                                        
                                        if (!emojiInput) {
                                                await m.reply(`❌ Format: add emoji 😊,😄,😁\n\nContoh:\nadd emoji 😊\nadd emoji 😊,😄,😁`);
                                                break;
                                        }

                                        const emojisToAdd = emojiInput.split(',').map(e => e.trim()).filter(e => e);
                                        
                                        if (emojisToAdd.length === 0) {
                                                await m.reply('❌ Tidak ada emoji yang valid untuk ditambahkan');
                                                break;
                                        }

                                        const results = addEmojis(emojisToAdd);
                                        const newList = listEmojis();
                                        
                                        let response = `╭═══『 *ADD EMOJI* 』═══╮\n│\n`;

if (results.added.length > 0) {
    response += `│ ✅ *Berhasil (${results.added.length}):* ${results.added.join(',')}\n`;
}

if (results.alreadyExists.length > 0) {
    response += `│ ⚠️ *Sudah ada (${results.alreadyExists.length}):* ${results.alreadyExists.join(',')}\n`;
}

response += `│\n│ 📊 *Total:* ${newList.count} emoji\n`;
response += `│ *Daftar:* ${newList.emojis.join(',')}\n`;
response += `╰═════════════════╯`;
                                        
                                        await m.reply(response);
                                        logCommand(m, hisoka, 'add emoji');
                                } catch (error) {
                                        console.error('\x1b[31m[AddEmoji] Error:\x1b[39m', error.message);
                                        await m.reply(`Error: ${error.message}`);
                                }
                                break;
                        }

                        case 'del': {
                                if (!isMainBot(hisoka)) return;
                                if (!m.isOwner) return;
                                if (!query || !query.toLowerCase().startsWith('emoji')) break;
                                try {
                                        const { deleteEmojis, listEmojis } = await import('../helper/emoji.js');
                                        
                                        const emojiInput = query.replace(/^emoji\s*/i, '').trim();
                                        
                                        if (!emojiInput) {
                                                await m.reply(`❌ Format: del emoji 😊,😄\n\nContoh:\ndel emoji 😊\ndel emoji 😊,😄,😁`);
                                                break;
                                        }

                                        const emojisToDelete = emojiInput.split(',').map(e => e.trim()).filter(e => e);
                                        
                                        if (emojisToDelete.length === 0) {
                                                await m.reply('❌ Tidak ada emoji yang valid untuk dihapus');
                                                break;
                                        }

                                        const results = deleteEmojis(emojisToDelete);
                                        const newList = listEmojis();
                                        
                                        let response = `╭═══『 *DEL EMOJI* 』═══╮\n│\n`;

if (results.deleted.length > 0) {
    response += `│ ✅ *Dihapus (${results.deleted.length}):* ${results.deleted.join(',')}\n`;
}

if (results.notFound.length > 0) {
    response += `│ ⚠️ *Tidak ada (${results.notFound.length}):* ${results.notFound.join(',')}\n`;
}

response += `│\n│ 📊 *Sisa:* ${newList.count} emoji\n`;
if (newList.emojis.length > 0) {
    response += `│ *Daftar:* ${newList.emojis.join(',')}\n`;
}
response += `╰═════════════════╯`;
                                        
                                        await m.reply(response);
                                        logCommand(m, hisoka, 'del emoji');
                                } catch (error) {
                                        console.error('\x1b[31m[DelEmoji] Error:\x1b[39m', error.message);
                                        await m.reply(`Error: ${error.message}`);
                                }
                                break;
                        }

                        case 'list': {
                                if (!isMainBot(hisoka)) return;
                                if (!m.isOwner) return;
                                if (!query || !query.toLowerCase().startsWith('emoji')) break;
                                try {
                                        const { listEmojis } = await import('../helper/emoji.js');
                                        const data = listEmojis();
                                        
                                        let response = `╭═══『 *LIST EMOJI* 』═══╮\n│\n`;
response += `│ 📊 *Total:* ${data.count} emoji\n│\n`;

if (data.emojis.length > 0) {
    response += `│ *Daftar:* ${data.emojis.join(',')}\n`;
} else {
    response += `│ ❌ Belum ada emoji tersimpan\n`;
}

response += `│\n│ *Command:*\n`;
response += `│ add emoji 😊,😄\n`;
response += `│ del emoji 😊,😄\n`;
response += `╰═════════════════╯`;
                                        
                                        await m.reply(response);
                                        logCommand(m, hisoka, 'list emoji');
                                } catch (error) {
                                        console.error('\x1b[31m[ListEmoji] Error:\x1b[39m', error.message);
                                        await m.reply(`Error: ${error.message}`);
                                }
                                break;
                        }

                        case 'online': {
                                if (!isMainBot(hisoka)) return;
                                if (!m.isOwner) return;
                                try {
                                        const config = loadConfig();
                                        const autoOnline = config.autoOnline || { enabled: false, intervalSeconds: 30 };
                                        const args = query ? query.toLowerCase().split(' ') : [];
                                        
                                        if (args.length === 0) {
                                                let text = `╭═══『 *AUTO PRESENCE* 』═══╮\n│\n`;
text += `│ *Mode:* ${autoOnline.enabled ? '✅ ONLINE' : '🙈 OFFLINE (Stealth)'}\n`;
text += `│ *Interval:* ${autoOnline.intervalSeconds || 30} detik\n`;
text += `│ *Running:* ${global.autoOnlineInterval ? '✅ Yes' : '❌ No'}\n`;
text += `│\n`;
text += `│ *Penggunaan:*\n`;
text += `│ .online on - Terlihat Online\n`;
text += `│ .online off - Terlihat Offline\n`;
text += `│ .online set <detik> - Set interval\n`;
text += `│\n`;
text += `│ *Info:* Mode OFFLINE akan terus\n`;
text += `│ mengirim status offline setiap\n`;
text += `│ ${autoOnline.intervalSeconds || 30} detik agar tetap tersembunyi\n`;
text += `│ walaupun Anda buka WA di HP\n`;
text += `│\n`;
text += `╰═════════════════╯`;
                                                await m.reply(text);
                                                break;
                                        }
                                        
                                        if (args[0] === 'on') {
                                                if (autoOnline.enabled) {
                                                        await m.reply('ℹ️ Auto Online sudah aktif sebelumnya');
                                                } else {
                                                        config.autoOnline = { ...autoOnline, enabled: true };
                                                        saveConfig(config);
                                                        if (global.startAutoOnline) {
                                                                global.startAutoOnline();
                                                        } else if (global.hisokaClient) {
                                                                global.hisokaClient.sendPresenceUpdate('available');
                                                        }
                                                        await m.reply('✅ Auto Online diaktifkan - Anda terlihat online');
                                                }
                                        } else if (args[0] === 'off') {
                                                if (!autoOnline.enabled) {
                                                        await m.reply('ℹ️ Auto Online sudah nonaktif sebelumnya - Anda terlihat offline');
                                                } else {
                                                        config.autoOnline = { ...autoOnline, enabled: false };
                                                        saveConfig(config);
                                                        if (global.autoOnlineInterval) {
                                                                clearInterval(global.autoOnlineInterval);
                                                                global.autoOnlineInterval = null;
                                                        }
                                                        if (global.hisokaClient) {
                                                                global.hisokaClient.sendPresenceUpdate('unavailable');
                                                        }
                                                        console.log(`\x1b[33m[AutoOnline]\x1b[39m Stopped`);
                                                        await m.reply('❌ Auto Online dinonaktifkan - Anda terlihat offline');
                                                }
                                        } else if (args[0] === 'set' && args[1]) {
                                                const seconds = parseInt(args[1]);
                                                if (isNaN(seconds) || seconds < 10 || seconds > 300) {
                                                        await m.reply('❌ Interval harus antara 10-300 detik');
                                                        break;
                                                }
                                                config.autoOnline = { ...autoOnline, intervalSeconds: seconds };
                                                saveConfig(config);
                                                let timerStatus = '';
                                                if (config.autoOnline.enabled) {
                                                        if (global.startAutoOnline) {
                                                                global.startAutoOnline();
                                                                timerStatus = ' (timer restarted)';
                                                        } else {
                                                                timerStatus = ' (akan aktif saat reconnect)';
                                                        }
                                                }
                                                await m.reply(`✅ Interval Auto Online diset ke ${seconds} detik${timerStatus}`);
                                        } else {
                                                await m.reply('❌ Perintah tidak valid. Gunakan .online untuk melihat bantuan.');
                                        }
                                        
                                        logCommand(m, hisoka, 'online');
                                } catch (error) {
                                        console.error('\x1b[31m[Online] Error:\x1b[39m', error.message);
                                        await m.reply(`Error: ${error.message}`);
                                }
                                break;
                        }

                        case 'anticall':
                        case 'ac': {
                                if (!isMainBot(hisoka)) return;
                                if (!m.isOwner) return;
                                try {
                                        const config = loadConfig();
                                        const antiCall = config.antiCall || { enabled: false, message: '', whitelist: [] };
                                        const args = query ? query.split(' ') : [];
                                        const argLower = args[0] ? args[0].toLowerCase() : '';
                                        
                                        if (args.length === 0) {
                                                let text = `╭═══『 *ANTI CALL* 』═══╮\n│\n`;
text += `│ *Status:* ${antiCall.enabled ? '✅ Aktif' : '❌ Nonaktif'}\n`;
text += `│ *Pesan:* ${antiCall.message || '(kosong)'}\n`;
text += `│ *Whitelist:* ${(antiCall.whitelist || []).length} nomor\n`;
text += `│\n`;
text += `│ *Penggunaan:*\n`;
text += `│ .anticall on/off\n`;
text += `│ .anticall msg <pesan>\n`;
text += `│ .anticall list\n`;
text += `│ .anticall add <nomor>\n`;
text += `│ .anticall del <nomor>\n`;
text += `│ .anticall reset\n`;
text += `│\n`;
text += `│ *Info:* Nomor whitelist tidak\n`;
text += `│ akan di-reject panggilannya\n`;
text += `│\n`;
text += `╰═════════════════╯`;
                                                await m.reply(text);
                                                break;
                                        }
                                        
                                        if (argLower === 'on') {
                                                if (antiCall.enabled) {
                                                        await m.reply('ℹ️ Anti Call sudah aktif sebelumnya');
                                                } else {
                                                        config.antiCall = { ...antiCall, enabled: true };
                                                        saveConfig(config);
                                                        await m.reply('✅ Anti Call diaktifkan - Panggilan suara akan otomatis ditolak');
                                                }
                                        } else if (argLower === 'off') {
                                                if (!antiCall.enabled) {
                                                        await m.reply('ℹ️ Anti Call sudah nonaktif sebelumnya');
                                                } else {
                                                        config.antiCall = { ...antiCall, enabled: false };
                                                        saveConfig(config);
                                                        await m.reply('❌ Anti Call dinonaktifkan');
                                                }
                                        } else if (argLower === 'msg' || argLower === 'message' || argLower === 'pesan') {
                                                const newMsg = args.slice(1).join(' ');
                                                if (!newMsg) {
                                                        await m.reply(`📝 Pesan saat ini:\n\n${antiCall.message || '(kosong)'}\n\nGunakan: .anticall msg <pesan baru>`);
                                                } else {
                                                        config.antiCall = { ...antiCall, message: newMsg };
                                                        saveConfig(config);
                                                        await m.reply(`✅ Pesan Anti Call diubah menjadi:\n\n${newMsg}`);
                                                }
                                        } else if (argLower === 'list') {
                                                const whitelist = antiCall.whitelist || [];
                                                if (whitelist.length === 0) {
                                                        await m.reply('📋 Whitelist Anti Call kosong\n\nGunakan .anticall add <nomor> untuk menambahkan');
                                                } else {
                                                        let text = `╭═══『 *WHITELIST ANTICALL* 』═══╮\n│\n`;
whitelist.forEach((num, i) => {
    text += `│ ${i + 1}. ${num}\n`;
});
text += `│\n╰═════════════════╯`;
                                                        await m.reply(text);
                                                }
                                        } else if (argLower === 'add') {
                                                const number = args[1] ? args[1].replace(/[^0-9]/g, '') : '';
                                                if (!number) {
                                                        await m.reply('❌ Masukkan nomor!\n\nContoh: .anticall add 628123456789');
                                                        break;
                                                }
                                                const whitelist = antiCall.whitelist || [];
                                                if (whitelist.includes(number)) {
                                                        await m.reply(`ℹ️ Nomor ${number} sudah ada di whitelist`);
                                                } else {
                                                        whitelist.push(number);
                                                        config.antiCall = { ...antiCall, whitelist };
                                                        saveConfig(config);
                                                        await m.reply(`✅ Nomor ${number} ditambahkan ke whitelist Anti Call`);
                                                }
                                        } else if (argLower === 'del' || argLower === 'delete' || argLower === 'hapus') {
                                                const number = args[1] ? args[1].replace(/[^0-9]/g, '') : '';
                                                if (!number) {
                                                        await m.reply('❌ Masukkan nomor!\n\nContoh: .anticall del 628123456789');
                                                        break;
                                                }
                                                const whitelist = antiCall.whitelist || [];
                                                const idx = whitelist.findIndex(n => n === number);
                                                if (idx === -1) {
                                                        await m.reply(`ℹ️ Nomor ${number} tidak ditemukan di whitelist`);
                                                } else {
                                                        whitelist.splice(idx, 1);
                                                        config.antiCall = { ...antiCall, whitelist };
                                                        saveConfig(config);
                                                        await m.reply(`✅ Nomor ${number} dihapus dari whitelist Anti Call`);
                                                }
                                        } else if (argLower === 'reset' || argLower === 'clear') {
                                                config.antiCall = { ...antiCall, whitelist: [] };
                                                saveConfig(config);
                                                await m.reply('✅ Whitelist Anti Call direset');
                                        } else {
                                                await m.reply('❌ Perintah tidak valid. Gunakan .anticall untuk melihat bantuan.');
                                        }
                                        
                                        logCommand(m, hisoka, 'anticall');
                                } catch (error) {
                                        console.error('\x1b[31m[AntiCall] Error:\x1b[39m', error.message);
                                        await m.reply(`Error: ${error.message}`);
                                }
                                break;
                        }

                        case 'anticallvid':
                        case 'acv': {
                                if (!isMainBot(hisoka)) return;
                                if (!m.isOwner) return;
                                try {
                                        const config = loadConfig();
                                        const antiCallVideo = config.antiCallVideo || { enabled: false, message: '', whitelist: [] };
                                        const args = query ? query.split(' ') : [];
                                        const argLower = args[0] ? args[0].toLowerCase() : '';
                                        
                                        if (args.length === 0) {
                                                let text = `╭═══『 *ANTI CALL VIDEO* 』═══╮\n│\n`;
text += `│ *Status:* ${antiCallVideo.enabled ? '✅ Aktif' : '❌ Nonaktif'}\n`;
text += `│ *Pesan:* ${antiCallVideo.message || '(kosong)'}\n`;
text += `│ *Whitelist:* ${(antiCallVideo.whitelist || []).length} nomor\n`;
text += `│\n`;
text += `│ *Penggunaan:*\n`;
text += `│ .anticallvid on/off\n`;
text += `│ .anticallvid msg <pesan>\n`;
text += `│ .anticallvid list\n`;
text += `│ .anticallvid add <nomor>\n`;
text += `│ .anticallvid del <nomor>\n`;
text += `│ .anticallvid reset\n`;
text += `│\n`;
text += `│ *Info:* Nomor whitelist tidak\n`;
text += `│ akan di-reject panggilannya\n`;
text += `│\n`;
text += `╰═════════════════╯`;
                                                await m.reply(text);
                                                break;
                                        }
                                        
                                        if (argLower === 'on') {
                                                if (antiCallVideo.enabled) {
                                                        await m.reply('ℹ️ Anti Call Video sudah aktif sebelumnya');
                                                } else {
                                                        config.antiCallVideo = { ...antiCallVideo, enabled: true };
                                                        saveConfig(config);
                                                        await m.reply('✅ Anti Call Video diaktifkan - Panggilan video akan otomatis ditolak');
                                                }
                                        } else if (argLower === 'off') {
                                                if (!antiCallVideo.enabled) {
                                                        await m.reply('ℹ️ Anti Call Video sudah nonaktif sebelumnya');
                                                } else {
                                                        config.antiCallVideo = { ...antiCallVideo, enabled: false };
                                                        saveConfig(config);
                                                        await m.reply('❌ Anti Call Video dinonaktifkan');
                                                }
                                        } else if (argLower === 'msg' || argLower === 'message' || argLower === 'pesan') {
                                                const newMsg = args.slice(1).join(' ');
                                                if (!newMsg) {
                                                        await m.reply(`📝 Pesan saat ini:\n\n${antiCallVideo.message || '(kosong)'}\n\nGunakan: .anticallvid msg <pesan baru>`);
                                                } else {
                                                        config.antiCallVideo = { ...antiCallVideo, message: newMsg };
                                                        saveConfig(config);
                                                        await m.reply(`✅ Pesan Anti Call Video diubah menjadi:\n\n${newMsg}`);
                                                }
                                        } else if (argLower === 'list') {
                                                const whitelist = antiCallVideo.whitelist || [];
                                                if (whitelist.length === 0) {
                                                        await m.reply('📋 Whitelist Anti Call Video kosong\n\nGunakan .anticallvid add <nomor> untuk menambahkan');
                                                } else {
                                                        let text = `╭═══『 *WHITELIST ANTICALL VIDEO* 』═══╮\n│\n`;
whitelist.forEach((num, i) => {
    text += `│ ${i + 1}. ${num}\n`;
});
text += `│\n╰═════════════════╯`;
                                                        await m.reply(text);
                                                }
                                        } else if (argLower === 'add') {
                                                const number = args[1] ? args[1].replace(/[^0-9]/g, '') : '';
                                                if (!number) {
                                                        await m.reply('❌ Masukkan nomor!\n\nContoh: .anticallvid add 628123456789');
                                                        break;
                                                }
                                                const whitelist = antiCallVideo.whitelist || [];
                                                if (whitelist.includes(number)) {
                                                        await m.reply(`ℹ️ Nomor ${number} sudah ada di whitelist`);
                                                } else {
                                                        whitelist.push(number);
                                                        config.antiCallVideo = { ...antiCallVideo, whitelist };
                                                        saveConfig(config);
                                                        await m.reply(`✅ Nomor ${number} ditambahkan ke whitelist Anti Call Video`);
                                                }
                                        } else if (argLower === 'del' || argLower === 'delete' || argLower === 'hapus') {
                                                const number = args[1] ? args[1].replace(/[^0-9]/g, '') : '';
                                                if (!number) {
                                                        await m.reply('❌ Masukkan nomor!\n\nContoh: .anticallvid del 628123456789');
                                                        break;
                                                }
                                                const whitelist = antiCallVideo.whitelist || [];
                                                const idx = whitelist.findIndex(n => n === number);
                                                if (idx === -1) {
                                                        await m.reply(`ℹ️ Nomor ${number} tidak ditemukan di whitelist`);
                                                } else {
                                                        whitelist.splice(idx, 1);
                                                        config.antiCallVideo = { ...antiCallVideo, whitelist };
                                                        saveConfig(config);
                                                        await m.reply(`✅ Nomor ${number} dihapus dari whitelist Anti Call Video`);
                                                }
                                        } else if (argLower === 'reset' || argLower === 'clear') {
                                                config.antiCallVideo = { ...antiCallVideo, whitelist: [] };
                                                saveConfig(config);
                                                await m.reply('✅ Whitelist Anti Call Video direset');
                                        } else {
                                                await m.reply('❌ Perintah tidak valid. Gunakan .anticallvid untuk melihat bantuan.');
                                        }
                                        
                                        logCommand(m, hisoka, 'anticallvid');
                                } catch (error) {
                                        console.error('\x1b[31m[AntiCallVideo] Error:\x1b[39m', error.message);
                                        await m.reply(`Error: ${error.message}`);
                                }
                                break;
                        }

                        case 'ytmp4':
                        case 'ytv': {
                                try {
                                        if (!query) {
                                                await m.reply('❌ Masukkan link YouTube!\n\nContoh: .ytmp4 https://youtube.com/watch?v=xxx');
                                                break;
                                        }
                                        
                                        const ytUrl = query.trim();
                                        if (!ytUrl.includes('youtube.com') && !ytUrl.includes('youtu.be')) {
                                                await m.reply('❌ Link tidak valid! Pastikan link dari YouTube.');
                                                break;
                                        }
                                        
                                        const loadingMsg = await m.reply('🔍 Mencari video dari dimensi YouTube...');
                                        
                                        const { Innertube, Platform } = await import('youtubei.js');
                                        
                                        Platform.shim.eval = async (data, env) => {
                                                const properties = [];
                                                
                                                if (env && env.n) {
                                                        properties.push(`n: exportedVars.nFunction("${env.n}")`);
                                                }
                                                
                                                if (env && env.sig) {
                                                        properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
                                                }
                                                
                                                const code = `${data.output}\nreturn { ${properties.join(', ')} }`;
                                                
                                                try {
                                                        return new Function(code)();
                                                } catch (e) {
                                                        console.error('[YouTube] Function eval error:', e.message);
                                                        return {};
                                                }
                                        };
                                        
                                        const youtube = await Innertube.create({
                                                fetch: fetch,
                                                generate_session_locally: true,
                                                retrieve_player: true,
                                                lang: 'id',
                                                location: 'ID'
                                        });
                                        
                                        let videoId = '';
                                        if (ytUrl.includes('youtu.be/')) {
                                                videoId = ytUrl.split('youtu.be/')[1]?.split('?')[0];
                                        } else if (ytUrl.includes('v=')) {
                                                videoId = ytUrl.split('v=')[1]?.split('&')[0];
                                        }
                                        
                                        if (!videoId) {
                                                await m.reply({ edit: loadingMsg.key, text: '❌ Tidak dapat mengekstrak ID video.' });
                                                break;
                                        }
                                        
                                        const info = await youtube.getInfo(videoId);
                                        const details = info.basic_info;
                                        
                                        const title = details.title || 'Unknown';
                                        const duration = details.duration || 0;
                                        const channel = details.author || details.channel?.name || 'Unknown';
                                        const viewCount = details.view_count || 0;
                                        const likeCount = details.like_count || 0;
                                        
                                        const formatNumber = (num) => {
                                                if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'M';
                                                if (num >= 1000000) return (num / 1000000).toFixed(1) + 'Jt';
                                                if (num >= 1000) return (num / 1000).toFixed(1) + 'Rb';
                                                return num.toString();
                                        };
                                        
                                        const formatDuration = (sec) => {
                                                const h = Math.floor(sec / 3600);
                                                const m = Math.floor((sec % 3600) / 60);
                                                const s = sec % 60;
                                                if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                                                return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                                        };
                                        
                                        const availableFormats = info.streaming_data?.formats || [];
                                        const adaptiveFormats = info.streaming_data?.adaptive_formats || [];
                                        const allFormats = [...availableFormats, ...adaptiveFormats];
                                        
                                        const videoFormats = allFormats.filter(f => f.has_video && f.has_audio);
                                        let bestAvailableRes = '360p';
                                        if (videoFormats.length > 0) {
                                                const heights = videoFormats.map(f => f.height).filter(h => h);
                                                const maxHeight = Math.max(...heights);
                                                if (maxHeight >= 1080) bestAvailableRes = '1080p';
                                                else if (maxHeight >= 720) bestAvailableRes = '720p';
                                                else if (maxHeight >= 480) bestAvailableRes = '480p';
                                                else if (maxHeight >= 360) bestAvailableRes = '360p';
                                                else bestAvailableRes = `${maxHeight}p`;
                                        }
                                        
                                        let infoText = `📦 *Info Video Siap Dikirim!*\n\n`;
                                        infoText += `🎬 *Judul:* ${title}\n`;
                                        infoText += `👤 *Channel:* ${channel}\n`;
                                        infoText += `⏱ *Durasi:* ${formatDuration(duration)}\n`;
                                        infoText += `📺 *Resolusi:* ${bestAvailableRes}\n\n`;
                                        infoText += `👁️ *Views:* ${formatNumber(viewCount)}\n`;
                                        infoText += `👍 *Like:* ${formatNumber(likeCount)}\n\n`;
                                        infoText += `🔗 ${ytUrl}\n\n`;
                                        infoText += `⏳ _Sedang menyiapkan berkas..._`;
                                        
                                        const thumbnail = details.thumbnail?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                                        
                                        await hisoka.sendMessage(m.from, {
                                                image: { url: thumbnail },
                                                caption: infoText
                                        }, { quoted: m });
                                        
                                        let videoBuffer = null;
                                        let downloadedQuality = '';
                                        const qualities = ['360p', '480p', '720p', 'best'];
                                        
                                        for (const qual of qualities) {
                                                try {
                                                        const stream = await info.download({
                                                                type: 'video+audio',
                                                                quality: qual
                                                        });
                                                        
                                                        const chunks = [];
                                                        for await (const chunk of stream) {
                                                                chunks.push(chunk);
                                                        }
                                                        videoBuffer = Buffer.concat(chunks);
                                                        downloadedQuality = qual === 'best' ? bestAvailableRes : qual;
                                                        break;
                                                } catch (qualErr) {
                                                        continue;
                                                }
                                        }
                                        
                                        if (!videoBuffer) {
                                                throw new Error('Tidak ada format video yang tersedia');
                                        }
                                        
                                        const sizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(2);
                                        
                                        if (videoBuffer.length > 100 * 1024 * 1024) {
                                                await m.reply(`⚠️ Video terlalu besar (${sizeMB} MB). Maksimal 100 MB.`);
                                                break;
                                        }
                                        
                                        await hisoka.sendMessage(m.from, {
                                                video: videoBuffer,
                                                mimetype: 'video/mp4',
                                                caption: `✅ *Video Siap!*\n\n🎬 *${title}*\n📁 *Ukuran:* ${sizeMB} MB\n📺 *Resolusi:* ${downloadedQuality}`
                                        }, { quoted: m });
                                        
                                        logCommand(m, hisoka, 'ytmp4');
                                } catch (error) {
                                        console.error('\x1b[31m[YouTube] Error:\x1b[39m', error.message);
                                        await m.reply(`❌ Error: ${error.message}`);
                                }
                                break;
                        }

                        case 'ytmp3':
                        case 'yta': {
                                try {
                                        if (!query) {
                                                await m.reply('❌ Masukkan link YouTube!\n\nContoh: .ytmp3 https://youtube.com/watch?v=xxx');
                                                break;
                                        }
                                        
                                        const ytUrl = query.trim();
                                        if (!ytUrl.includes('youtube.com') && !ytUrl.includes('youtu.be')) {
                                                await m.reply('❌ Link tidak valid! Pastikan link dari YouTube.');
                                                break;
                                        }
                                        
                                        const loadingMsg = await m.reply('🔍 Mencari audio dari YouTube...');
                                        
                                        const { Innertube, Platform } = await import('youtubei.js');
                                        
                                        Platform.shim.eval = async (data, env) => {
                                                const properties = [];
                                                
                                                if (env && env.n) {
                                                        properties.push(`n: exportedVars.nFunction("${env.n}")`);
                                                }
                                                
                                                if (env && env.sig) {
                                                        properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
                                                }
                                                
                                                const code = `${data.output}\nreturn { ${properties.join(', ')} }`;
                                                
                                                try {
                                                        return new Function(code)();
                                                } catch (e) {
                                                        console.error('[YouTube] Function eval error:', e.message);
                                                        return {};
                                                }
                                        };
                                        
                                        const youtube = await Innertube.create({
                                                fetch: fetch,
                                                generate_session_locally: true,
                                                retrieve_player: true,
                                                lang: 'id',
                                                location: 'ID'
                                        });
                                        
                                        let videoId = '';
                                        if (ytUrl.includes('youtu.be/')) {
                                                videoId = ytUrl.split('youtu.be/')[1]?.split('?')[0];
                                        } else if (ytUrl.includes('v=')) {
                                                videoId = ytUrl.split('v=')[1]?.split('&')[0];
                                        }
                                        
                                        if (!videoId) {
                                                await m.reply({ edit: loadingMsg.key, text: '❌ Tidak dapat mengekstrak ID video.' });
                                                break;
                                        }
                                        
                                        const info = await youtube.getInfo(videoId);
                                        const details = info.basic_info;
                                        
                                        const title = details.title || 'Unknown';
                                        const duration = details.duration || 0;
                                        const channel = details.author || details.channel?.name || 'Unknown';
                                        const viewCount = details.view_count || 0;
                                        const likeCount = details.like_count || 0;
                                        
                                        const formatNumber = (num) => {
                                                if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'M';
                                                if (num >= 1000000) return (num / 1000000).toFixed(1) + 'Jt';
                                                if (num >= 1000) return (num / 1000).toFixed(1) + 'Rb';
                                                return num.toString();
                                        };
                                        
                                        const formatDuration = (sec) => {
                                                const h = Math.floor(sec / 3600);
                                                const m = Math.floor((sec % 3600) / 60);
                                                const s = sec % 60;
                                                if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                                                return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                                        };
                                        
                                        let infoText = `🎵 *Info Audio Siap Dikirim!*\n\n`;
                                        infoText += `🎬 *Judul:* ${title}\n`;
                                        infoText += `👤 *Channel:* ${channel}\n`;
                                        infoText += `⏱ *Durasi:* ${formatDuration(duration)}\n\n`;
                                        infoText += `👁️ *Views:* ${formatNumber(viewCount)}\n`;
                                        infoText += `👍 *Like:* ${formatNumber(likeCount)}\n\n`;
                                        infoText += `🔗 ${ytUrl}\n\n`;
                                        infoText += `⏳ _Sedang menyiapkan berkas audio..._`;
                                        
                                        const thumbnail = details.thumbnail?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                                        
                                        await hisoka.sendMessage(m.from, {
                                                image: { url: thumbnail },
                                                caption: infoText
                                        }, { quoted: m });
                                        
                                        let audioBuffer = null;
                                        
                                        try {
                                                const stream = await info.download({
                                                        type: 'audio',
                                                        quality: 'best'
                                                });
                                                
                                                const chunks = [];
                                                for await (const chunk of stream) {
                                                        chunks.push(chunk);
                                                }
                                                audioBuffer = Buffer.concat(chunks);
                                        } catch (audioErr) {
                                                console.log('[YouTube Audio] Menggunakan fallback video+audio...');
                                                
                                                try {
                                                        const stream = await info.download({
                                                                type: 'video+audio',
                                                                quality: 'lowest'
                                                        });
                                                        
                                                        const chunks = [];
                                                        for await (const chunk of stream) {
                                                                chunks.push(chunk);
                                                        }
                                                        audioBuffer = Buffer.concat(chunks);
                                                } catch (videoErr) {
                                                        console.log('[YouTube Audio] Menggunakan kualitas terbaik...');
                                                        
                                                        const stream = await info.download({
                                                                type: 'video+audio',
                                                                quality: 'best'
                                                        });
                                                        
                                                        const chunks = [];
                                                        for await (const chunk of stream) {
                                                                chunks.push(chunk);
                                                        }
                                                        audioBuffer = Buffer.concat(chunks);
                                                }
                                        }
                                        
                                        if (!audioBuffer) {
                                                throw new Error('Tidak ada format audio yang tersedia');
                                        }
                                        
                                        const sizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(2);
                                        
                                        if (audioBuffer.length > 50 * 1024 * 1024) {
                                                await m.reply(`⚠️ Audio terlalu besar (${sizeMB} MB). Maksimal 50 MB.`);
                                                break;
                                        }
                                        
                                        let audioCaption = `✅ *Audio Siap!*\n\n`;
                                        audioCaption += `🎵 *${title}*\n`;
                                        audioCaption += `👤 *${channel}*\n`;
                                        audioCaption += `⏱ *Durasi:* ${formatDuration(duration)}\n`;
                                        audioCaption += `📁 *Ukuran:* ${sizeMB} MB`;
                                        
                                        await hisoka.sendMessage(m.from, {
                                                audio: audioBuffer,
                                                mimetype: 'audio/mpeg',
                                                ptt: false,
                                                fileName: `${title}.mp3`,
                                                caption: audioCaption
                                        }, { quoted: m });
                                        
                                        logCommand(m, hisoka, 'ytmp3');
                                } catch (error) {
                                        console.error('\x1b[31m[YouTube Audio] Error:\x1b[39m', error.message);
                                        await m.reply(`❌ Error: ${error.message}`);
                                }
                                break;
                        }

                        case 'react':
                        case 'reaksi': {
                                try {
                                        const config = loadConfig();
                                        const reactConfig = config.reactApi || {};
                                        
                                        if (!reactConfig.enabled) {
                                                await m.reply('Mohon maaf, fitur react sedang tidak aktif saat ini. Silakan hubungi admin untuk mengaktifkannya.');
                                                break;
                                        }
                                        
                                        const apiKey = process.env.REACT_API_KEY || reactConfig.apiKey;
                                        if (!apiKey) {
                                                await m.reply('Mohon maaf, API key untuk fitur react belum dikonfigurasi. Silakan hubungi admin untuk mengaturnya.');
                                                break;
                                        }
                                        
                                        if (!query) {
                                                await m.reply(`╭═══ *REACT CHANNEL* ═══╮
│
│ 📌 *Kirim Reaksi ke Saluran/Channel*
│
│ *Format:*
│ .react [link] [emoji]
│
│ *Contoh Penggunaan:*
│ .react https://whatsapp.com/
│ channel/0029xxx/264 ♥️ 🙏🏻
│
│ *Keterangan:*
│ • Link: URL postingan channel
│ • Emoji: Reaksi (bisa lebih dari 1)
│
│ *Command Lainnya:*
│ • .cekreact - Cek saldo coin
│ • .setreactapi - Atur API key
│
╰══════════════════════╯`);
                                                break;
                                        }
                                        
                                        const [postLink, ...reactsArray] = query.split(' ');
                                        const reacts = reactsArray.join(', ');
                                        
                                        if (!postLink || !reacts) {
                                                await m.reply(`⚠️ *Format Tidak Lengkap!*

Gunakan format:
.react [link_post] [emoji1] [emoji2]

Contoh:
.react https://whatsapp.com/channel/xxx/123 ♥️ 🙏🏻`);
                                                break;
                                        }
                                        
                                        const loadingMsg = await m.reply('⏳ Sedang memproses reaksi, mohon tunggu sebentar...');
                                        
                                        const axios = (await import('axios')).default;
                                        const apiUrl = reactConfig.apiUrl || 'https://foreign-marna-sithaunarathnapromax-9a005c2e.koyeb.app/api/channel/react-to-post';
                                        
                                        const requestData = {
                                                post_link: postLink,
                                                reacts: reacts
                                        };
                                        
                                        const headers = {
                                                'Accept': 'application/json, text/plain, */*',
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${apiKey}`
                                        };
                                        
                                        const response = await axios.post(apiUrl, requestData, { headers, timeout: 30000 });
                                        const data = response.data;
                                        
                                        const emojiList = reacts.split(',').map(e => e.trim()).filter(e => e);
                                        const totalReactions = emojiList.length;
                                        
                                        let coinUsed = data.coinsUsed || data.coinUsed || data.coins_used || null;
                                        if (!coinUsed && data.message) {
                                                const coinMatch = data.message.match(/(\d+)\s*COIN/i);
                                                if (coinMatch) coinUsed = parseInt(coinMatch[1]);
                                        }
                                        if (!coinUsed) coinUsed = totalReactions;
                                        
                                        let coinRemaining = data.coinsRemaining || data.coinRemaining || data.coins_remaining || data.balance || data.remainingCoins || null;
                                        if (!coinRemaining && data.message) {
                                                const remainMatch = data.message.match(/remaining[:\s]*(\d+)/i) || data.message.match(/sisa[:\s]*(\d+)/i);
                                                if (remainMatch) coinRemaining = parseInt(remainMatch[1]);
                                        }
                                        
                                        let hasil = `╭═══ *REACT BERHASIL* ═══╮\n`;
hasil += `│\n`;
hasil += `│ ✅ *Status:* Sukses!\n`;
hasil += `│\n`;
hasil += `│ 📊 *Detail Reaksi:*\n`;
hasil += `│ ├ Emoji: ${emojiList.join(' ')}\n`;
hasil += `│ ├ Jumlah: ${totalReactions} reaksi\n`;
hasil += `│ └ Post: ...${postLink.slice(-20)}\n`;
hasil += `│\n`;
hasil += `│ 💰 *Info Coin:*\n`;
hasil += `│ ├ Terpakai: ${coinUsed} coin\n`;
hasil += `│ └ Sisa: ${coinRemaining !== null ? coinRemaining + ' coin' : 'Gunakan .cekreact'}\n`;
if (data.botResponse) {
    hasil += `│\n`;
    hasil += `│ 🤖 *Respon:* ${data.botResponse}\n`;
}
hasil += `│\n`;
hasil += `╰══════════════════════╯`;
                                        
                                        await m.reply({ edit: loadingMsg.key, text: hasil.trim() });
                                        logCommand(m, hisoka, 'react');
                                        
                                } catch (error) {
                                        console.error('\x1b[31m[React API] Error:\x1b[39m', error.message);
                                        
                                        let errorMessage = '';
                                        
                                        if (error.response) {
                                                const status = error.response.status;
                                                const responseData = error.response.data;
                                                
                                                if (status === 401 || status === 403) {
                                                        errorMessage = `🔐 *Akses Ditolak*\n\nMohon maaf, sepertinya ada masalah dengan otorisasi API. Silakan hubungi admin untuk memeriksa API key.\n\n💡 *Tips:* Pastikan API key masih valid dan belum kadaluarsa.`;
                                                } else if (status === 429) {
                                                        errorMessage = `⏰ *Batas Penggunaan Tercapai*\n\nMohon maaf, layanan sedang sibuk atau batas penggunaan sudah tercapai. Silakan coba lagi dalam beberapa saat.\n\n💡 *Tips:* Tunggu beberapa menit sebelum mencoba kembali.`;
                                                } else if (status === 400) {
                                                        errorMessage = `📋 *Format Tidak Valid*\n\nMohon maaf, format permintaan tidak sesuai.\n\n📝 *Pesan Server:* ${responseData?.message || 'Format tidak valid'}\n\n💡 *Tips:* Pastikan link dan emoji yang dimasukkan sudah benar.`;
                                                } else if (status === 404) {
                                                        errorMessage = `🔍 *Tidak Ditemukan*\n\nMohon maaf, layanan API tidak dapat ditemukan. Silakan hubungi admin untuk memeriksa konfigurasi.`;
                                                } else if (status >= 500) {
                                                        errorMessage = `🔧 *Server Sedang Bermasalah*\n\nMohon maaf, server sedang mengalami gangguan sementara. Silakan coba lagi dalam beberapa saat.\n\n💡 *Tips:* Jika masalah berlanjut, silakan hubungi admin.`;
                                                } else {
                                                        errorMessage = `⚠️ *Terjadi Kesalahan*\n\n📊 *Status:* ${status}\n📝 *Pesan:* ${responseData?.message || 'Terjadi kesalahan tidak diketahui'}\n\n💡 *Tips:* Silakan coba lagi atau hubungi admin jika masalah berlanjut.`;
                                                }
                                        } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                                                errorMessage = `⏱️ *Waktu Habis*\n\nMohon maaf, permintaan memakan waktu terlalu lama. Server mungkin sedang sibuk.\n\n💡 *Tips:* Silakan coba lagi dalam beberapa saat.`;
                                        } else if (error.request) {
                                                errorMessage = `🌐 *Tidak Dapat Terhubung*\n\nMohon maaf, tidak dapat terhubung ke server. Kemungkinan ada masalah jaringan atau server sedang tidak aktif.\n\n💡 *Tips:* Periksa koneksi internet atau coba lagi nanti.`;
                                        } else {
                                                errorMessage = `❌ *Terjadi Kesalahan*\n\nMohon maaf, terjadi kesalahan teknis: ${error.message}\n\n💡 *Tips:* Silakan coba lagi atau hubungi admin jika masalah berlanjut.`;
                                        }
                                        
                                        await m.reply(errorMessage);
                                }
                                break;
                        }

                        case 'cekreact':
                        case 'reactinfo': {
                                try {
                                        const config = loadConfig();
                                        const reactConfig = config.reactApi || {};
                                        
                                        const apiKey = process.env.REACT_API_KEY || reactConfig.apiKey;
                                        if (!apiKey) {
                                                await m.reply('Mohon maaf, API key untuk fitur react belum dikonfigurasi.');
                                                break;
                                        }
                                        
                                        const loadingMsg = await m.reply('⏳ Mengambil informasi saldo...');
                                        
                                        const axios = (await import('axios')).default;
                                        const baseUrl = reactConfig.apiUrl || 'https://foreign-marna-sithaunarathnapromax-9a005c2e.koyeb.app/api/channel/react-to-post';
                                        const balanceUrl = baseUrl.replace('/react-to-post', '/balance') || 'https://foreign-marna-sithaunarathnapromax-9a005c2e.koyeb.app/api/channel/balance';
                                        
                                        const headers = {
                                                'Accept': 'application/json, text/plain, */*',
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${apiKey}`
                                        };
                                        
                                        try {
                                                const response = await axios.get(balanceUrl, { headers, timeout: 15000 });
                                                const data = response.data;
                                                
                                                const balance = data.balance || data.coins || data.coin || data.saldo || 0;
                                                const used = data.used || data.totalUsed || data.coins_used || 0;
                                                const plan = data.plan || data.subscription || data.package || 'Standard';
                                                const expiry = data.expiry || data.expired || data.expiryDate || '-';
                                                
                                                let hasil = `╭═══ *INFO SALDO REACT* ═══╮\n`;
hasil += `│\n`;
hasil += `│ 💰 *Saldo Coin:* ${balance} coin\n`;
hasil += `│ 📊 *Total Terpakai:* ${used} coin\n`;
hasil += `│ 📦 *Paket:* ${plan}\n`;
if (expiry !== '-') {
    hasil += `│ 📅 *Berlaku Hingga:* ${expiry}\n`;
}
hasil += `│\n`;
hasil += `│ ✅ Status: Aktif\n`;
hasil += `│\n`;
hasil += `╰════════════════════════╯`;
                                                
                                                await m.reply({ edit: loadingMsg.key, text: hasil.trim() });
                                        } catch (balanceError) {
                                                const maskedKey = apiKey.slice(0, 10) + '...' + apiKey.slice(-5);
                                                let hasil = `╭═══ *INFO REACT API* ═══╮\n`;
hasil += `│\n`;
hasil += `│ 🔑 *API Key:* ${maskedKey}\n`;
hasil += `│ ✅ *Status:* ${reactConfig.enabled ? 'Aktif' : 'Nonaktif'}\n`;
hasil += `│ 🌐 *Server:* Terhubung\n`;
hasil += `│\n`;
hasil += `│ ℹ️ *Info:*\n`;
hasil += `│ Endpoint cek saldo tidak tersedia\n`;
hasil += `│ atau sedang dalam pemeliharaan.\n`;
hasil += `│ Silakan coba fitur .react\n`;
hasil += `│\n`;
hasil += `╰════════════════════════╯`;
                                                
                                                await m.reply({ edit: loadingMsg.key, text: hasil.trim() });
                                        }
                                        
                                        logCommand(m, hisoka, 'cekreact');
                                        
                                } catch (error) {
                                        console.error('\x1b[31m[CekReact] Error:\x1b[39m', error.message);
                                        await m.reply(`Mohon maaf, terjadi kesalahan saat mengecek saldo: ${error.message}`);
                                }
                                break;
                        }

                        case 'setreactapi':
                        case 'reactapi': {
                                try {
                                        if (!m.isOwner) {
                                                await m.reply('Mohon maaf, perintah ini hanya dapat digunakan oleh owner bot.');
                                                break;
                                        }
                                        
                                        if (!query) {
                                                const config = loadConfig();
                                                const reactConfig = config.reactApi || {};
                                                const currentKey = process.env.REACT_API_KEY || reactConfig.apiKey;
                                                const maskedKey = currentKey ? currentKey.slice(0, 10) + '...' + currentKey.slice(-5) : 'Belum diatur';
                                                
                                                await m.reply(`╭═══ *SETTING REACT API* ═══╮
│
│ 📌 *Cara Penggunaan:*
│ .setreactapi [api_key]
│
│ 📊 *Status Saat Ini:*
│ ├ Status: ${reactConfig.enabled ? '✅ Aktif' : '❌ Nonaktif'}
│ ├ API Key: ${maskedKey}
│ └ Server: Default
│
╰════════════════════════════╯`);
                                                break;
                                        }
                                        
                                        const newApiKey = query.trim();
                                        const config = loadConfig();
                                        
                                        if (!config.reactApi) {
                                                config.reactApi = {
                                                        enabled: true,
                                                        apiKey: '',
                                                        apiUrl: 'https://foreign-marna-sithaunarathnapromax-9a005c2e.koyeb.app/api/channel/react-to-post'
                                                };
                                        }
                                        
                                        config.reactApi.apiKey = newApiKey;
                                        saveConfig(config);
                                        
                                        const maskedKey = newApiKey.slice(0, 10) + '...' + newApiKey.slice(-5);
                                        await m.reply(`╭═══ *API KEY UPDATED* ═══╮
│
│ ✅ *Berhasil Diperbarui!*
│
│ 🔑 Key: ${maskedKey}
│ 📊 Status: Aktif
│
│ 💡 Fitur react siap digunakan
│
╰═════════════════════════╯`);
                                        logCommand(m, hisoka, 'setreactapi');
                                        
                                } catch (error) {
                                        console.error('\x1b[31m[SetReactAPI] Error:\x1b[39m', error.message);
                                        await m.reply(`Mohon maaf, terjadi kesalahan saat mengatur API key: ${error.message}`);
                                }
                                break;
                        }

                        case 'tt': {
                                try {
                                        if (!query) {
                                                await m.reply('❌ Masukkan link TikTok!\n\nContoh: .tt https://vt.tiktok.com/xxx\nAtau: .tt https://www.tiktok.com/@user/video/xxx');
                                                break;
                                        }
                                        
                                        const ttUrl = query.trim();
                                        if (!ttUrl.includes('tiktok.com') && !ttUrl.includes('tiktok')) {
                                                await m.reply('❌ Link tidak valid! Pastikan link dari TikTok.');
                                                break;
                                        }
                                        
                                        const loadingMsg = await m.reply('⏳ Sedang mengunduh dari TikTok...');
                                        
                                        const { Downloader } = await import('@tobyg74/tiktok-api-dl');
                                        
                                        let result = null;
                                        let lastError = null;
                                        
                                        // Coba v3 dulu (URL paling bersih), lalu v2, lalu v1
                                        const versions = ['v3', 'v2', 'v1'];
                                        for (const version of versions) {
                                                try {
                                                        const res = await Downloader(ttUrl, { version });
                                                        if (res && res.status === 'success' && res.result) {
                                                                result = res;
                                                                console.log('[TikTok] Success with version:', version);
                                                                break;
                                                        }
                                                } catch (e) {
                                                        lastError = e;
                                                        continue;
                                                }
                                        }
                                        
                                        if (!result || result.status !== 'success') {
                                                await m.reply({ edit: loadingMsg.key, text: '❌ Gagal mengunduh. Video mungkin privat atau link tidak valid.' });
                                                break;
                                        }
                                        
                                        const data = result.result;
                                        const author = data.author || {};
                                        const stats = data.statistics || data.stats || {};
                                        const desc = data.description || data.desc || '';
                                        
                                        const formatNum = (num) => {
                                                if (!num || num === 0) return null;
                                                const n = parseInt(num) || 0;
                                                if (isNaN(n) || n === 0) return null;
                                                return n.toLocaleString('id-ID');
                                        };
                                        
                                        const playCount = formatNum(stats.playCount || stats.play_count || stats.views || data.playCount);
                                        const likeCount = formatNum(stats.likeCount || stats.like_count || stats.likes || stats.diggCount || data.likeCount);
                                        const commentCount = formatNum(stats.commentCount || stats.comment_count || stats.comments || data.commentCount);
                                        const shareCount = formatNum(stats.shareCount || stats.share_count || stats.shares || data.shareCount);
                                        
                                        let infoText = `╭═══ *TIKTOK DOWNLOADER* ═══╮\n`;
infoText += `│ 👤 @${author.nickname || author.username || author.unique_id || data.author?.nickname || 'Unknown'}\n`;
if (playCount) infoText += `│ 👁️ ${playCount} views\n`;
if (likeCount) infoText += `│ ❤️ ${likeCount} likes\n`;
if (commentCount) infoText += `│ 💬 ${commentCount} comments\n`;
if (shareCount) infoText += `│ 🔄 ${shareCount} shares\n`;
if (desc) {
    const shortDesc = desc.length > 300 ? desc.substring(0, 300) + '...' : desc;
    infoText += `│\n│ 📝 ${shortDesc}\n`;
}
infoText += `╰════════════════════════╯`;
                                        
                                        await m.reply({ edit: loadingMsg.key, text: '✅ Berhasil! Mengirim media...' });
                                        
                                        // Ekstrak video URL — handle format v3 (videoHD/videoSD) dan v2 (video.playAddr sebagai array)
                                        const pickUrl = (val) => {
                                                if (!val) return null;
                                                if (typeof val === 'string') return val;
                                                if (Array.isArray(val)) return val[0] || null;
                                                return null;
                                        };
                                        
                                        let videoUrl = null;
                                        
                                        // v3 format: videoHD / videoSD / videoWatermark langsung di root
                                        videoUrl = pickUrl(data.videoHD) || pickUrl(data.videoSD) || pickUrl(data.videoWatermark);
                                        
                                        // v2/v1 format: nested di dalam data.video
                                        if (!videoUrl && data.video) {
                                                if (typeof data.video === 'string') {
                                                        videoUrl = data.video;
                                                } else if (Array.isArray(data.video)) {
                                                        videoUrl = data.video[0];
                                                } else {
                                                        videoUrl = pickUrl(data.video.playAddr)
                                                                || pickUrl(data.video.downloadAddr)
                                                                || pickUrl(data.video.noWatermark);
                                                }
                                        }
                                        
                                        if (videoUrl) {
                                                try {
                                                        await hisoka.sendMessage(m.from, {
                                                                video: { url: videoUrl },
                                                                caption: infoText
                                                        }, { quoted: m });
                                                } catch (videoErr) {
                                                        console.log('[TikTok] Video send failed:', videoErr.message);
                                                        await m.reply('⚠️ Gagal mengirim video. Coba lagi nanti.');
                                                }
                                        }
                                        
                                        if (!videoUrl) {
                                                const images = data.images || data.image || [];
                                                if (images.length > 0) {
                                                        await m.reply(`📸 Slide TikTok ditemukan (${images.length} gambar)`);
                                                        for (let i = 0; i < Math.min(images.length, 10); i++) {
                                                                const imgUrl = pickUrl(images[i]) || images[i];
                                                                if (!imgUrl) continue;
                                                                try {
                                                                        await hisoka.sendMessage(m.from, {
                                                                                image: { url: imgUrl },
                                                                                caption: i === 0 ? infoText : `📷 ${i + 1}/${images.length}`
                                                                        }, { quoted: m });
                                                                } catch (imgErr) {
                                                                        console.log('[TikTok] Image send failed:', imgErr.message);
                                                                }
                                                        }
                                                } else {
                                                        await m.reply('❌ Media tidak ditemukan dalam video ini.');
                                                }
                                        }
                                        
                                        logCommand(m, hisoka, 'tiktok');
                                } catch (error) {
                                        console.error('\x1b[31m[TikTok] Error:\x1b[39m', error.message);
                                        await m.reply(`❌ Error: ${error.message}`);
                                }
                                break;
                        }

                        case 'ig': {
                                try {
                                        if (!query) {
                                                await m.reply('❌ Masukkan link Instagram!\n\nContoh: .ig https://www.instagram.com/reel/xxx');
                                                break;
                                        }
                                        
                                        const igUrl = query.trim();
                                        if (!igUrl.includes('instagram.com')) {
                                                await m.reply('❌ Link tidak valid! Pastikan link dari Instagram.');
                                                break;
                                        }
                                        
                                        const loadingMsg = await m.reply('⏳ Sedang mengunduh dari Instagram...');
                                        
                                        const apiUrl = `https://archive.lick.eu.org/api/download/instagram?url=${encodeURIComponent(igUrl)}`;
                                        
                                        const response = await fetch(apiUrl);
                                        const data = await response.json();
                                        
                                        if (!data.status || !data.result) {
                                                await m.reply({ edit: loadingMsg.key, text: '❌ Gagal mengunduh. Coba lagi nanti.' });
                                                break;
                                        }
                                        
                                        const result = data.result;
                                        const mediaUrls = result.url || [];
                                        const caption = result.caption || '';
                                        const username = result.username || 'Unknown';
                                        const likes = result.like || 0;
                                        const comments = result.comment || 0;
                                        const isVideo = result.isVideo;
                                        
                                        let infoText = `╭═══ *INSTAGRAM DOWNLOADER* ═══╮\n`;
infoText += `│ 👤 @${username}\n`;
infoText += `│ ❤️ ${likes.toLocaleString()} likes\n`;
infoText += `│ 💬 ${comments.toLocaleString()} comments\n`;
if (caption) {
    const shortCaption = caption.length > 200 ? caption.substring(0, 200) + '...' : caption;
    infoText += `│\n│ 📝 ${shortCaption}\n`;
}
infoText += `╰════════════════════════╯`;
                                        
                                        if (mediaUrls.length === 0) {
                                                await m.reply({ edit: loadingMsg.key, text: '❌ Media tidak ditemukan.' });
                                                break;
                                        }
                                        
                                        await m.reply({ edit: loadingMsg.key, text: '✅ Berhasil! Mengirim media...' });
                                        
                                        for (let i = 0; i < mediaUrls.length; i++) {
                                                const mediaUrl = mediaUrls[i];
                                                const isFirstMedia = i === 0;
                                                
                                                try {
                                                        if (isVideo) {
                                                                await hisoka.sendMessage(m.from, {
                                                                        video: { url: mediaUrl },
                                                                        caption: isFirstMedia ? infoText : ''
                                                                }, { quoted: m });
                                                        } else {
                                                                await hisoka.sendMessage(m.from, {
                                                                        image: { url: mediaUrl },
                                                                        caption: isFirstMedia ? infoText : ''
                                                                }, { quoted: m });
                                                        }
                                                } catch (sendErr) {
                                                        console.error(`[IG] Failed to send media ${i + 1}:`, sendErr.message);
                                                }
                                        }
                                        
                                        logCommand(m, hisoka, 'instagram');
                                } catch (error) {
                                        console.error('\x1b[31m[Instagram] Error:\x1b[39m', error.message);
                                        await m.reply(`❌ Error: ${error.message}`);
                                }
                                break;
                        }

                        case 'play': {
                                try {
                                        if (!query) {
                                                await m.reply('❌ Masukkan judul lagu yang ingin dicari!\n\nContoh: .play dewa 19 kangen');
                                                break;
                                        }
                                        
                                        const loadingMsg = await m.reply('🔍 Mencari lagu di YouTube...');
                                        
                                        const { Innertube, Platform } = await import('youtubei.js');
                                        
                                        Platform.shim.eval = async (data, env) => {
                                                const properties = [];
                                                if (env && env.n) {
                                                        properties.push(`n: exportedVars.nFunction("${env.n}")`);
                                                }
                                                if (env && env.sig) {
                                                        properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
                                                }
                                                const code = `${data.output}\nreturn { ${properties.join(', ')} }`;
                                                try {
                                                        return new Function(code)();
                                                } catch (e) {
                                                        return {};
                                                }
                                        };
                                        
                                        const youtube = await Innertube.create({
                                                fetch: fetch,
                                                generate_session_locally: true,
                                                retrieve_player: true,
                                                lang: 'id',
                                                location: 'ID'
                                        });
                                        
                                        const searchResults = await youtube.search(query, { type: 'video' });
                                        const videos = searchResults.results?.filter(v => v.type === 'Video') || [];
                                        
                                        if (videos.length === 0) {
                                                await m.reply({ edit: loadingMsg.key, text: '❌ Tidak ditemukan hasil untuk pencarian tersebut.' });
                                                break;
                                        }
                                        
                                        const video = videos[0];
                                        const videoId = video.id;
                                        const title = video.title?.text || 'Unknown';
                                        const channel = video.author?.name || 'Unknown';
                                        const duration = video.duration?.text || '00:00';
                                        const views = video.view_count?.text || video.short_view_count?.text || '0';
                                        const thumbnail = video.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                                        const ytUrl = `https://youtube.com/watch?v=${videoId}`;
                                        
                                        let infoText = `╭═══ *YOUTUBE PLAY* ═══╮\n`;
infoText += `│ 🎵 *${title}*\n`;
infoText += `│ 👤 ${channel}\n`;
infoText += `│ ⏱️ ${duration}\n`;
infoText += `│ 👁️ ${views}\n`;
infoText += `│ 🔗 ${ytUrl}\n`;
infoText += `╰════════════════════════╯\n\n`;
infoText += `📥 *Pilih Format Download:*\n`;
infoText += `┌──────────────────────┐\n`;
infoText += `│  *1* ➤ 🎵 Audio (MP3)\n`;
infoText += `│  *2* ➤ 🎬 Video (MP4)\n`;
infoText += `└──────────────────────┘\n\n`;
infoText += `_Reply pesan ini dengan angka 1 atau 2_`;
                                        
                                        const sentMsg = await hisoka.sendMessage(m.from, {
                                                image: { url: thumbnail },
                                                caption: infoText
                                        }, { quoted: m });
                                        
                                        hisoka.pendingYoutubeDownloads.set(sentMsg.key.id, {
                                                videoId,
                                                title,
                                                channel,
                                                duration,
                                                views,
                                                thumbnail,
                                                ytUrl,
                                                from: m.from,
                                                sender: m.sender,
                                                timestamp: Date.now()
                                        });
                                        
                                        setTimeout(() => {
                                                hisoka.pendingYoutubeDownloads?.delete(sentMsg.key.id);
                                        }, 5 * 60 * 1000);
                                        
                                        logCommand(m, hisoka, 'play');
                                } catch (error) {
                                        console.error('\x1b[31m[Play] Error:\x1b[39m', error.message);
                                        await m.reply(`❌ Error: ${error.message}`);
                                }
                                break;
                        }

                        case 'fb': {
                                try {
                                        if (!query) {
                                                await m.reply('❌ Masukkan link Facebook!\n\nContoh:\n.fb https://www.facebook.com/watch?v=xxx\n.fb https://fb.watch/xxx\n.fb https://www.facebook.com/reel/xxx\n.fb https://www.facebook.com/stories/xxx');
                                                break;
                                        }
                                        
                                        const fbUrl = query.trim();
                                        if (!fbUrl.includes('facebook.com') && !fbUrl.includes('fb.watch') && !fbUrl.includes('fb.com')) {
                                                await m.reply('❌ Link tidak valid! Pastikan link dari Facebook.');
                                                break;
                                        }
                                        
                                        const loadingMsg = await m.reply('⏳ Sedang mengunduh dari Facebook...');
                                        
                                        const isStory = fbUrl.includes('/stories/') || fbUrl.includes('story.php') || fbUrl.includes('/story/');
                                        
                                        let mediaData = null;
                                        
                                        // Method 1: archive.lick.eu.org (primary)
                                        try {
                                                const apiUrl = `https://archive.lick.eu.org/api/download/facebook?url=${encodeURIComponent(fbUrl)}`;
                                                const response = await fetch(apiUrl, { signal: AbortSignal.timeout(20000) });
                                                const data = await response.json();
                                                
                                                if (data.status && data.result && data.result.media && data.result.media.length > 0) {
                                                        const mediaList = data.result.media;
                                                        const hdMedia = mediaList.find(m => m.quality && (m.quality.toLowerCase().includes('hd') || m.quality.toLowerCase().includes('high')));
                                                        const bestMedia = hdMedia || mediaList[0];
                                                        if (bestMedia && bestMedia.url) {
                                                                mediaData = {
                                                                        url: bestMedia.url,
                                                                        quality: hdMedia ? 'HD' : 'SD',
                                                                        isHD: !!hdMedia,
                                                                        title: data.result.metadata?.title || '',
                                                                        isVideo: true
                                                                };
                                                        }
                                                }
                                        } catch (e) {
                                                console.log('[FB] archive.lick failed:', e.message);
                                        }
                                        
                                        // Method 2: direct page scraping via axios (Chrome user-agent, allow redirects)
                                        if (!mediaData) {
                                                try {
                                                        const axios = (await import('axios')).default;
                                                        const { data: pageData } = await axios.get(fbUrl, {
                                                                maxRedirects: 10,
                                                                headers: {
                                                                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                                                        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                                                                        'accept-language': 'en-US,en;q=0.5',
                                                                        'sec-fetch-dest': 'document',
                                                                        'sec-fetch-mode': 'navigate',
                                                                        'sec-fetch-site': 'none',
                                                                },
                                                                timeout: 20000
                                                        });
                                                        
                                                        const cleaned = pageData.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
                                                        
                                                        const hdMatch = cleaned.match(/"browser_native_hd_url":"([^"]+)"/) || cleaned.match(/"playable_url_quality_hd":"([^"]+)"/);
                                                        const sdMatch = cleaned.match(/"browser_native_sd_url":"([^"]+)"/) || cleaned.match(/"playable_url":"([^"]+)"/);
                                                        
                                                        const hdUrl = hdMatch ? hdMatch[1].replace(/\\/g, '') : null;
                                                        const sdUrl = sdMatch ? sdMatch[1].replace(/\\/g, '') : null;
                                                        
                                                        const videoUrl = hdUrl || sdUrl;
                                                        if (videoUrl && videoUrl.startsWith('https://')) {
                                                                mediaData = {
                                                                        url: videoUrl,
                                                                        quality: hdUrl ? 'HD' : 'SD',
                                                                        isHD: !!hdUrl,
                                                                        isVideo: true
                                                                };
                                                                console.log('[FB] direct scraping success:', hdUrl ? 'HD' : 'SD');
                                                        }
                                                } catch (e) {
                                                        console.log('[FB] direct scraping failed:', e.message);
                                                }
                                        }
                                        
                                        if (!mediaData || !mediaData.url) {
                                                await m.reply({ edit: loadingMsg.key, text: '❌ Gagal mengunduh. Video/story mungkin private, perlu login, atau link tidak valid.' });
                                                break;
                                        }
                                        
                                        let infoText = `╭═══ *FACEBOOK DOWNLOADER* ═══╮\n`;
infoText += `│ 📌 Tipe: ${isStory ? 'Story' : 'Video/Reel'}\n`;
infoText += `│ 🎬 Kualitas: ${mediaData.quality}\n`;
if (mediaData.duration) {
    infoText += `│ ⏱️ Durasi: ${mediaData.duration}\n`;
}
if (mediaData.title) {
    const shortTitle = mediaData.title.length > 50 ? mediaData.title.substring(0, 50) + '...' : mediaData.title;
    infoText += `│ 📝 ${shortTitle}\n`;
}
infoText += `╰════════════════════════╯`;
                                        
                                        await m.reply({ edit: loadingMsg.key, text: '✅ Berhasil! Mengirim media...' });
                                        
                                        if (mediaData.isVideo !== false) {
                                                await hisoka.sendMessage(m.from, {
                                                        video: { url: mediaData.url },
                                                        caption: infoText
                                                }, { quoted: m });
                                        } else {
                                                await hisoka.sendMessage(m.from, {
                                                        image: { url: mediaData.url },
                                                        caption: infoText
                                                }, { quoted: m });
                                        }
                                        
                                        logCommand(m, hisoka, 'facebook');
                                } catch (error) {
                                        console.error('\x1b[31m[Facebook] Error:\x1b[39m', error.message);
                                        await m.reply(`❌ Error: ${error.message}`);
                                }
                                break;
                        }

                        case 's': {
                                try {
                                        const sharp = (await import('sharp')).default;
                                        const config = loadConfig();
                                        const stickerConfig = config.sticker || { pack: 'WhatsApp Bot', author: 'Wilykun' };
                                        
                                        const args = query ? query.split(' ') : [];
                                        
                                        if (args[0] === 'author' || args[0] === 'pack') {
                                                const type = args[0];
                                                let value = args.slice(1).join(' ').trim();
                                                
                                                if (!value) {
                                                        await m.reply(`❌ Masukkan nama ${type}!\n\nContoh: .s ${type} ${type === 'author' ? 'Wily' : 'Bot Pack'}`);
                                                        break;
                                                }
                                                
                                                if (value.length > 50) {
                                                        value = value.substring(0, 50);
                                                }
                                                
                                                const freshConfig = loadConfig();
                                                if (!freshConfig.sticker) {
                                                        freshConfig.sticker = { pack: 'WhatsApp Bot', author: 'Wilykun' };
                                                }
                                                freshConfig.sticker[type] = value;
                                                saveConfig(freshConfig);
                                                
                                                await m.reply(`✅ Sticker ${type} berhasil diubah menjadi: *${value}*`);
                                                logCommand(m, hisoka, `sticker-set-${type}`);
                                                break;
                                        }
                                        
                                        if (!m.isQuoted && !m.isMedia) {
                                                const freshConfig = loadConfig();
                                                const freshStickerConfig = freshConfig.sticker || { pack: 'WhatsApp Bot', author: 'Wilykun' };
                                                let text = `╭═══『 *STICKER MAKER* 』═══╮\n│\n`;
text += `│ *Pack:* ${freshStickerConfig.pack}\n`;
text += `│ *Author:* ${freshStickerConfig.author}\n`;
text += `│\n`;
text += `│ *Cara Pakai:*\n`;
text += `│ • Kirim/reply gambar/video dengan .s\n`;
text += `│ • .s author <nama> - Set author\n`;
text += `│ • .s pack <nama> - Set pack name\n`;
text += `│\n`;
text += `╰═════════════════╯`;
                                                await m.reply(text);
                                                break;
                                        }
                                        
                                        await hisoka.sendMessage(m.from, { react: { text: '⏳', key: m.key } });
                                        
                                        let mediaBuffer;
                                        let mediaType;
                                        
                                        if (m.isMedia && (m.type === 'imageMessage' || m.type === 'videoMessage')) {
                                                mediaBuffer = await m.downloadMedia();
                                                mediaType = m.type;
                                        } else if (m.isQuoted && quoted.isMedia && (quoted.type === 'imageMessage' || quoted.type === 'videoMessage')) {
                                                mediaBuffer = await downloadMediaMessage(
                                                        { ...m.quoted, message: m.quoted.raw },
                                                        'buffer',
                                                        {},
                                                        { logger: hisoka.logger, reuploadRequest: hisoka.updateMediaMessage }
                                                );
                                                mediaType = quoted.type;
                                        } else {
                                                await hisoka.sendMessage(m.from, { react: { text: '❌', key: m.key } });
                                                await m.reply('❌ Reply/kirim gambar atau video untuk membuat sticker!');
                                                break;
                                        }
                                        
                                        if (!mediaBuffer || mediaBuffer.length === 0) {
                                                await hisoka.sendMessage(m.from, { react: { text: '❌', key: m.key } });
                                                await m.reply('❌ Gagal download media');
                                                break;
                                        }
                                        
                                        const freshConfig = loadConfig();
                                        const freshStickerConfig = freshConfig.sticker || { pack: 'WhatsApp Bot', author: 'Wilykun' };
                                        
                                        const { Sticker, StickerTypes } = await import('wa-sticker-formatter');
                                        
                                        const sticker = new Sticker(mediaBuffer, {
                                                pack: freshStickerConfig.pack,
                                                author: freshStickerConfig.author,
                                                type: StickerTypes.FULL,
                                                categories: ['😀'],
                                                id: 'com.wilykun.wabot',
                                                quality: 80
                                        });
                                        
                                        const stickerBuffer = await sticker.toBuffer();
                                        
                                        if (!stickerBuffer || stickerBuffer.length === 0) {
                                                await hisoka.sendMessage(m.from, { react: { text: '❌', key: m.key } });
                                                await m.reply('❌ Gagal membuat sticker');
                                                break;
                                        }
                                        
                                        await hisoka.sendMessage(m.from, {
                                                sticker: stickerBuffer
                                        }, { quoted: m });
                                        
                                        await hisoka.sendMessage(m.from, { react: { text: '✅', key: m.key } });
                                        logCommand(m, hisoka, 'sticker');
                                } catch (error) {
                                        console.error('\x1b[31m[Sticker] Error:\x1b[39m', error.message);
                                        await hisoka.sendMessage(m.from, { react: { text: '❌', key: m.key } });
                                        await m.reply(`❌ Error: ${error.message}`);
                                }
                                break;
                        }

                        case 'toimg': {
                                try {
                                        const sharp = (await import('sharp')).default;
                                        
                                        if (!m.isQuoted || quoted.type !== 'stickerMessage') {
                                                await m.reply('❌ Reply sticker untuk dijadikan gambar!');
                                                break;
                                        }
                                        
                                        await hisoka.sendMessage(m.from, { react: { text: '⏳', key: m.key } });
                                        
                                        const stickerBuffer = await downloadMediaMessage(
                                                { ...m.quoted, message: m.quoted.raw },
                                                'buffer',
                                                {},
                                                { logger: hisoka.logger, reuploadRequest: hisoka.updateMediaMessage }
                                        );
                                        
                                        if (!stickerBuffer || stickerBuffer.length === 0) {
                                                await hisoka.sendMessage(m.from, { react: { text: '❌', key: m.key } });
                                                await m.reply('❌ Gagal download sticker');
                                                break;
                                        }
                                        
                                        let imageBuffer;
                                        
                                        try {
                                                imageBuffer = await sharp(stickerBuffer)
                                                        .png()
                                                        .toBuffer();
                                        } catch (sharpError) {
                                                console.log('[Toimg] Sharp failed, trying ffmpeg:', sharpError.message);
                                                const ffmpegExec = util.promisify(exec);
                                                const timestamp = Date.now();
                                                const tempInput = `/tmp/toimg_input_${timestamp}.webp`;
                                                const tempOutput = `/tmp/toimg_output_${timestamp}.png`;
                                                
                                                fs.writeFileSync(tempInput, stickerBuffer);
                                                
                                                try {
                                                        await ffmpegExec(
                                                                `ffmpeg -y -i "${tempInput}" -vframes 1 "${tempOutput}"`,
                                                                { timeout: 30000 }
                                                        );
                                                        if (fs.existsSync(tempOutput)) {
                                                                imageBuffer = fs.readFileSync(tempOutput);
                                                        }
                                                } finally {
                                                        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
                                                        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
                                                }
                                        }
                                        
                                        if (!imageBuffer || imageBuffer.length === 0) {
                                                await hisoka.sendMessage(m.from, { react: { text: '❌', key: m.key } });
                                                await m.reply('❌ Gagal convert sticker ke gambar. Sticker mungkin dalam format yang tidak didukung.');
                                                break;
                                        }
                                        
                                        await hisoka.sendMessage(m.from, {
                                                image: imageBuffer,
                                                caption: '✅ Sticker berhasil diconvert ke gambar!'
                                        }, { quoted: m });
                                        
                                        await hisoka.sendMessage(m.from, { react: { text: '✅', key: m.key } });
                                        logCommand(m, hisoka, 'toimg');
                                } catch (error) {
                                        console.error('\x1b[31m[Toimg] Error:\x1b[39m', error.message);
                                        await hisoka.sendMessage(m.from, { react: { text: '❌', key: m.key } });
                                        await m.reply(`❌ Error: ${error.message}`);
                                }
                                break;
                        }
                                
                        case 'jadibot': {
                                if (!isMainBot(hisoka)) return;
                                if (!m.isOwner) return;

                        const args = m.text.trim().split(/\s+/);
                        let number = args[1]?.replace(/[^0-9]/g, '');

                                if (!number)
                                        return await m.reply('❌ Contoh: .jadibot 628xxxxxxxxxx');

                                if (number.startsWith('08'))
                                        number = '62' + number.slice(1);

                                if (jadibotMap.has(number))
                                        return await m.reply('🤖 Jadibot sudah aktif.');

                                await startJadibot(
                                        number,
                                        (text) => m.reply(text),
                                        hisoka.mainBotNumber   // 🔥 INI YANG WAJIB ADA
                                );
                        }
                                break;

                        case 'stopjadibot': {
                                if (!isMainBot(hisoka)) return;
                                if (!m.isOwner) return;

                        const args = m.text.trim().split(/\s+/);
                        let number = args[1]?.replace(/[^0-9]/g, '');

                                if (!number)
                                        return await m.reply('❌ Contoh: .stopjadibot 628xxxxxxxxxx');

                                if (number.startsWith('08'))
                                        number = '62' + number.slice(1);

                                await stopJadibot(number, (text) => m.reply(text));
                        }
                                break;

                        case 'listjadibot': {
                                if (!isMainBot(hisoka)) return;
                                if (!m.isOwner) return;

                        const list = [...jadibotMap.keys()];

                                await m.reply(
                                        list.length
                                        ? '🤖 Jadibot Aktif:\n\n' +
                                        list.map((v, i) => `${i + 1}. ${v}`).join('\n')
                                        : '❌ Tidak ada jadibot aktif.'
                                );
                        }
                                break;
                        

                        default:
                                break;
                }
        } catch (error) {
                console.error(`\x1b[31mError in message handler:\x1b[39m\n`, error);
        }
}
