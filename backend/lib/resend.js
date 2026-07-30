// Resend Transactional Email Helper
// Handles: branded 6-digit OTP codes, welcome emails, and QR code delivery.
// Resend is used purely for EMAIL DELIVERY — it never issues sessions or
// decides whether a user is authenticated. That responsibility belongs to
// Clerk (see backend/lib/clerk.js) and our own OTP-gate on the users table.

const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'PESO-CSWDO Portal <onboarding@resend.dev>';

let resend = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
} else {
  console.warn('[RESEND] RESEND_API_KEY is not set — transactional emails will be logged to the console instead of sent.');
}

/**
 * Low-level send wrapper. Falls back to console logging if Resend isn't
 * configured, so local development never hard-fails on a missing API key.
 */
async function send({ to, subject, html }) {
  if (!resend) {
    console.log(`[RESEND:DEV-FALLBACK] Would send to ${to} — subject: "${subject}"`);
    console.log(html);
    return { id: null, devFallback: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html
    });

    if (error) {
      console.error('[RESEND] Send error:', error.message || error);
      throw new Error(`Resend failed to send email: ${error.message || 'unknown error'}`);
    }

    console.log(`[RESEND] Email sent — to: ${to}, subject: "${subject}", id: ${data?.id}`);
    return data;
  } catch (err) {
    console.error('[RESEND] Unexpected send failure:', err.message);
    throw err;
  }
}

/**
 * Sends the branded 6-digit OTP code used to confirm a Beneficiary's email
 * address during registration. This is the Resend "OTP fallback/primary
 * delivery" path referenced in the project's auth design — Clerk handles
 * session issuance, Resend handles the actual email the user reads.
 */
async function sendOtpEmail({ to, firstName, code, expiresInMinutes = 10 }) {
  const html = `
    <div style="font-family:Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
      <h2 style="color:#B88A9A;">Verify your email</h2>
      <p>Hi ${escapeHtml(firstName || 'there')},</p>
      <p>Use the code below to verify your email address and finish creating your Beneficiary account.</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#fbf6f8;color:#B88A9A;padding:16px 24px;border-radius:8px;text-align:center;margin:24px 0;">
        ${escapeHtml(code)}
      </div>
      <p>This code expires in ${expiresInMinutes} minutes. If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
  return send({ to, subject: 'Your verification code', html });
}

/**
 * Sends a welcome email once the account is fully verified and active.
 */
async function sendWelcomeEmail({ to, firstName }) {
  const html = `
    <div style="font-family:Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
      <h2 style="color:#B88A9A;">Welcome, ${escapeHtml(firstName || 'there')}!</h2>
      <p>Your Beneficiary account has been verified and is now active.</p>
      <p>You can log in to the Beneficiary Portal any time to track your applications and view your QR code.</p>
    </div>
  `;
  return send({ to, subject: 'Your account is verified', html });
}

/**
 * Sends the beneficiary's personal QR code as an inline image attachment,
 * for easy access from a phone inbox even before they log into the portal.
 */
async function sendQrCodeEmail({ to, firstName, qrCodeDataUrl }) {
  const base64 = qrCodeDataUrl.split(',')[1];
  const html = `
    <div style="font-family:Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
      <h2 style="color:#B88A9A;">Your Beneficiary QR Code</h2>
      <p>Hi ${escapeHtml(firstName || 'there')}, here is your personal QR code.</p>
      <p>Present this to a PESO/CSWDO officer for quick lookup during distributions, interviews, or on-site verification.</p>
      <img src="cid:beneficiary-qr" alt="Beneficiary QR Code" style="width:220px;height:220px;margin:16px 0;" />
      <p style="color:#777;font-size:13px;">It's also always available in your Beneficiary Portal profile.</p>
    </div>
  `;

  if (!resend) {
    console.log(`[RESEND:DEV-FALLBACK] Would send QR code email to ${to}`);
    return { id: null, devFallback: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Your Beneficiary QR Code',
      html,
      attachments: [
        {
          filename: 'beneficiary-qr-code.png',
          content: base64,
          content_id: 'beneficiary-qr'
        }
      ]
    });
    if (error) throw new Error(error.message || 'unknown error');
    console.log(`[RESEND] QR code email sent — to: ${to}, id: ${data?.id}`);
    return data;
  } catch (err) {
    console.error('[RESEND] QR code email failed:', err.message);
    throw err;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { sendOtpEmail, sendWelcomeEmail, sendQrCodeEmail };
