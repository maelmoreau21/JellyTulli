type FsLike = {
    constants: { W_OK: number };
    existsSync: (path: string) => boolean;
    mkdirSync: (path: string, options?: { recursive?: boolean }) => void;
    accessSync: (path: string, mode?: number) => void;
    writeFileSync: (path: string, data: string, encoding: string) => void;
    unlinkSync: (path: string) => void;
};

type PathLike = {
    join: (...parts: string[]) => string;
    resolve: (...paths: string[]) => string;
};

type OsLike = {
    tmpdir: () => string;
};

const FALLBACK_TMP_DIR = "jellytrack-backups";
let cachedBackupDirectory: string | null = null;

function loadModule<T>(moduleName: string): T {
    try {
        const req = eval("require");
        return req(moduleName) as T;
    } catch {
        throw new Error(`Unable to load ${moduleName} module dynamically`);
    }
}

function isWritableDirectory(fs: FsLike, path: PathLike, directory: string) {
    try {
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }

        fs.accessSync(directory, fs.constants.W_OK);

        const probeFile = path.join(directory, `.write-test-${process.pid}-${Date.now()}.tmp`);
        fs.writeFileSync(probeFile, "ok", "utf-8");
        fs.unlinkSync(probeFile);
        return true;
    } catch {
        return false;
    }
}

export function getBackupDirectory() {
    if (cachedBackupDirectory) {
        return cachedBackupDirectory;
    }

    const fs = loadModule<FsLike>("fs");
    const path = loadModule<PathLike>("path");
    const os = loadModule<OsLike>("os");

    const configured = String(process.env.BACKUP_DIR || "").trim();
    const candidates = [
        configured,
        "./backups",
        path.join(process.cwd(), "backups"),
        path.join(os.tmpdir(), FALLBACK_TMP_DIR),
    ].filter(Boolean);

    const uniqueCandidates = Array.from(new Set(candidates.map((candidate) => path.resolve(candidate))));

    for (const candidate of uniqueCandidates) {
        if (isWritableDirectory(fs, path, candidate)) {
            cachedBackupDirectory = candidate;

            if (configured && path.resolve(configured) !== candidate) {
                console.warn(`[Backup] BACKUP_DIR is not writable (${configured}). Falling back to ${candidate}.`);
            }

            return candidate;
        }
    }

    throw new Error(`No writable backup directory found. Tried: ${uniqueCandidates.join(", ")}`);
}
