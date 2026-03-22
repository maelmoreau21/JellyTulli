// Avoid static top-level imports of 'fs' so Turbopack doesn't trace filesystem
function getFS() {
    try {
        // Use eval('require') to avoid static analysis by the bundler
        // eslint-disable-next-line no-eval
        const req = eval('require');
        return req('fs');
    } catch (e) {
        throw new Error('Unable to load fs module dynamically');
    }
}

function getPath() {
    try {
        // eslint-disable-next-line no-eval
        const req = eval('require');
        return req('path');
    } catch (e) {
        throw new Error('Unable to load path module dynamically');
    }
}

function getAppStateDir() {
    const path = getPath();
    return process.env.BACKUP_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "backups");
}

function ensureAppStateDir() {
    const fs = getFS();
    const APP_STATE_DIR = getAppStateDir();
    if (!fs.existsSync(APP_STATE_DIR)) {
        fs.mkdirSync(APP_STATE_DIR, { recursive: true });
    }
}

export function readStateFile<T>(fileName: string, fallback: T): T {
    try {
        ensureAppStateDir();
        const fs = getFS();
        const path = getPath();
        const APP_STATE_DIR = getAppStateDir();
        const filePath = path.join(APP_STATE_DIR, fileName);
        if (!fs.existsSync(filePath)) return fallback;
        return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
    } catch {
        return fallback;
    }
}

export function writeStateFile<T>(fileName: string, data: T) {
    const fs = getFS();
    const path = getPath();
    ensureAppStateDir();
    const APP_STATE_DIR = getAppStateDir();
    fs.writeFileSync(path.join(APP_STATE_DIR, fileName), JSON.stringify(data, null, 2), "utf-8");
}
