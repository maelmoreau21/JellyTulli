import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

function getAppStateDir() {
    return process.env.BACKUP_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "backups");
}

function ensureAppStateDir() {
    const APP_STATE_DIR = getAppStateDir();
    if (!existsSync(APP_STATE_DIR)) {
        mkdirSync(APP_STATE_DIR, { recursive: true });
    }
}

export function readStateFile<T>(fileName: string, fallback: T): T {
    try {
        ensureAppStateDir();
        const APP_STATE_DIR = getAppStateDir();
        const filePath = path.join(APP_STATE_DIR, fileName);
        if (!existsSync(filePath)) return fallback;
        return JSON.parse(readFileSync(filePath, "utf-8")) as T;
    } catch {
        return fallback;
    }
}

export function writeStateFile<T>(fileName: string, data: T) {
    ensureAppStateDir();
    const APP_STATE_DIR = getAppStateDir();
    writeFileSync(path.join(APP_STATE_DIR, fileName), JSON.stringify(data, null, 2), "utf-8");
}
