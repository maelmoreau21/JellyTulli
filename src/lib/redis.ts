import { Redis } from 'ioredis'

const redisClientSingleton = () => {
    return new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
}

declare global {
    var redisGlobal: undefined | ReturnType<typeof redisClientSingleton>
}

const redis = globalThis.redisGlobal ?? redisClientSingleton()

export default redis

if (process.env.NODE_ENV !== 'production') globalThis.redisGlobal = redis
