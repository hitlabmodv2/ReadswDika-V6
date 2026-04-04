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

const tmpDir = path.join(process.cwd(), 'tmp');

export function ensureTmpDir() {
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
        console.log(`\x1b[32m[Cleaner]\x1b[39m Created tmp folder`);
    }
    return tmpDir;
}

export function getTmpPath(filename) {
    ensureTmpDir();
    return path.join(tmpDir, filename);
}

export function clearTmpFolder() {
    try {
        if (!fs.existsSync(tmpDir)) {
            console.log(`\x1b[33m[Cleaner]\x1b[39m tmp folder not found, creating...`);
            ensureTmpDir();
            return { success: true, deleted: 0, message: 'Folder created' };
        }

        const files = fs.readdirSync(tmpDir);
        let deletedCount = 0;
        let totalSize = 0;

        for (const file of files) {
            const filePath = path.join(tmpDir, file);
            try {
                const stat = fs.statSync(filePath);
                totalSize += stat.size;

                if (stat.isDirectory()) {
                    fs.rmSync(filePath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(filePath);
                }
                deletedCount++;
            } catch (err) {
                console.error(`\x1b[31m[Cleaner]\x1b[39m Failed to delete: ${file}`);
            }
        }

        const sizeStr = formatBytes(totalSize);
        console.log(`\x1b[32m[Cleaner]\x1b[39m Cleared ${deletedCount} files (${sizeStr})`);
        
        return { 
            success: true, 
            deleted: deletedCount, 
            size: totalSize,
            sizeFormatted: sizeStr,
            message: `Berhasil hapus ${deletedCount} file (${sizeStr})`
        };
    } catch (err) {
        console.error(`\x1b[31m[Cleaner]\x1b[39m Error:`, err.message);
        return { success: false, deleted: 0, message: err.message };
    }
}

export function clearOldFiles(hoursOld = 1) {
    try {
        ensureTmpDir();
        
        const files = fs.readdirSync(tmpDir);
        const now = Date.now();
        const maxAge = hoursOld * 60 * 60 * 1000;
        let deletedCount = 0;
        let totalSize = 0;

        for (const file of files) {
            const filePath = path.join(tmpDir, file);
            try {
                const stat = fs.statSync(filePath);
                const fileAge = now - stat.mtime.getTime();

                if (fileAge > maxAge) {
                    totalSize += stat.size;
                    
                    if (stat.isDirectory()) {
                        fs.rmSync(filePath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(filePath);
                    }
                    deletedCount++;
                }
            } catch (err) {
                // Skip files that can't be accessed
            }
        }

        const sizeStr = formatBytes(totalSize);
        if (deletedCount > 0) {
            console.log(`\x1b[32m[Cleaner]\x1b[39m Auto-cleared ${deletedCount} old files (${sizeStr})`);
        }

        return { 
            success: true, 
            deleted: deletedCount, 
            size: totalSize,
            sizeFormatted: sizeStr
        };
    } catch (err) {
        return { success: false, deleted: 0, message: err.message };
    }
}

export function getTmpStats() {
    try {
        ensureTmpDir();
        
        const files = fs.readdirSync(tmpDir);
        let totalSize = 0;
        let fileCount = 0;

        for (const file of files) {
            const filePath = path.join(tmpDir, file);
            try {
                const stat = fs.statSync(filePath);
                if (stat.isDirectory()) {
                    const subFiles = fs.readdirSync(filePath);
                    fileCount += subFiles.length;
                    subFiles.forEach(subFile => {
                        try {
                            const subStat = fs.statSync(path.join(filePath, subFile));
                            totalSize += subStat.size;
                        } catch {}
                    });
                } else {
                    totalSize += stat.size;
                    fileCount++;
                }
            } catch {}
        }

        return {
            files: fileCount,
            size: totalSize,
            sizeFormatted: formatBytes(totalSize),
            path: tmpDir
        };
    } catch (err) {
        return { files: 0, size: 0, sizeFormatted: '0 B', path: tmpDir };
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function startAutoCleaner(intervalHours = 6) {
    console.log(`\x1b[32m[Cleaner]\x1b[39m Auto-cleaner started (every ${intervalHours}h)`);
    
    clearOldFiles(24);
    
    const interval = setInterval(() => {
        clearOldFiles(6);
    }, intervalHours * 60 * 60 * 1000);

    return interval;
}

/**
 * Bersihkan pre-key files yang sudah terpakai (stale) dari session Baileys.
 * Pre-key dengan ID < firstUnuploadedPreKeyId sudah dikonsumsi WhatsApp
 * dan tidak dibutuhkan lagi — aman untuk dihapus.
 * Ini mencegah akumulasi ratusan file kecil yang memperlambat startup.
 */
export function cleanStaleSessionFiles(sessionDir) {
    try {
        const credsPath = path.join(sessionDir, 'creds.json')
        if (!fs.existsSync(credsPath)) return

        const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'))
        const firstUnuploaded = creds.firstUnuploadedPreKeyId ?? creds.nextPreKeyId ?? 0
        if (!firstUnuploaded || firstUnuploaded <= 0) return

        const files = fs.readdirSync(sessionDir)
        let deletedPreKeys = 0
        let deletedSessions = 0
        let deletedSize = 0
        const now = Date.now()
        const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000 // 30 hari

        for (const file of files) {
            const filePath = path.join(sessionDir, file)

            // Hapus pre-key lama yang sudah terpakai
            if (file.startsWith('pre-key-') && file.endsWith('.json')) {
                const idStr = file.replace('pre-key-', '').replace('.json', '')
                const id = parseInt(idStr, 10)
                if (!isNaN(id) && id < firstUnuploaded) {
                    try {
                        const stat = fs.statSync(filePath)
                        deletedSize += stat.size
                        fs.unlinkSync(filePath)
                        deletedPreKeys++
                    } catch {}
                }
                continue
            }

            // Hapus session-* yang sudah lebih dari 30 hari tidak dipakai
            if (file.startsWith('session-') && file.endsWith('.json')) {
                try {
                    const stat = fs.statSync(filePath)
                    if (now - stat.mtimeMs > SESSION_MAX_AGE) {
                        deletedSize += stat.size
                        fs.unlinkSync(filePath)
                        deletedSessions++
                    }
                } catch {}
                continue
            }

            // Hapus sender-key-* yang sudah lebih dari 30 hari tidak dipakai
            if (file.startsWith('sender-key-') && file.endsWith('.json')) {
                try {
                    const stat = fs.statSync(filePath)
                    if (now - stat.mtimeMs > SESSION_MAX_AGE) {
                        deletedSize += stat.size
                        fs.unlinkSync(filePath)
                    }
                } catch {}
            }
        }

        const total = deletedPreKeys + deletedSessions
        if (total > 0) {
            const sizeStr = formatBytes(deletedSize)
            console.log(
                `\x1b[32m[SessionCleaner]\x1b[39m` +
                ` Hapus ${deletedPreKeys} pre-key stale` +
                (deletedSessions > 0 ? ` + ${deletedSessions} session lama` : '') +
                ` → hemat ${sizeStr}`
            )
        } else {
            console.log(`\x1b[32m[SessionCleaner]\x1b[39m Session sudah bersih`)
        }
    } catch (err) {
        console.error(`\x1b[31m[SessionCleaner]\x1b[39m Error:`, err.message)
    }
}

export default {
    ensureTmpDir,
    getTmpPath,
    clearTmpFolder,
    clearOldFiles,
    getTmpStats,
    startAutoCleaner,
    cleanStaleSessionFiles
};
