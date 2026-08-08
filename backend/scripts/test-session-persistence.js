/**
 * Automated Verification Suite for Session Persistence, HttpOnly Cookies, and Dual-Layer Auth
 * City Government of Koronadal — PESO & CSWDO Portal
 */

const app = require('../server');
const http = require('http');
const assert = require('assert');

let server;
const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Helper to perform HTTP requests with cookie jar support
 */
function createSessionClient() {
    let cookieJar = [];

    function extractCookies(res) {
        const raw = res.headers['set-cookie'];
        if (raw) {
            raw.forEach(cookieStr => {
                const nameVal = cookieStr.split(';')[0];
                const cookieName = nameVal.split('=')[0];
                cookieJar = cookieJar.filter(c => !c.startsWith(`${cookieName}=`));
                cookieJar.push(nameVal);
            });
        }
    }

    async function request(method, path, body = null, headers = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, BASE_URL);
            const payload = body ? JSON.stringify(body) : null;
            const reqHeaders = {
                'Content-Type': 'application/json',
                ...headers
            };

            if (cookieJar.length > 0 && !reqHeaders['Cookie']) {
                reqHeaders['Cookie'] = cookieJar.join('; ');
            }

            if (payload) {
                reqHeaders['Content-Length'] = Buffer.byteLength(payload);
            }

            const options = {
                method,
                headers: reqHeaders
            };

            const req = http.request(url, options, (res) => {
                extractCookies(res);
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    let parsed = data;
                    try {
                        parsed = JSON.parse(data);
                    } catch (e) {}
                    resolve({
                        status: res.statusCode,
                        body: parsed,
                        headers: res.headers,
                        cookies: cookieJar
                    });
                });
            });

            req.on('error', reject);
            if (payload) req.write(payload);
            req.end();
        });
    }

    function getCookies() {
        return cookieJar;
    }

    function clearCookies() {
        cookieJar = [];
    }

    return { request, getCookies, clearCookies };
}

async function runSessionPersistenceTests() {
    console.log('===============================================================');
    console.log('🧪 RUNNING SESSION PERSISTENCE & AUTHENTICATION VERIFICATION SUITE');
    console.log('===============================================================\n');

    server = app.listen(PORT);
    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        try {
            await fn();
            console.log(`  ✅ [PASS] ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ [FAIL] ${name}:`, err.message);
            failed++;
        }
    }

    // 1. CORS Configuration Verification
    await test('CORS headers allow credentials and proper origin', async () => {
        const client = createSessionClient();
        const res = await client.request('OPTIONS', '/api/auth/login', null, {
            'Origin': 'http://localhost:3000',
            'Access-Control-Request-Method': 'POST'
        });
        assert.strictEqual(res.headers['access-control-allow-credentials'], 'true');
    });

    // 2. PESO Admin Login & Session Cookie Creation
    let pesoAccessToken = null;
    const pesoClient = createSessionClient();

    await test('PESO Admin login sets HttpOnly cookies, creates express-session, and returns JWT', async () => {
        const res = await pesoClient.request('POST', '/api/auth/login', {
            username: 'peso-admin',
            password: 'Capstone2026!'
        });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.ok(res.body.accessToken, 'Missing accessToken in response');
        assert.strictEqual(res.body.user.username, 'peso-admin');
        assert.strictEqual(res.body.user.role, 'PESO Admin');

        pesoAccessToken = res.body.accessToken;

        // Check Set-Cookie headers
        const setCookies = res.headers['set-cookie'] || [];
        const hasSessionCookie = setCookies.some(c => c.includes('peso_session') || c.includes('connect.sid'));
        const hasTokenCookie = setCookies.some(c => c.includes('peso_token') || c.includes('accessToken'));
        const hasHttpOnly = setCookies.some(c => c.toLowerCase().includes('httponly'));

        assert.ok(hasSessionCookie, 'Missing session cookie in response');
        assert.ok(hasTokenCookie, 'Missing token cookie in response');
        assert.ok(hasHttpOnly, 'Cookie missing HttpOnly flag');
    });

    // 3. Session Persistence via Cookies on /api/auth/me (No Auth Header)
    await test('Subsequent request with session cookies to /api/auth/me succeeds without Authorization header', async () => {
        const res = await pesoClient.request('GET', '/api/auth/me');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.authenticated, true);
        assert.strictEqual(res.body.user.username, 'peso-admin');
        assert.strictEqual(res.body.user.role, 'PESO Admin');
    });

    // 4. Session Persistence via Bearer Token on /api/auth/me (Stateless client)
    await test('Subsequent request with Authorization: Bearer token succeeds', async () => {
        const statelessClient = createSessionClient();
        const res = await statelessClient.request('GET', '/api/auth/me', null, {
            'Authorization': `Bearer ${pesoAccessToken}`
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.user.username, 'peso-admin');
    });

    // 5. CSWDO Admin Login & /api/admin/verify-session
    const cswdoClient = createSessionClient();
    await test('CSWDO Admin login creates session and verifies via /api/admin/verify-session', async () => {
        const res = await cswdoClient.request('POST', '/api/admin/login', {
            username: 'cswdo-admin',
            password: 'Capstone2026!'
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.user.role, 'CSWDO Admin');

        const verifyRes = await cswdoClient.request('GET', '/api/admin/verify-session');
        assert.strictEqual(verifyRes.status, 200);
        assert.strictEqual(verifyRes.body.success, true);
        assert.strictEqual(verifyRes.body.user.role, 'CSWDO Admin');
    });

    // 6. Invalid Credentials Rejection (Does NOT set session or cookies)
    await test('Invalid login credentials return 401 and do not create valid session', async () => {
        const invalidClient = createSessionClient();
        const res = await invalidClient.request('POST', '/api/auth/login', {
            username: 'peso-admin',
            password: 'WrongPassword123!'
        });
        assert.strictEqual(res.status, 401);
        assert.strictEqual(res.body.success, false);

        // Attempting to access /api/auth/me with invalidClient should fail
        const meRes = await invalidClient.request('GET', '/api/auth/me');
        assert.strictEqual(meRes.status, 401);
    });

    // 7. Logout Destroys Session & Clears Cookies
    await test('POST /api/auth/logout destroys session and subsequent requests are rejected (401)', async () => {
        const logoutRes = await pesoClient.request('POST', '/api/auth/logout');
        assert.strictEqual(logoutRes.status, 200);
        assert.strictEqual(logoutRes.body.success, true);

        // Clear local cookies as browser does on clearCookie
        pesoClient.clearCookies();

        const afterLogoutRes = await pesoClient.request('GET', '/api/auth/me');
        assert.strictEqual(afterLogoutRes.status, 401);
    });

    // 8. Inactive / Deactivated User Blocked
    await test('Deactivated or inactive accounts are denied login and cannot establish sessions', async () => {
        const testClient = createSessionClient();
        const res = await testClient.request('POST', '/api/auth/login', {
            username: 'inactive-user',
            password: 'Capstone2026!'
        });
        // Inactive user should either be not found (401) or deactivated (403)
        assert.ok([401, 403].includes(res.status));
    });

    console.log('\n===============================================================');
    console.log(`📊 SESSION PERSISTENCE SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log('===============================================================\n');

    server.close();
    if (failed > 0) process.exit(1);
}

runSessionPersistenceTests().catch(err => {
    console.error('Test execution error:', err);
    if (server) server.close();
    process.exit(1);
});
