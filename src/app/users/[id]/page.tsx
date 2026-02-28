import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import UserInfo from "./UserInfo";
import UserActivity from "./UserActivity";
import UserRecentMedia from "./UserRecentMedia";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

interface UserPageProps {
    params: Promise<{
        id: string; // jellyfinUserId
    }>;
}

export default async function UserDetailPage({ params }: UserPageProps) {
    const { id: jellyfinUserId } = await params;

    const user = await prisma.user.findUnique({
        where: { jellyfinUserId },
        select: { username: true, jellyfinUserId: true },
    });

    if (!user) notFound();

    return (
        <div className="flex-col md:flex">
            <div className="flex-1 space-y-6 p-8 pt-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0 mb-6">
                    <div className="flex flex-col space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight">
                            Profil: {user.username}
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            ID Jellyfin: {user.jellyfinUserId}
                        </p>
                    </div>
                    <a
                        href={`/wrapped/${jellyfinUserId}`}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white transition-all bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-full hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25"
                    >
                        🎁 Voir le JellyTulli Wrapped
                    </a>
                </div>

                <Suspense fallback={<Skeleton className="w-full h-[250px] rounded-xl bg-zinc-900/50" />}>
                    <UserInfo userId={jellyfinUserId} />
                </Suspense>

                <Suspense fallback={<Skeleton className="w-full h-[300px] rounded-xl bg-zinc-900/50 mt-6" />}>
                    <UserActivity userId={jellyfinUserId} />
                </Suspense>

                <Suspense fallback={<Skeleton className="w-full h-[500px] rounded-xl bg-zinc-900/50 mt-6" />}>
                    <UserRecentMedia userId={jellyfinUserId} />
                </Suspense>
            </div>
        </div>
    );
}
