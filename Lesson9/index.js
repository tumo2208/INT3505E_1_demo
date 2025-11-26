import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = 3000;

// Middleware để parse JSON body
app.use(express.json());

// In-memory storage for demo purposes
const transactions = [];

// ============================================================================
// DEPRECATION POLICY CONFIGURATION
// ============================================================================
// Based on IETF draft: Deprecation HTTP Header
const V1_DEPRECATION_DATE = new Date('2026-01-01T00:00:00Z'); // When v1 became deprecated
const V1_SUNSET_DATE = new Date('2026-06-01T00:00:00Z');      // When v1 will be turned off
const V1_SUCCESSOR_PATH = "/api/v2/payments";

/**
 * Add deprecation headers to v1 responses
 * * Based on IETF draft standards:
 * - Deprecation: Indicates the API is deprecated
 * - Sunset: When the API will be shut down
 * - Link: Points to the successor version
 * - Warning: Human-readable deprecation message
 */
const addDeprecationHeaders = (res) => {
    // toUTCString() trả về định dạng chuẩn HTTP Date (RFC 7231) giống strftime('%a, %d %b %Y %H:%M:%S GMT')
    res.set('Deprecation', V1_DEPRECATION_DATE.toUTCString());
    res.set('Sunset', V1_SUNSET_DATE.toUTCString());
    res.set('Link', `<${V1_SUCCESSOR_PATH}>; rel="successor-version"`);

    // Format ngày cho warning message
    const sunsetDateStr = V1_SUNSET_DATE.toISOString().split('T')[0];
    res.set('Warning', `299 - "Deprecated API. Migrate to v2 before ${sunsetDateStr}. See ${V1_SUCCESSOR_PATH}"`);
};

// ============================================================================
// API V1 - DEPRECATED ROUTES
// ============================================================================

/**
 * Payment API v1 - Create Payment (DEPRECATED)
 * ⚠️ DEPRECATION NOTICE & SECURITY ISSUE: Plain 'card_number'
 */
app.post('/api/v1/payments', (req, res) => {
    try {
        const data = req.body;

        // Validate required fields (v1 schema)
        const requiredFields = ['amount', 'currency', 'card_number'];
        for (const field of requiredFields) {
            if (!data[field]) {
                addDeprecationHeaders(res);
                return res.status(400).json({
                    error: `Missing required field: ${field}`,
                    migration_note: 'v2 uses payment_method object instead of card_number'
                });
            }
        }

        // Validate data types
        if (typeof data.amount !== 'number' || data.amount <= 0) {
            addDeprecationHeaders(res);
            return res.status(400).json({ error: 'Amount must be a positive number' });
        }

        if (typeof data.currency !== 'string' || data.currency.length !== 3) {
            addDeprecationHeaders(res);
            return res.status(400).json({ error: 'Currency must be a 3-letter code (e.g., USD, VND)' });
        }

        // Create transaction (v1 logic)
        const transaction = {
            transaction_id: uuidv4(),
            status: 'success',
            amount: data.amount,
            currency: data.currency,
            timestamp: new Date().toISOString(),
            // Lấy 4 số cuối
            card_last4: data.card_number.length >= 4 ? data.card_number.slice(-4) : '****',
            api_version: 'v1',
            // Add deprecation info in response body
            _deprecation: {
                deprecated: true,
                sunset_date: V1_SUNSET_DATE.toISOString(),
                successor: V1_SUCCESSOR_PATH,
                reason: 'Security improvement: v2 uses tokenized payment method'
            }
        };

        transactions.push(transaction);

        addDeprecationHeaders(res);
        return res.status(201).json(transaction);

    } catch (e) {
        addDeprecationHeaders(res);
        return res.status(500).json({
            error: 'Internal server error',
            message: e.message
        });
    }
});

/**
 * Get payment details by transaction ID (v1 - DEPRECATED)
 */
app.get('/api/v1/payments/:transaction_id', (req, res) => {
    const { transaction_id } = req.params;
    const transaction = transactions.find(t => t.transaction_id === transaction_id);

    addDeprecationHeaders(res);

    if (transaction) {
        return res.status(200).json(transaction);
    }

    return res.status(404).json({ error: 'Transaction not found' });
});

/**
 * List all transactions (v1 - DEPRECATED)
 */
app.get('/api/v1/payments', (req, res) => {
    addDeprecationHeaders(res);

    const sunsetDateStr = V1_SUNSET_DATE.toISOString().split('T')[0];

    return res.status(200).json({
        version: 'v1',
        status: 'deprecated',
        total: transactions.length,
        transactions: transactions,
        _deprecation_notice: `This API will be shut down on ${sunsetDateStr}`
    });
});

// ============================================================================
// API V2 - CURRENT ROUTES
// ============================================================================

/**
 * Payment API v2 - Create Payment (CURRENT VERSION)
 * ✅ IMPROVEMENTS: Tokenized payment_method, PCI-DSS compliant
 */
