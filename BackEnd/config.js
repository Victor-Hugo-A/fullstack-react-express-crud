const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const PLACEHOLDER_SECRETS = new Set([
    'replace-with-a-long-random-secret',
    'replace-with-another-long-random-secret'
]);

function requiredSecret(name) {
    const value = String(process.env[name] || '').trim();
    if (value.length < 32 || PLACEHOLDER_SECRETS.has(value)) {
        throw new Error(`${name} deve ser um segredo aleatório com ao menos 32 caracteres e não pode usar o valor de exemplo.`);
    }
    return value;
}

function validOrigin(value, name) {
    try {
        const origin = new URL(value).origin;
        if (!/^https?:\/\//.test(origin)) throw new Error();
        return origin;
    } catch {
        throw new Error(`${name} deve ser uma origem HTTP(S) válida.`);
    }
}

const isProduction = process.env.NODE_ENV === 'production';
const frontendOrigin = validOrigin(process.env.FRONTEND_ORIGIN || 'http://localhost:5500', 'FRONTEND_ORIGIN');
const cookieSameSite = String(process.env.COOKIE_SAME_SITE || 'lax').toLowerCase();
if (!['lax', 'strict', 'none'].includes(cookieSameSite)) {
    throw new Error('COOKIE_SAME_SITE deve ser lax, strict ou none.');
}
if (isProduction && cookieSameSite === 'none' && process.env.COOKIE_SECURE === 'false') {
    throw new Error('Cookies SameSite=None exigem COOKIE_SECURE=true em produção.');
}

const cookieSecure = isProduction || cookieSameSite === 'none';

module.exports = {
    port: Number(process.env.PORT) || 3000,
    isProduction,
    frontendOrigin,
    allowedOrigins: [frontendOrigin],
    jwtSecret: requiredSecret('SECRET_KEY'),
    sessionSecret: requiredSecret('SESSION_SECRET'),
    authCookieName: 'senappen_session',
    csrfCookieName: 'senappen_csrf',
    cookieOptions: {
        httpOnly: true,
        secure: cookieSecure,
        sameSite: cookieSameSite,
        path: '/',
        maxAge: 8 * 60 * 60 * 1000
    },
    csrfCookieOptions: {
        httpOnly: false,
        secure: cookieSecure,
        sameSite: cookieSameSite,
        path: '/',
        maxAge: 8 * 60 * 60 * 1000
    }
};
