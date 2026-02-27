import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Endpoint to fetch global settings
export async function GET(req: NextRequest) {
    try {
        let settings = await prisma.globalSettings.findUnique({
            where: { id: "global" }
        });

        // Initialize if empty
        if (!settings) {
            settings = await prisma.globalSettings.create({
                data: {
                    id: "global",
                    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || null,
                    discordAlertsEnabled: false,
                    excludedLibraries: [],
                }
            });
        }

        return NextResponse.json(settings, { status: 200 });
    } catch (error) {
        console.error("Failed to fetch settings:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// Endpoint to update global settings
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { discordWebhookUrl, discordAlertsEnabled, excludedLibraries } = body;

        const updated = await prisma.globalSettings.upsert({
            where: { id: "global" },
            update: {
                discordWebhookUrl: discordWebhookUrl !== undefined ? discordWebhookUrl : undefined,
                discordAlertsEnabled: discordAlertsEnabled !== undefined ? discordAlertsEnabled : undefined,
                excludedLibraries: excludedLibraries !== undefined ? excludedLibraries : undefined,
            },
            create: {
                id: "global",
                discordWebhookUrl: discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL || null,
                discordAlertsEnabled: discordAlertsEnabled || false,
                excludedLibraries: excludedLibraries || [],
            }
        });

        return NextResponse.json(updated, { status: 200 });
    } catch (error) {
        console.error("Failed to update settings:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
