import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { redisClient } from "./redisClient.js";

dotenv.config();

export const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Missing token" });

    const isBlacklisted = await redisClient.get(`bl_${token}`);
    if (isBlacklisted) return res.status(403).json({ message: "Token revoked" });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: "Invalid token" });
        req.user = user;
        next();
    });
};
