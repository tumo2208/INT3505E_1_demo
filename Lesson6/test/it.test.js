import request from "supertest";
import app from "../index.js";

describe("AuthRoute Integration Tests", () => {
    let token;

    test("Đăng ký người dùng mới", async () => {
        const res = await request(app).post("/auth/register").send({
            email: "integration2@example.com",
            password: "123456",
            phone: "0909999999"
        });
        expect(res.statusCode).toBe(200);
    });

    test("Đăng nhập và nhận token", async () => {
        const res = await request(app).post("/auth/login").send({
            email: "integration2@example.com",
            password: "123456"
        });
        expect(res.statusCode).toBe(200);
        token = res.body.token;
    });

    test("Truy cập /user/profile hợp lệ", async () => {
        const res = await request(app)
            .get("/user/profile")
            .set("Authorization", `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.user).toBeDefined();
    });

    test("Đăng xuất và bị chặn truy cập", async () => {
        const res1 = await request(app)
            .post("/auth/logout")
            .set("Authorization", `Bearer ${token}`);
        expect(res1.statusCode).toBe(200);

        const res2 = await request(app)
            .get("/user/profile")
            .set("Authorization", `Bearer ${token}`);
        expect(res2.statusCode).toBe(403);
    });
});
