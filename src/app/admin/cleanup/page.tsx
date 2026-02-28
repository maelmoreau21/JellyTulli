import { Suspense } from "react";
import prisma from "@/lib/prisma";
import CleanupClient from "./CleanupClient";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

async function getCleanupData() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // 1. Ghost Media (Added > 30 days ago, 0 plays)
    const ghostMedia = await prisma.media.findMany({
        where: {
            createdAt: { lt: thirtyDaysAgo },
            playbackHistory: { none: {} }
        },
        select: {
            id: true,
            jellyfinMediaId: true,
            title: true,
            type: true,
            createdAt: true,
            durationMs: true,
        },
        orderBy: { createdAt: 'asc' }
    });

    // 2. Abandoned Media (Never finished > 80% by any user)
    // We only fetch media that have some history and a duration > 0 to calculate completion
    const mediaWithHistory = await prisma.media.findMany({
        where: {
            playbackHistory: { some: {} },
            durationMs: { not: null }
        },
        select: {
            id: true,
            jellyfinMediaId: true,
            title: true,
            type: true,
            durationMs: true,
            playbackHistory: {
                select: {
                    durationWatched: true,
                    startedAt: true,
                }
            }
        }
    });

    const abandonedMedia = [];

    for (const media of mediaWithHistory) {
        if (!media.durationMs || Number(media.durationMs) === 0) continue;

        // Convert Ticks to Seconds
        const maxDurationSecs = Number(media.durationMs) / 10000000;

        let maxCompletionPercentage = 0;
        let lastPlayed = new Date(0);

        for (const history of media.playbackHistory) {
            const completion = (history.durationWatched / maxDurationSecs) * 100;
            if (completion > maxCompletionPercentage) maxCompletionPercentage = completion;
            if (history.startedAt > lastPlayed) lastPlayed = history.startedAt;
        }

        // If even the best session didn't reach 80%, it's abandoned
        if (maxCompletionPercentage > 0 && maxCompletionPercentage < 80) {
            abandonedMedia.push({
                ...media,
                maxCompletion: maxCompletionPercentage,
                lastPlayed
            });
        }
    }

    // Sort abandoned by least recently played
    abandonedMedia.sort((a, b) => a.lastPlayed.getTime() - b.lastPlayed.getTime());

    return {
        ghostMedia: ghostMedia.map(item => ({
            ...item,
            durationMs: item.durationMs ? Number(item.durationMs).toString() : null
        })),
        abandonedMedia: abandonedMedia.map(item => ({
            ...item,
            durationMs: item.durationMs ? Number(item.durationMs).toString() : null
        }))
    };
}

export default async function CleanupPage() {
    return (
        <div className="flex-col md:flex">
            <div className="flex-1 space-y-6 p-8 pt-6 max-w-6xl mx-auto w-full">
                <div className="flex items-center justify-between space-y-2 mb-6">
                    <h2 className="text-3xl font-bold tracking-tight">Assistant de Nettoyage</h2>
                </div>

                <Suspense fallback={<Skeleton className="w-full h-[600px] rounded-xl bg-zinc-900/50" />}>
                    <CleanupDataFetcher />
                </Suspense>
            </div>
        </div>
    );
}

async function CleanupDataFetcher() {
    const data = await getCleanupData();
    return <CleanupClient initialData={data} />;
}
