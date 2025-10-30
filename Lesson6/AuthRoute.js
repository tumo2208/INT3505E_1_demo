import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { db } from "./db.js";
import { redisClient } from "./redisClient.js";

dotenv.config();
const router = express.Router();

router.post("/register", async (req, res) => {
    const { email, password, phone, role } = req.body;
    try {
        const [exist] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);
        if (exist.length > 0) return res.status(400).json({ message: "Email already exists" });

        const hashed = await bcrypt.hash(password, 10);
        await db.execute(
            "INSERT INTO users (email, password, phone, role) VALUES (?, ?, ?, ?)",
            [email, hashed, phone, role || "user"]
        );

        res.json({ message: "Registration successful" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);
        if (users.length === 0) return res.status(400).json({ message: "User not found" });

        const valid = await bcrypt.compare(password, users[0].password);
        if (!valid) return res.status(401).json({ message: "Invalid password" });

        const token = jwt.sign(
            { id: users[0].id, email: users[0].email, role: users[0].role },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.json({ message: "Login successful", token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/logout", async (req, res) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.status(400).json({ message: "Missing token" });

    try {
        const decoded = jwt.decode(token);
        if (!decoded) return res.status(400).json({ message: "Invalid token" });

        const exp = decoded.exp;
        const ttl = exp ? exp - Math.floor(Date.now() / 1000) : 3600;

        await redisClient.setEx(`bl_${token}`, ttl, "blacklisted");

        res.json({ message: "Logout successful" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
