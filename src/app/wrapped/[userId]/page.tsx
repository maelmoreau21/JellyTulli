import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import WrappedClient from "./WrappedClient";

export const dynamic = "force-dynamic";

interface WrappedPageProps {
    params: Promise<{
        userId: string;
    }>;
}

interface CategoryBreakdown {
    totalSeconds: number;
    totalHours: number;
    topMedia: { title: string; seconds: number }[];
}

export default async function WrappedPage({ params }: WrappedPageProps) {
    const { userId } = await params;

    const user = await prisma.user.findUnique({
        where: { jellyfinUserId: userId },
        include: {
            playbackHistory: {
                where: {
                    startedAt: {
                        gte: new Date(new Date().getFullYear(), 0, 1), // Only this year
                    },
                },
                include: {
                    media: true
                }
            }
        }
    });

    if (!user) notFound();

    // Computing the Wrapped Data
    let totalSeconds = 0;
    const mediaCounts = new Map<string, number>();
    const genreCounts = new Map<string, number>();
    const dayCounts = new Map<number, number>(); // 0 = Sunday, 1 = Monday...

    // Category breakdowns
    const categoryData: Record<string, Map<string, number>> = {
        Movie: new Map(),
        Episode: new Map(),
        Audio: new Map(),
    };
    const categoryTotals: Record<string, number> = { Movie: 0, Episode: 0, Audio: 0 };

    user.playbackHistory.forEach((session: any) => {
        totalSeconds += session.durationWatched;

        if (session.media) {
            mediaCounts.set(session.media.title, (mediaCounts.get(session.media.title) || 0) + session.durationWatched);

            if (session.media.genres) {
                session.media.genres.forEach((g: string) => {
                    genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
                });
            }

            // Categorize by media type
            const type = session.media.type;
            let category: string | null = null;
            if (type === "Movie") category = "Movie";
            else if (type === "Episode") category = "Episode";
            else if (type === "Audio") category = "Audio";

            if (category) {
                categoryTotals[category] += session.durationWatched;
                const map = categoryData[category];
                map.set(session.media.title, (map.get(session.media.title) || 0) + session.durationWatched);
            }
        }

        const day = new Date(session.startedAt).getDay();
        dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    });

    const totalHours = Math.round(totalSeconds / 3600);

    const topMedia = Array.from(mediaCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(e => e[0]);

    const topGenre = Array.from(genreCounts.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "Inconnu";

    const topDayNumber = Array.from(dayCounts.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;

    const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const topDay = days[topDayNumber];

    const currentYear = new Date().getFullYear();

    // Build category breakdowns
    const buildBreakdown = (key: string): CategoryBreakdown => {
        const map = categoryData[key];
        const secs = categoryTotals[key];
        const top = Array.from(map.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([title, seconds]) => ({ title, seconds }));
        return { totalSeconds: secs, totalHours: Math.round(secs / 3600), topMedia: top };
    };

    const wrappedData = {
        username: user.username,
        year: currentYear,
        totalHours,
        topMedia,
        topGenre,
        topDay,
        totalSessions: user.playbackHistory.length,
        categories: {
            movies: buildBreakdown("Movie"),
            series: buildBreakdown("Episode"),
            music: buildBreakdown("Audio"),
        },
    };

    return <WrappedClient data={wrappedData} />;
}
