import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import client from 'prom-client';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = 3001;
const BACKEND_URL = 'http://localhost:3000'; // Địa chỉ của Backend Core

// ============================================================================
// 1. OBSERVABILITY SETUP (Logger & Metrics)
// ============================================================================

// A. Prometheus Metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register }); // Thu thập CPU, RAM

// Custom Metric: Đếm số request đi qua Gateway
const httpRequestCounter = new client.Counter({
    name: 'gateway_http_requests_total',
    help: 'Total number of HTTP requests processed by Gateway',
    labelNames: ['method', 'status', 'path'],
    registers: [register]
});

// B. Structured Logging (Winston)
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'gateway-audit.log' })
    ]
});

// ============================================================================
// 2. SECURITY MIDDLEWARE (Lớp bảo vệ đầu tiên)
// ============================================================================

// A. Helmet: Bảo vệ HTTP Headers
app.use(helmet());

// B. Rate Limiting: Chống DDoS/Spam
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 100, // Tối đa 100 request/IP
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn({
            message: 'Rate limit exceeded',
            ip: req.ip,
            path: req.path
        });
        res.status(429).json({ error: 'Too many requests from this IP' });
    }
});
app.use(limiter);

// ============================================================================
// 3. LOGGING & TRACING MIDDLEWARE
// ============================================================================

app.use((req, res, next) => {
    // Tạo Correlation ID để trace request từ Gateway -> Backend
    const requestId = uuidv4();
    req.headers['X-Request-ID'] = requestId;

    // Ghi log khi request bắt đầu
    const startTime = Date.now();

    // Lắng nghe sự kiện khi response kết thúc (để log status code trả về từ Backend)
    res.on('finish', () => {
        const duration = Date.now() - startTime;

        // Ghi Metrics cho Prometheus
        httpRequestCounter.inc({
            method: req.method,
            path: req.path,
            status: res.statusCode
        });

        // Ghi Audit Log
        logger.info({
            type: 'GATEWAY_ACCESS',
            requestId: requestId,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration_ms: duration,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
    });

    next();
});

// ============================================================================
// 4. METRICS ENDPOINT (Gateway phục vụ trực tiếp)
// ============================================================================
// Endpoint này KHÔNG forward sang backend, mà trả về metrics của chính Gateway
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});

// ============================================================================
// 5. PROXY CONFIGURATION (Chuyển tiếp sang Backend)
// ============================================================================

const apiProxy = createProxyMiddleware({
    target: BACKEND_URL,
    changeOrigin: true, // Cần thiết cho virtual hosted sites
    pathRewrite: {
        '^/': '/api/' // Thêm lại prefix /api vào đầu đường dẫn trước khi gửi sang Backend
    },
    onProxyReq: (proxyReq, req, res) => {
        // Có thể inject thêm header bí mật để Backend biết request đến từ Gateway tin cậy
        // proxyReq.setHeader('X-Gateway-Secret', 'my-super-secret-key');
    },
    onError: (err, req, res) => {
        logger.error({ message: 'Proxy Error', error: err.message });
        res.status(502).json({ error: 'Bad Gateway - Backend is down' });
    }
});

// Forward tất cả request bắt đầu bằng /api sang Backend (Port 3000)
app.use('/api', apiProxy);

// ============================================================================
// START SERVER
// ============================================================================
app.listen(PORT, () => {
    console.log(`🛡️  Secure Gateway running on http://localhost:${PORT}`);
    console.log(`👉 Forwarding traffic to Backend at ${BACKEND_URL}`);
    console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
});