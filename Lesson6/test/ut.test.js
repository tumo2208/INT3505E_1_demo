import { jest } from "@jest/globals";
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// Mock db và redisClient TRƯỚC KHI import app
jest.unstable_mockModule("../db.js", () => ({
    db: {
        execute: jest.fn(),
    },
}));

jest.unstable_mockModule("../redisClient.js", () => ({
    redisClient: {
        connect: jest.fn(),
        on: jest.fn(),
        setEx: jest.fn(),
        get: jest.fn(), // Thêm .get() để mock middleware
    },
}));

const { db } = await import("../db.js");
const { redisClient } = await import("../redisClient.js");

// Import app chính (từ app.js) sau khi đã mock
// Sử dụng { default: app } vì app.js export default
const { default: app } = await import("../index.js");

// Hàm helper để tạo token hợp lệ
function generateToken(payload = { id: 1, email: "user@example.com", role: "user" }) {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
}

describe("User Authentication and Profile API", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Mặc định là token không bị blacklist
        redisClient.get.mockResolvedValue(null);
    });

    // ----- /auth/register -----
    describe("POST /auth/register", () => {
        it("should register successfully", async () => {
            db.execute.mockResolvedValueOnce([[]]); // user chưa tồn tại
            db.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // insert thành công

            const res = await request(app)
                .post("/auth/register") // <-- Cập nhật đường dẫn
                .send({
                    email: "new@example.com",
                    password: "123456",
                    phone: "0123",
                    role: "user",
                });

            expect(res.status).toBe(200);
            expect(res.body.message).toBe("Registration successful");
            expect(db.execute).toHaveBeenCalledTimes(2);
        });

        it("should return 400 if email exists", async () => {
            db.execute.mockResolvedValueOnce([[{ id: 1 }]]);

            const res = await request(app)
                .post("/auth/register") // <-- Cập nhật đường dẫn
                .send({
                    email: "exists@example.com",
                    password: "123456",
                    phone: "0123",
                    role: "user",
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toBe("Email already exists");
        });

        it("should return 500 on database error", async () => {
            db.execute.mockRejectedValueOnce(new Error("DB Error"));

            const res = await request(app)
                .post("/auth/register") // <-- Cập nhật đường dẫn
                .send({
                    email: "error@example.com",
                    password: "123456",
                });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe("DB Error");
        });
    });

    // ----- /auth/login -----
    describe("POST /auth/login", () => {
        it("should login successfully", async () => {
            const hashed = await bcrypt.hash("123456", 10);
            db.execute.mockResolvedValueOnce([
                [{ id: 1, email: "user@example.com", password: hashed, role: "user" }],
            ]);

            const res = await request(app)
                .post("/auth/login") // <-- Cập nhật đường dẫn
                .send({
                    email: "user@example.com",
                    password: "123456",
                });

            expect(res.status).toBe(200);
            expect(res.body.token).toBeDefined();
            expect(res.body.message).toBe("Login successful");
        });

        it("should return 400 if user not found", async () => {
            db.execute.mockResolvedValueOnce([[]]);

            const res = await request(app)
                .post("/auth/login") // <-- Cập nhật đường dẫn
                .send({
                    email: "notfound@example.com",
                    password: "123456",
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toBe("User not found");
        });

        it("should return 401 if password invalid", async () => {
            const hashed = await bcrypt.hash("wrongpass", 10);
            db.execute.mockResolvedValueOnce([
                [{ id: 1, email: "user@example.com", password: hashed }],
            ]);

            const res = await request(app)
                .post("/auth/login") // <-- Cập nhật đường dẫn
                .send({
                    email: "user@example.com",
                    password: "123456",
                });

            expect(res.status).toBe(401);
            expect(res.body.message).toBe("Invalid password");
        });
    });

    // ----- /auth/logout -----
    describe("POST /auth/logout", () => {
        it("should logout successfully with valid token", async () => {
            const token = generateToken();
            redisClient.setEx.mockResolvedValueOnce("OK");

            const res = await request(app)
                .post("/auth/logout") // <-- Cập nhật đường dẫn
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.message).toBe("Logout successful");
            // Kiểm tra xem token có bị đưa vào blacklist với TTL (khoảng 1 giờ)
            expect(redisClient.setEx).toHaveBeenCalledWith(
                `bl_${token}`,
                expect.any(Number), // Khó kiểm tra chính xác, chỉ cần là số
                "blacklisted"
            );
            // Kiểm tra xem TTL có gần 3600 giây không
            expect(redisClient.setEx.mock.calls[0][1]).toBeGreaterThanOrEqual(3599);
        });

        it("should return 400 if missing token", async () => {
            const res = await request(app).post("/auth/logout"); // <-- Cập nhật đường dẫn
            expect(res.status).toBe(400);
            expect(res.body.message).toBe("Missing token");
        });

        it("should return 400 if token is structurally invalid", async () => {
            const res = await request(app)
                .post("/auth/logout") // <-- Cập nhật đường dẫn
                .set("Authorization", "Bearer invalidtoken");

            expect(res.status).toBe(400);
            expect(res.body.message).toBe("Invalid token");
        });
    });

    // ----- /user/profile -----
    describe("GET /user/profile", () => {
        it("should return profile when token is valid and not blacklisted", async () => {
            const userPayload = { id: 1, email: "profile@example.com", role: "user" };
            const token = generateToken(userPayload);

            // redisClient.get.mockResolvedValue(null) đã được set trong beforeEach

            const res = await request(app)
                .get("/user/profile") // <-- Đường dẫn gốc từ app.js
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.message).toBe("Welcome!");
            expect(res.body.user.email).toBe("profile@example.com");
            expect(redisClient.get).toHaveBeenCalledWith(`bl_${token}`);
        });

        it("should return 401 if token is missing", async () => {
            const res = await request(app).get("/user/profile");
            expect(res.status).toBe(401);
            expect(res.body.message).toBe("Missing token");
        });

        it("should return 403 if token is invalid (verification fails)", async () => {
            const res = await request(app)
                .get("/user/profile")
                .set("Authorization", "Bearer invalidtoken");

            expect(res.status).toBe(403);
            expect(res.body.message).toBe("Invalid token");
        });

        it("should return 403 if token is blacklisted", async () => {
            const token = generateToken();

            // Mock redis báo token đã bị blacklist
            redisClient.get.mockResolvedValue("blacklisted");

            const res = await request(app)
                .get("/user/profile")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(403);
            expect(res.body.message).toBe("Token revoked");
            expect(redisClient.get).toHaveBeenCalledWith(`bl_${token}`);
        });

        it("should return 403 if token is expired", async () => {
            const expiredToken = jwt.sign(
                { id: 1, email: "expired@example.com" },
                process.env.JWT_SECRET,
                { expiresIn: "-1s" } // Hết hạn 1 giây trước
            );

            // redisClient.get.mockResolvedValue(null) đã được set trong beforeEach

            const res = await request(app)
                .get("/user/profile")
                .set("Authorization", `Bearer ${expiredToken}`);

            expect(res.status).toBe(403);
            expect(res.body.message).toBe("Invalid token"); // jwt.verify() sẽ thất bại
        });
    });
});