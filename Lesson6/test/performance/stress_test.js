import http from "k6/http";
import { check } from "k6";

export const options = {
    stages: [
        { duration: "30s", target: 50 },
        { duration: "30s", target: 200 },
        { duration: "30s", target: 500 },
        { duration: "30s", target: 0 },
    ],
    thresholds: {
        http_req_failed: ["rate<0.05"], // <5% lỗi
        http_req_duration: ["p(95)<1000"], // 95% response < 1s
    },
};

const BASE_URL = "http://localhost:3001/auth";

export default function () {
    const res = http.post(`${BASE_URL}/login`, JSON.stringify({
        email: "integration2@example.com",
        password: "123456"
    }), { headers: { "Content-Type": "application/json" } });

    check(res, { "status is 200": (r) => r.status === 200 });
}
