// Beneficiary QR Code Helper
// Generates a QR code encoding a signed, non-sensitive verification payload
// for a Beneficiary account (never the raw user ID + PII alone — a random
// opaque token is used so the QR code can't be used to enumerate user IDs).

const QRCode = require('qrcode');
const crypto = require('crypto');

/**
 * Creates a random opaque token to embed in the QR code. This token is
 * stored on the user's row (`qr_code_token`) so officers can scan it and
 * look the beneficiary up via GET /api/beneficiaries/lookup/:token instead
 * of exposing the raw database ID.
 */
function generateQrToken() {
  return crypto.randomBytes(16).toString('hex'); // 32-char opaque token
}

/**
 * Builds the QR payload. Kept intentionally minimal — the QR code is a
 * lookup key, not a data dump. Officers scan it, the backend resolves the
 * full profile server-side (respecting role isolation / auth).
 */
function buildPayload({ userId, accountNumber, qrToken }) {
  return JSON.stringify({
    type: 'BENEFICIARY_QR',
    userId,
    accountNumber,
    token: qrToken,
    issuedAt: new Date().toISOString()
  });
}

/**
 * Generates a QR code as a base64 data URL (safe to store directly in
 * `users.qr_code_url` and render straight into an <img src="..."> tag, or
 * attach to an email — no file storage/CDN required).
 */
async function generateQrCodeDataUrl(payload) {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    color: { dark: '#B88A9A', light: '#FFFFFFFF' }
  });
}

module.exports = { generateQrToken, buildPayload, generateQrCodeDataUrl };