app.post('/api/v2/payments', (req, res) => {
    try {
        const data = req.body;

        // Validate required fields (v2 schema)
        const requiredFields = ['amount', 'currency', 'payment_method'];
        for (const field of requiredFields) {
            if (!data[field]) {
                return res.status(400).json({
                    error: `Missing required field: ${field}`,
                    schema_version: 'v2',
                    migration_guide: 'Replace card_number with payment_method object'
                });
            }
        }

        // Validate nested payment_method object
        const paymentMethod = data.payment_method;
        if (typeof paymentMethod !== 'object' || Array.isArray(paymentMethod) || paymentMethod === null) {
            return res.status(400).json({ error: 'payment_method must be an object' });
        }

        const requiredPmFields = ['type', 'token'];
        for (const field of requiredPmFields) {
            if (!paymentMethod[field]) {
                return res.status(400).json({
                    error: `Missing required field in payment_method: ${field}`,
                    example: {
                        type: 'credit_card',
                        token: 'tok_1A2B3C4D5E6F'
                    }
                });
            }
        }

        // Validate amount and currency
        if (typeof data.amount !== 'number' || data.amount <= 0) {
            return res.status(400).json({ error: 'Amount must be a positive number' });
        }

        if (typeof data.currency !== 'string' || data.currency.length !== 3) {
            return res.status(400).json({ error: 'Currency must be a 3-letter code (e.g., USD, VND)' });
        }

        // Validate payment method type
        const validTypes = ['credit_card', 'debit_card', 'digital_wallet'];
        if (!validTypes.includes(paymentMethod.type)) {
            return res.status(400).json({ error: `Invalid payment type. Allowed: ${validTypes.join(', ')}` });
        }

        // Create transaction (v2 logic)
        const transaction = {
            transaction_id: uuidv4(),
            status: 'success',
            amount: data.amount,
            currency: data.currency,
            payment_method: {
                type: paymentMethod.type,
                // In production, decrypt token. For demo, extract from token string
                last4: paymentMethod.token.length >= 4 ? paymentMethod.token.slice(-4) : '****'
            },
            timestamp: new Date().toISOString(),
            api_version: 'v2'
        };

        transactions.push(transaction);

        return res.status(201).json(transaction);

    } catch (e) {
        return res.status(500).json({
            error: 'Internal server error',
            message: e.message
        });
    }
});

/**
 * Get payment details by transaction ID (v2)
 */
app.get('/api/v2/payments/:transaction_id', (req, res) => {
    const { transaction_id } = req.params;
    const transaction = transactions.find(t => t.transaction_id === transaction_id);

    if (transaction) {
        return res.status(200).json(transaction);
    }
    return res.status(404).json({ error: 'Transaction not found' });
});

/**
 * List all transactions (v2)
 */
app.get('/api/v2/payments', (req, res) => {
    return res.status(200).json({
        version: 'v2',
        status: 'current',
        total: transactions.length,
        transactions: transactions
    });
});

// ============================================================================
// DOCUMENTATION & UTILS
// ============================================================================

// /**
//  * Migration Guide
//  */
// app.get('/api/migration-guide', (req, res) => {
//     const now = new Date();
//     const daysRemaining = Math.ceil((V1_SUNSET_DATE - now) / (1000 * 60 * 60 * 24));
//
//     return res.status(200).json({
//         title: 'Migration Guide: v1 → v2',
//         deprecation: {
//             v1_deprecated_since: V1_DEPRECATION_DATE.toISOString(),
//             v1_sunset_date: V1_SUNSET_DATE.toISOString(),
//             days_remaining: daysRemaining > 0 ? daysRemaining : 0
//         },
//         breaking_changes: {
//             schema_change: {
//                 field_removed: 'card_number',
//                 field_added: 'payment_method',
//                 reason: 'PCI-DSS compliance - no raw card numbers'
//             }
//         },
//         migration_steps: [
//             '1. Integrate with payment tokenization service (e.g., Stripe, PayPal)',
//             '2. Replace card_number with payment_method.token in your requests',
//             '3. Update your code to use /api/v2/payments endpoint',
//             '4. Test thoroughly in staging environment',
//             '5. Deploy to production before sunset date'
//         ],
//         example_v1: {
//             url: 'POST /api/v1/payments',
//             body: {
//                 amount: 100.50,
//                 currency: 'USD',
//                 card_number: '4111111111111111'
//             }
//         },
//         example_v2: {
//             url: 'POST /api/v2/payments',
//             body: {
//                 amount: 100.50,
//                 currency: 'USD',
//                 payment_method: {
//                     type: 'credit_card',
//                     token: 'tok_1A2B3C4D5E6F'
//                 }
//             }
//         },
//         support: {
//             documentation: 'https://api.example.com/docs/v2',
//             contact: 'api-support@example.com'
//         }
//     });
// });
//
// /**
//  * Health check
//  */
// app.get('/api/health', (req, res) => {
//     return res.status(200).json({
//         status: 'healthy',
//         supported_versions: ['v1 (deprecated)', 'v2 (current)'],
//         timestamp: new Date().toISOString()
//     });
// });
//
// /**
//  * API Index
//  */
// app.get('/', (req, res) => {
//     return res.status(200).json({
//         api_name: 'Payment API',
//         versions: {
//             v1: {
//                 status: 'deprecated',
//                 deprecated_since: V1_DEPRECATION_DATE.toISOString(),
//                 sunset_date: V1_SUNSET_DATE.toISOString(),
//                 endpoints: [
//                     'POST /api/v1/payments',
//                     'GET /api/v1/payments/<id>',
//                     'GET /api/v1/payments'
//                 ],
//                 warning: '⚠️ Will be shut down soon. Migrate to v2!'
//             },
//             v2: {
//                 status: 'current',
//                 endpoints: [
//                     'POST /api/v2/payments',
//                     'GET /api/v2/payments/<id>',
//                     'GET /api/v2/payments'
//                 ],
//                 improvements: [
//                     'Tokenized payment method (secure)',
//                     'Better data structure',
//                     'PCI-DSS compliant'
//                 ]
//             }
//         },
//         migration_guide: '/api/migration-guide'
//     });
// });

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});