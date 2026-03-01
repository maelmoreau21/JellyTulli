import prisma from "@/lib/prisma";
import { FallbackImage } from "@/components/FallbackImage";
import Link from "next/link";
import { Clock, Sparkles, Film, Tv, Music, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { getJellyfinImageUrl } from "@/lib/jellyfin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const ITEMS_PER_PAGE = 40;

function getTypeBadge(type: string) {
  switch (type) {
    case "Movie": return { label: "Film", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Film };
    case "Series": return { label: "Série", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: Tv };
    case "Season": return { label: "Saison", color: "bg-teal-500/20 text-teal-400 border-teal-500/30", icon: Tv };
    case "Episode": return { label: "Épisode", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: Tv };
    case "MusicAlbum": return { label: "Album", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Music };
    case "Audio": return { label: "Piste", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: Music };
    default: return { label: type, color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30", icon: BookOpen };
  }
}

function isNew(date: Date): boolean {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return date >= sevenDaysAgo;
}

export default async function RecentPage({ searchParams }: { searchParams: Promise<{ type?: string; page?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    const uid = (session?.user as any)?.jellyfinUserId;
    redirect(uid ? `/users/${uid}` : "/login");
  }

  const sParams = await searchParams;
  const type = sParams.type;
  const currentPage = Math.max(1, parseInt(sParams.page || "1", 10) || 1);

  // Retrieve settings for excluded libraries
  const settings = await prisma.globalSettings.findUnique({ where: { id: "global" } });
  const excludedLibraries = settings?.excludedLibraries || [];

  // Build type filter — show parent-level items (Movie, Series, MusicAlbum) by default
  const displayTypes = type === "movie" ? ["Movie"]
    : type === "series" ? ["Series"]
    : type === "music" ? ["MusicAlbum"]
    : ["Movie", "Series", "MusicAlbum"];

  const AND: any[] = [{ type: { in: displayTypes } }];
  if (excludedLibraries.length > 0) {
    AND.push({
      NOT: {
        OR: [
          { type: { in: excludedLibraries } },
          ...excludedLibraries.map((lib: string) => ({ collectionType: lib }))
        ]
      }
    });
  }
  const mediaWhere = { AND };

  const totalCount = await prisma.media.count({ where: mediaWhere });
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);

  const recentMedia = await prisma.media.findMany({
    where: mediaWhere,
    orderBy: { createdAt: "desc" },
    take: ITEMS_PER_PAGE,
    skip: (page - 1) * ITEMS_PER_PAGE,
    select: {
      id: true,
      jellyfinMediaId: true,
      title: true,
      type: true,
      genres: true,
      resolution: true,
      parentId: true,
      createdAt: true,
      _count: { select: { playbackHistory: true } },
    },
  });

  const buildUrl = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    if (params.type) sp.set("type", params.type);
    if (params.page) sp.set("page", params.page);
    return `/recent?${sp.toString()}`;
  };

  return (
    <div className="flex-col md:flex">
      <div className="flex-1 space-y-6 p-8 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-primary" />
              Récemment Ajouté
            </h2>
            <Tabs defaultValue={type || "all"} className="w-[380px]">
              <TabsList className="bg-zinc-900 border border-zinc-800">
                <TabsTrigger value="all" asChild><Link href={buildUrl({})}>Tous</Link></TabsTrigger>
                <TabsTrigger value="movie" asChild><Link href={buildUrl({ type: "movie" })}>Films</Link></TabsTrigger>
                <TabsTrigger value="series" asChild><Link href={buildUrl({ type: "series" })}>Séries</Link></TabsTrigger>
                <TabsTrigger value="music" asChild><Link href={buildUrl({ type: "music" })}>Musique</Link></TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <span className="text-sm text-zinc-400">{totalCount} médias</span>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {recentMedia.map((media) => {
            const badge = getTypeBadge(media.type);
            const Icon = badge.icon;
            const dateAdded = new Date(media.createdAt);
            const isRecent = isNew(dateAdded);
            const plays = media._count.playbackHistory;

            return (
              <Link key={media.id} href={`/media/${media.jellyfinMediaId}`} className="group">
                <Card className="bg-zinc-900/50 border-zinc-800/50 hover:border-primary/40 transition-all overflow-hidden">
                  <div className="relative aspect-[2/3] overflow-hidden">
                    <FallbackImage
                      src={getJellyfinImageUrl(media.jellyfinMediaId, 'Primary', media.parentId || undefined)}
                      alt={media.title}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                    {/* Nouveau badge */}
                    {isRecent && (
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-primary text-white border-0 text-[10px] px-1.5 py-0.5 font-bold shadow-lg">
                          NOUVEAU
                        </Badge>
                      </div>
                    )}
                    {/* Type badge */}
                    <div className="absolute top-2 right-2">
                      <Badge className={`${badge.color} border text-[10px] px-1.5 py-0.5`}>
                        <Icon className="w-3 h-3 mr-1" />
                        {badge.label}
                      </Badge>
                    </div>
                    {/* Bottom gradient */}
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-zinc-950 to-transparent" />
                  </div>
                  <CardContent className="p-3 space-y-1">
                    <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                      {media.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {dateAdded.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </span>
                      {plays > 0 && (
                        <span className="text-zinc-400">· {plays} lecture{plays > 1 ? "s" : ""}</span>
                      )}
                    </div>
                    {media.genres.length > 0 && (
                      <p className="text-[11px] text-zinc-600 truncate">{media.genres.slice(0, 3).join(", ")}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {recentMedia.length === 0 && (
          <Card className="bg-zinc-900/50 border-zinc-800/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-zinc-500">
              <Sparkles className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Aucun média trouvé</p>
              <p className="text-sm mt-1">Lancez une synchronisation depuis les Paramètres.</p>
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            {page > 1 && (
              <Link href={buildUrl({ type, page: String(page - 1) })} className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/70 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Précédent
              </Link>
            )}
            <span className="text-sm text-zinc-400 px-4">Page {page} / {totalPages}</span>
            {page < totalPages && (
              <Link href={buildUrl({ type, page: String(page + 1) })} className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/70 transition-colors">
                Suivant <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
