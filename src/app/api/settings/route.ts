import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, isAuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Endpoint to fetch global settings (admin only)
export async function GET(req: NextRequest) {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;

    try {
        let settings = await prisma.globalSettings.findUnique({
            where: { id: "global" }
        });

        // Initialize if empty
        if (!settings) {
            settings = await prisma.globalSettings.create({
                data: {
                    id: "global",
                    discordWebhookUrl: null,
                    discordAlertCondition: "ALL",
                    discordAlertsEnabled: false,
                    excludedLibraries: [],
                    monitorIntervalActive: 1000,
                    monitorIntervalIdle: 5000,
                }
            });
        }

        return NextResponse.json(settings, { status: 200 });
    } catch (error) {
        console.error("Failed to fetch settings:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// Endpoint to update global settings (admin only)
export async function POST(req: NextRequest) {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;

    try {
        const body = await req.json();
        const { discordWebhookUrl, discordAlertCondition, discordAlertsEnabled, excludedLibraries, monitorIntervalActive, monitorIntervalIdle } = body;

        // Input validation — Discord webhook URL must be a valid Discord URL or null
        if (discordWebhookUrl !== undefined && discordWebhookUrl !== null && discordWebhookUrl !== "") {
            try {
                const parsed = new URL(discordWebhookUrl);
                if (!parsed.hostname.endsWith("discord.com") && !parsed.hostname.endsWith("discordapp.com")) {
                    return NextResponse.json({ error: "L'URL du webhook Discord doit pointer vers discord.com" }, { status: 400 });
                }
                if (parsed.protocol !== "https:") {
                    return NextResponse.json({ error: "L'URL du webhook doit utiliser HTTPS" }, { status: 400 });
                }
            } catch {
                return NextResponse.json({ error: "URL du webhook invalide." }, { status: 400 });
            }
        }

        // Input validation — alert condition must be a known value
        const VALID_CONDITIONS = ["ALL", "TRANSCODE_ONLY", "NEW_IP_ONLY"];
        if (discordAlertCondition !== undefined && !VALID_CONDITIONS.includes(discordAlertCondition)) {
            return NextResponse.json({ error: "Condition d'alerte invalide." }, { status: 400 });
        }

        // Input validation — intervals must be positive numbers within sane bounds
        if (monitorIntervalActive !== undefined) {
            const val = Number(monitorIntervalActive);
            if (isNaN(val) || val < 500 || val > 60000) {
                return NextResponse.json({ error: "monitorIntervalActive doit être entre 500ms et 60000ms." }, { status: 400 });
            }
        }
        if (monitorIntervalIdle !== undefined) {
            const val = Number(monitorIntervalIdle);
            if (isNaN(val) || val < 1000 || val > 300000) {
                return NextResponse.json({ error: "monitorIntervalIdle doit être entre 1000ms et 300000ms." }, { status: 400 });
            }
        }

        const updated = await prisma.globalSettings.upsert({
            where: { id: "global" },
            update: {
                discordWebhookUrl: discordWebhookUrl !== undefined ? discordWebhookUrl : undefined,
                discordAlertCondition: discordAlertCondition !== undefined ? discordAlertCondition : undefined,
                discordAlertsEnabled: discordAlertsEnabled !== undefined ? discordAlertsEnabled : undefined,
                excludedLibraries: excludedLibraries !== undefined ? excludedLibraries : undefined,
                monitorIntervalActive: monitorIntervalActive !== undefined ? monitorIntervalActive : undefined,
                monitorIntervalIdle: monitorIntervalIdle !== undefined ? monitorIntervalIdle : undefined,
            },
            create: {
                id: "global",
                discordWebhookUrl: discordWebhookUrl || null,
                discordAlertCondition: discordAlertCondition || "ALL",
                discordAlertsEnabled: discordAlertsEnabled || false,
                excludedLibraries: excludedLibraries || [],
                monitorIntervalActive: monitorIntervalActive || 1000,
                monitorIntervalIdle: monitorIntervalIdle || 5000,
            }
        });

        // Update monitor intervals in real-time (same Node.js process)
        if (monitorIntervalActive !== undefined || monitorIntervalIdle !== undefined) {
            try {
                const { updateMonitorIntervals } = await import("@/server/monitor");
                updateMonitorIntervals(
                    updated.monitorIntervalActive,
                    updated.monitorIntervalIdle
                );
            } catch (err) {
                console.warn("[Settings] Could not update monitor intervals:", err);
            }
        }

        return NextResponse.json(updated, { status: 200 });
    } catch (error) {
        console.error("Failed to update settings:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
