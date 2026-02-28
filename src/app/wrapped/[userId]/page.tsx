import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import WrappedClient from "./WrappedClient";

export const dynamic = "force-dynamic";

interface WrappedPageProps {
    params: Promise<{
        userId: string;
    }>;
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

    user.playbackHistory.forEach((session: any) => {
        totalSeconds += session.durationWatched;

        if (session.media) {
            mediaCounts.set(session.media.title, (mediaCounts.get(session.media.title) || 0) + session.durationWatched);

            if (session.media.genres) {
                session.media.genres.forEach((g: string) => {
                    genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
                });
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

    const wrappedData = {
        username: user.username,
        year: currentYear,
        totalHours,
        topMedia,
        topGenre,
        topDay,
        totalSessions: user.playbackHistory.length
    };

    return <WrappedClient data={wrappedData} />;
}
