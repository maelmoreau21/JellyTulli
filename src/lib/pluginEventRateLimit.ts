import redis from "@/lib/redis";

const parsedWindow = Number(process.env.PLUGIN_EVENT_RATE_LIMIT_WINDOW_SECONDS);
const parsedMaxEvents = Number(process.env.PLUGIN_EVENT_RATE_LIMIT_MAX);

const WINDOW_SECONDS = Number.isFinite(parsedWindow) && parsedWindow > 0 ? parsedWindow : 60;
const MAX_EVENTS = Number.isFinite(parsedMaxEvents) && parsedMaxEvents > 0 ? parsedMaxEvents : 1200;

function getPluginEventsKey(identifier: string): string {
    return `ratelimit:plugin-events:${identifier}`;
}

export async function consumePluginEventRateLimit(identifier: string): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds?: number }> {
    const key = getPluginEventsKey(identifier);

    try {
        const count = await redis.incr(key);
        if (count === 1) {
            await redis.expire(key, WINDOW_SECONDS);
        }

        if (count > MAX_EVENTS) {
            const ttl = await redis.ttl(key);
            return {
                allowed: false,
                remaining: 0,
                retryAfterSeconds: ttl > 0 ? ttl : WINDOW_SECONDS,
            };
        }

        return {
            allowed: true,
            remaining: Math.max(0, MAX_EVENTS - count),
        };
    } catch (error) {
        // Fail-open if Redis is unavailable to avoid dropping valid plugin events.
        console.error("[PluginRateLimit] Redis error, failing open:", error);
        return {
            allowed: true,
            remaining: MAX_EVENTS,
        };
    }
}
