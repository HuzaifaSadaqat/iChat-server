import { Redis } from "ioredis";

// Log Redis connection information
console.log("Redis Configuration:");
console.log(`Host: ${process.env.REDIS_HOST || "localhost"}`);
console.log(`Port: ${process.env.REDIS_PORT || 6379}`);
console.log(`Password: ${process.env.REDIS_PASSWORD ? "Set" : "Not set"}`);

const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
        // Keep retrying with increasing delay
        const delay = Math.min(times * 100, 3000);
        return delay;
    }
});

redis.on("error", (error) => {
    console.error("Redis connection error:", error);
});

redis.on("connect", () => {
    console.log(`Redis connected successfully to ${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}`);
});

export default redis; 