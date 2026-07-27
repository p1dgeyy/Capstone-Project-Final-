// Email OTP Helper
// Generates a 6-digit code, stores only a bcrypt hash of it (never the raw
// code) in `users.email_otp_hash`, and verifies attempts with basic
// rate-limiting via `email_otp_attempts`.

const bcrypt = require('bcryptjs');

const OTP_TTL_MINUTES = parseInt(process.env.OTP_TTL_MINUTES || '10', 10);
const MAX_OTP_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);

function generateOtpCode() {
  // 6-digit numeric code, zero-padded
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function hashOtp(code) {
  return bcrypt.hash(code, 10);
}

function expiresAt() {
  return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
}

async function verifyOtp({ storedHash, storedExpiresAt, attempts, submittedCode }) {
  if (!storedHash || !storedExpiresAt) {
    return { ok: false, reason: 'NO_ACTIVE_OTP' };
  }
  if (attempts >= MAX_OTP_ATTEMPTS) {
    return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };
  }
  if (new Date(storedExpiresAt).getTime() < Date.now()) {
    return { ok: false, reason: 'EXPIRED' };
  }
  const match = await bcrypt.compare(String(submittedCode), storedHash);
  if (!match) {
    return { ok: false, reason: 'INCORRECT' };
  }
  return { ok: true };
}

module.exports = {
  generateOtpCode,
  hashOtp,
  expiresAt,
  verifyOtp,
  OTP_TTL_MINUTES,
  MAX_OTP_ATTEMPTS
};
