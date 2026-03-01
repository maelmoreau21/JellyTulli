import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Categorize a Jellyfin client name into a device category.
 */
export function categorizeClient(clientName: string): string {
    const lower = (clientName || "").toLowerCase();
    // TV / Smart TV / STB
    if (lower.includes("tv") || lower.includes("androidtv") || lower.includes("firestick") || lower.includes("roku") || lower.includes("chromecast") || lower.includes("apple tv") || lower.includes("kodi") || lower.includes("swiftfin") || lower.includes("infuse")) return "TV";
    // Web
    if (lower.includes("web") || lower.includes("jellyfin web") || lower.includes("browser") || lower.includes("chrome") || lower.includes("firefox") || lower.includes("safari") || lower.includes("edge")) return "Web";
    // Mobile
    if (lower.includes("mobile") || lower.includes("android") || lower.includes("ios") || lower.includes("iphone") || lower.includes("ipad") || lower.includes("findroid")) return "Mobile";
    // Desktop
    if (lower.includes("desktop") || lower.includes("jellyfin media player") || lower.includes("mpv") || lower.includes("vlc") || lower.includes("windows") || lower.includes("macos") || lower.includes("linux")) return "Desktop";
    return "Autre";
}
