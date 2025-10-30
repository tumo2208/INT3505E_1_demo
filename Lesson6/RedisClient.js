import { createClient } from "redis";
import dotenv from "dotenv";
dotenv.config();

export const redisClient = createClient({
    url: "redis://localhost:6379",
});

redisClient.on("error", (err) => console.error("Redis error:", err));

await redisClient.connect();

console.log("Connected to Redis");
