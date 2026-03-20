import prisma from "./prisma";

/**
 * Common list of 'ghost' library names created by sync fallbacks
 * or Jellyfin internal pseudo-libraries.
 */
export const GHOST_LIBRARY_NAMES = [
  'Movies', 'TV Shows', 'Music', 'Books', 
  'movies', 'tvshows', 'music', 'books', 
  'Collections'
];

/**
 * Fetches the list of library names from both Jellyfin (via VirtualFolders)
 * and the local Database, filtering out ghost names and pseudo-libraries.
 */
export async function getSanitizedLibraryNames() {
  const jellyfinUrl = process.env.JELLYFIN_URL;
  const jellyfinApiKey = process.env.JELLYFIN_API_KEY;

  let jellyfinNames: string[] = [];

  // 1. Fetch from Jellyfin
  if (jellyfinUrl && jellyfinApiKey) {
    try {
      const response = await fetch(`${jellyfinUrl}/Library/VirtualFolders`, {
        headers: { "X-Emby-Token": jellyfinApiKey },
        cache: "no-store",
      });
      if (response.ok) {
        const folders = await response.json();
        jellyfinNames = (folders || [])
          .filter((f: any) => f?.CollectionType !== 'boxsets')
          .map((f: any) => f?.Name)
          .filter((n: any): n is string => Boolean(n));
      }
    } catch (e) {
      console.error("[LibraryUtils] Failed to fetch Jellyfin VirtualFolders:", e);
    }
  }

  // 2. Fetch from Database
  const dbEntries = await prisma.media.findMany({
    distinct: ["libraryName"],
    where: { libraryName: { not: null } },
    select: { libraryName: true }
  });
  const dbNames = dbEntries.map(e => e.libraryName as string);

  // 3. Consolidate & Filter
  const ghostSet = new Set(GHOST_LIBRARY_NAMES);
  const realSet = new Set(jellyfinNames);

  const allNames = new Set<string>([...jellyfinNames]);

  for (const name of dbNames) {
    // We keep a DB name IF it's not a ghost name OR if it's explicitly a real Jellyfin library
    if (!ghostSet.has(name) || realSet.has(name)) {
      allNames.add(name);
    }
  }

  return Array.from(allNames).sort((a, b) => a.localeCompare(b));
}
