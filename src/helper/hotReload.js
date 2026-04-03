import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const ROOT = process.cwd();
const DEBOUNCE_MS = 600;

const _handlers = {};
const _watchers = {};
const _debounceTimers = {};

const WATCHED_FILES = [
    { key: 'message',    rel: 'src/handler/message.js' },
    { key: 'antidelete', rel: 'src/handler/antidelete.js' },
    { key: 'event',      rel: 'src/handler/event.js' },
    { key: 'utils',      rel: 'src/helper/utils.js' },
];

async function loadModule(rel) {
    const abs = path.join(ROOT, rel);
    const url = pathToFileURL(abs).href + `?t=${Date.now()}`;
    try {
        const mod = await import(url);
        return mod.default ?? mod;
    } catch (err) {
        console.error(`\x1b[31m[HotReload] Gagal load '${rel}':\x1b[39m`, err.message);
        return null;
    }
}

function watchFile(rel, key) {
    const abs = path.join(ROOT, rel);

    if (_watchers[key]) {
        try { _watchers[key].close(); } catch {}
    }

    try {
        _watchers[key] = fs.watch(abs, { persistent: false }, (event) => {
            if (event !== 'change' && event !== 'rename') return;

            clearTimeout(_debounceTimers[key]);
            _debounceTimers[key] = setTimeout(async () => {
                console.log(`\x1b[36m[HotReload] Perubahan terdeteksi: ${rel}\x1b[39m`);
                const mod = await loadModule(rel);
                if (mod !== null) {
                    _handlers[key] = mod;
                    console.log(`\x1b[32m[HotReload] ✓ '${rel}' berhasil di-reload tanpa restart bot!\x1b[39m`);
                } else {
                    console.error(`\x1b[31m[HotReload] ✗ Gagal reload '${rel}', pakai versi lama.\x1b[39m`);
                }

                if (event === 'rename') {
                    watchFile(rel, key);
                }
            }, DEBOUNCE_MS);
        });
    } catch (err) {
        console.error(`\x1b[31m[HotReload] Tidak bisa watch '${rel}':\x1b[39m`, err.message);
    }
}

export async function initHotReload() {
    console.log('\x1b[36m────────────────────────────────────────\x1b[39m');
    console.log('\x1b[36mHot Reload Dimulai\x1b[39m');

    for (const { key, rel } of WATCHED_FILES) {
        const mod = await loadModule(rel);
        if (mod !== null) {
            _handlers[key] = mod;
            watchFile(rel, key);
            console.log(`\x1b[32m[HotReload] Watching: ${rel}\x1b[39m`);
        } else {
            console.error(`\x1b[31m[HotReload] Skip watch '${rel}' (gagal load awal)\x1b[39m`);
        }
    }

    console.log('\x1b[36m────────────────────────────────────────\x1b[39m');
}

export function getHandler(key) {
    return _handlers[key];
}

export function stopHotReload() {
    for (const key of Object.keys(_watchers)) {
        try { _watchers[key].close(); } catch {}
        delete _watchers[key];
    }
    for (const key of Object.keys(_debounceTimers)) {
        clearTimeout(_debounceTimers[key]);
        delete _debounceTimers[key];
    }
    console.log('\x1b[33m[HotReload] Semua watcher dihentikan.\x1b[39m');
}
