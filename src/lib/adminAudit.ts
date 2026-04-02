import prisma from "@/lib/prisma";

interface AuditEntryInput {
    action: string;
    actorUserId?: string | null;
    actorUsername?: string | null;
    target?: string | null;
    ipAddress?: string | null;
    details?: Record<string, unknown> | null;
}

export function getRequestIp(req: Request): string | null {
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
        const first = forwardedFor.split(",")[0]?.trim();
        if (first) return normalizeIp(first);
    }

    return normalizeIp(req.headers.get("x-real-ip"));
}

function normalizeIp(value: string | null): string | null {
    if (!value) return null;

    const trimmed = value.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith("::ffff:")) {
        return trimmed.slice(7);
    }

    return trimmed;
}

export async function writeAdminAuditLog(input: AuditEntryInput): Promise<void> {
    try {
        await (prisma as any).adminAuditLog.create({
            data: {
                action: input.action,
                actorUserId: input.actorUserId ?? null,
                actorUsername: input.actorUsername ?? null,
                target: input.target ?? null,
                ipAddress: input.ipAddress ?? null,
                details: input.details ?? null,
            },
        });
    } catch (error) {
        // Audit logging must never break business-critical routes.
        console.error("[AdminAudit] Failed to write audit event:", error);
    }
}
