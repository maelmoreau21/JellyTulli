import prisma from "@/lib/prisma";
import { getTranslations } from 'next-intl/server';
import LibraryStats from '@/components/media/LibraryStats';
import { formatSize } from '@/lib/size';
import { buildExcludedMediaClause, inferLibraryKey } from '@/lib/mediaPolicy';
import { getSanitizedLibraryNames, GHOST_LIBRARY_NAMES } from "@/lib/libraryUtils";
import { isZapped, ZAPPING_CONDITION } from '@/lib/statsUtils';

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
    const t = await getTranslations('media');
    const tc = await getTranslations('common');

    const settings = await prisma.globalSettings.findUnique({ where: { id: "global" } });
    const excludedLibraries = settings?.excludedLibraries || [];

    // Fetch all leaf media items for library aggregation
    const allMedia = await prisma.media.findMany({
        where: buildExcludedMediaClause(excludedLibraries) || {},
        select: { type: true, size: true, durationMs: true, libraryName: true, title: true, collectionType: true }
    });

    const libraryStatsMap = new Map<string, { size: bigint; duration: bigint; watchedSeconds?: number; items: number; movies: number; series: number; music: number; books: number, collectionType?: string | null }>();

    const sanitizedLibraries = await getSanitizedLibraryNames();
    const ghostNames = new Set(GHOST_LIBRARY_NAMES);

    // Pre-populate sanitized libraries so empty ones show
    for (const name of sanitizedLibraries) {
        if (!libraryStatsMap.has(name)) {
            libraryStatsMap.set(name, { size: BigInt(0), duration: BigInt(0), watchedSeconds: 0, items: 0, movies: 0, series: 0, music: 0, books: 0, collectionType: null });
        }
    }

    let totalSizeBytes = BigInt(0);
    let totalDurationMs = BigInt(0);
    let movieCount = 0;
    let seriesCount = 0;
    let albumCount = 0;
    let bookCount = 0;

    // Compute per-library stats from the fetched `allMedia` array. Using the client-side pass
    // avoids mismatches related to DB groupBy filters and keeps logic consistent for different
    // Jellyfin media `type` values (Track, MusicAlbum, Audio, Episode, etc.).
    allMedia.forEach(m => {
        if (!m.libraryName || ghostNames.has(m.libraryName) || m.collectionType === 'boxsets') return;
        const libName = m.libraryName;
        if (!libraryStatsMap.has(libName)) {
            libraryStatsMap.set(libName, { size: BigInt(0), duration: BigInt(0), watchedSeconds: 0, items: 0, movies: 0, series: 0, music: 0, books: 0, collectionType: m.collectionType });
        }
        const lib = libraryStatsMap.get(libName)!;
        if (!lib.collectionType && m.collectionType) lib.collectionType = m.collectionType;

        // Aggregate size (if present)
        if (m.size != null) {
            const sizeBig = typeof m.size === 'bigint' ? m.size : BigInt(Math.floor(Number(m.size)));
            lib.size = (lib.size || BigInt(0)) + sizeBig;
            totalSizeBytes += sizeBig;
        }

        // Aggregate duration (if present)
        if (m.durationMs != null) {
            const durBig = typeof m.durationMs === 'bigint' ? m.durationMs : BigInt(Math.floor(Number(m.durationMs)));
            lib.duration = (lib.duration || BigInt(0)) + durBig;
            totalDurationMs += durBig;
        }

        // Classify via inferLibraryKey to be resilient to Jellyfin type variants
        const libKey = inferLibraryKey({ collectionType: m.collectionType, type: m.type, durationMs: m.durationMs });
        lib.items = (lib.items || 0) + 1;
        if (libKey === 'movies') { movieCount++; lib.movies++; }
        else if (libKey === 'tvshows') { seriesCount++; lib.series++; }
        else if (libKey === 'music') { albumCount++; lib.music++; }
        else if (libKey === 'books') { bookCount++; lib.books++; }
    });

    // Sizes were aggregated above from the `allMedia` set to avoid DB groupBy mismatches
    // and to support the variety of Jellyfin `type` values. If needed, a DB-side groupBy
    // could be reintroduced but must include all relevant types.

    try {
        const playbackAgg = await prisma.playbackHistory.groupBy({ by: ['mediaId'], _sum: { durationWatched: true }, where: ZAPPING_CONDITION });
        const mediaIdsWithHistory = playbackAgg.map(p => p.mediaId);
        const mediasForHistory = mediaIdsWithHistory.length > 0 ? await prisma.media.findMany({ where: { id: { in: mediaIdsWithHistory } }, select: { id: true, libraryName: true } }) : [];
        const mediaToLib = new Map(mediasForHistory.map(m => [m.id, m.libraryName || tc('other')]));
        for (const p of playbackAgg) {
            const libName = mediaToLib.get(p.mediaId) || tc('other');
            if (!libraryStatsMap.has(libName)) {
                libraryStatsMap.set(libName, { size: BigInt(0), duration: BigInt(0), watchedSeconds: 0, items: 0, movies: 0, series: 0, music: 0, books: 0, collectionType: null });
            }
            const lib = libraryStatsMap.get(libName)!;
            lib.watchedSeconds = (lib.watchedSeconds ?? 0) + (p._sum?.durationWatched ?? 0);
        }
    } catch (e) {
        console.warn('[CollectionsPage] Failed to aggregate playback history by library:', e);
    }

    const globalSize = formatSize(totalSizeBytes);
    const totalTB = `${globalSize.value} ${globalSize.unit}`;

    const totalDays = Math.floor(Number(totalDurationMs) / (1000 * 60 * 60 * 24));
    const totalHoursAfterDays = Math.floor((Number(totalDurationMs) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const timeLabel = t('timeDays', { days: totalDays, hours: totalHoursAfterDays });

    const validLibraries = Array.from(libraryStatsMap.entries()).filter(([name, stats]) => {
        if (new Set(GHOST_LIBRARY_NAMES).has(name)) return false;
        if (name === tc('other')) {
            const hasItems = stats.movies > 0 || stats.series > 0 || stats.music > 0 || stats.books > 0;
            return hasItems;
        }
        return true;
    });

    const libraryStatsList = await Promise.all(validLibraries.map(async ([name, stats]) => {
        const size = formatSize(stats.size);
        const topContent = await prisma.playbackHistory.groupBy({ by: ['mediaId'], where: { media: { libraryName: name } }, _count: { mediaId: true }, orderBy: { _count: { mediaId: 'desc' } }, take: 1 });
        let topItem = null;
        if (topContent.length > 0) {
            topItem = await prisma.media.findUnique({ where: { id: topContent[0].mediaId }, select: { title: true, type: true, jellyfinMediaId: true } });
        }
        const lastAdded = await prisma.media.findFirst({ where: { libraryName: name, type: { in: ['Movie', 'Series', 'MusicAlbum', 'BoxSet'] } }, orderBy: { dateAdded: 'desc' }, select: { title: true, dateAdded: true, jellyfinMediaId: true } });
        let d = 0; let h = 0;
        if (stats.watchedSeconds && stats.watchedSeconds > 0) {
            d = Math.floor(stats.watchedSeconds / (60 * 60 * 24));
            h = Math.floor((stats.watchedSeconds % (60 * 60 * 24)) / (60 * 60));
        } else {
            d = Math.floor(Number(stats.duration) / (1000 * 60 * 60 * 24));
            h = Math.floor((Number(stats.duration) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        }
        return {
            name,
            collectionType: stats.collectionType,
            size: `${size.value} ${size.unit}`,
            duration: t('timeDays', { days: d, hours: h }),
            counts: [ stats.movies > 0 && `${stats.movies} ${tc('movies').toLowerCase()}`, stats.series > 0 && `${stats.series} ${tc('series').toLowerCase()}`, stats.music > 0 && `${stats.music} albums`, stats.books > 0 && `${stats.books} ${tc('books').toLowerCase()}` ].filter(Boolean).join(', ') || tc('noData'),
            topItem: (topItem && topContent[0]._count.mediaId) ? { title: topItem.title, plays: topContent[0]._count.mediaId, id: topItem.jellyfinMediaId } : null,
            lastAdded: lastAdded ? { title: lastAdded.title, date: lastAdded.dateAdded ? lastAdded.dateAdded.toISOString() : null, id: lastAdded.jellyfinMediaId } : null
        };
    }));

    libraryStatsList.sort((a, b) => b.name.localeCompare(a.name));

    return (
        <div className="p-6 max-w-[1400px] mx-auto">
            <h1 className="text-2xl font-bold mb-4">{t('libraryCollections') || 'Collections'}</h1>
            <LibraryStats
                totalTB={totalTB}
                movieCount={movieCount}
                seriesCount={seriesCount}
                albumCount={albumCount}
                bookCount={bookCount}
                timeLabel={timeLabel}
                libraries={libraryStatsList}
            />
        </div>
    );
}
