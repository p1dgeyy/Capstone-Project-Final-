// Resend Email Utility — OTP and Welcome Email Dispatcher
// Uses the Resend API to send transactional emails for beneficiary registration
//
// Environment Variables:
//   RESEND_API_KEY     — Your Resend API key (required for production)
//   RESEND_FROM_EMAIL  — Verified sender email (defaults to onboarding@resend.dev)
//
// Fallback: If RESEND_API_KEY is not set, OTP codes are logged to console (dev mode)

require('dotenv').config();

let resendClient = null;

// Lazy-initialize Resend client
function getResendClient() {
  if (resendClient) return resendClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 're_xxxxxxxxxxxxxxxxxxxx') {
    console.warn('[MAILER] RESEND_API_KEY not configured. Emails will be logged to console (dev mode).');
    return null;
  }

  try {
    const { Resend } = require('resend');
    resendClient = new Resend(apiKey);
    console.log('[MAILER] Resend client initialized.');
    return resendClient;
  } catch (err) {
    console.error('[MAILER] Failed to initialize Resend client:', err.message);
    return null;
  }
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

/**
 * Send a 6-digit OTP verification email to a beneficiary during registration.
 *
 * @param {string} toEmail  — recipient email address
 * @param {string} otpCode  — the 6-digit OTP code
 * @param {string} firstName — beneficiary's first name (for personalization)
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
async function sendOtpEmail(toEmail, otpCode, firstName) {
  const subject = `Your Verification Code: ${otpCode} — Koronadal City Assistance Portal`;

  const htmlBody = `
    <div style="font-family: 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #F0B6C6;">
      <div style="background: linear-gradient(135deg, #B88A9A, #F0B6C6); padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Koronadal City Assistance Portal</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Email Verification</p>
      </div>
      <div style="padding: 35px 30px;">
        <p style="color: #333; font-size: 15px; line-height: 1.6;">Hello <strong>${firstName}</strong>,</p>
        <p style="color: #555; font-size: 14px; line-height: 1.6;">
          Thank you for registering with the Koronadal City Livelihood &amp; Financial Assistance Portal.
          Please use the verification code below to complete your registration:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="display: inline-block; background: #FFF5F7; border: 2px dashed #F0B6C6; border-radius: 12px; padding: 20px 40px;">
            <span style="font-size: 36px; font-weight: 800; color: #B88A9A; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otpCode}</span>
          </div>
        </div>
        <p style="color: #888; font-size: 13px; text-align: center;">
          This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
        </p>
      </div>
      <div style="background: #fbf6f8; padding: 20px 30px; text-align: center; border-top: 1px solid #F0B6C6;">
        <p style="color: #999; font-size: 12px; margin: 0;">
          If you did not request this, please ignore this email.<br>
          &copy; ${new Date().getFullYear()} City of Koronadal — PESO / CSWDO
        </p>
      </div>
    </div>
  `;

  const client = getResendClient();

  if (!client) {
    // Dev fallback — log to console
    console.log('═══════════════════════════════════════════════');
    console.log(`[MAILER] 📧 OTP EMAIL (dev mode — no Resend key)`);
    console.log(`[MAILER]   To:    ${toEmail}`);
    console.log(`[MAILER]   Name:  ${firstName}`);
    console.log(`[MAILER]   OTP:   ${otpCode}`);
    console.log('═══════════════════════════════════════════════');
    return { success: true, messageId: 'dev-mode-logged' };
  }

  try {
    const result = await client.emails.send({
      from: FROM_EMAIL,
      to: [toEmail],
      subject,
      html: htmlBody
    });

    console.log(`[MAILER] OTP email sent to ${toEmail}, messageId: ${result.data?.id || 'unknown'}`);
    return { success: true, messageId: result.data?.id };
  } catch (err) {
    console.error('[MAILER] Failed to send OTP email:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send a welcome/confirmation email after successful OTP verification.
 *
 * @param {string} toEmail  — recipient email address
 * @param {string} firstName — beneficiary's first name
 * @param {number} userId   — the new user ID
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
async function sendWelcomeEmail(toEmail, firstName, userId) {
  const subject = `Welcome to the Koronadal City Assistance Portal, ${firstName}!`;

  const htmlBody = `
    <div style="font-family: 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #F0B6C6;">
      <div style="background: linear-gradient(135deg, #B88A9A, #F0B6C6); padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Welcome to the Portal!</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Account Verified Successfully</p>
      </div>
      <div style="padding: 35px 30px;">
        <p style="color: #333; font-size: 15px; line-height: 1.6;">Hello <strong>${firstName}</strong>,</p>
        <p style="color: #555; font-size: 14px; line-height: 1.6;">
          Your email has been verified and your Beneficiary account (ID: <strong>BEN-${userId}</strong>) is now active.
        </p>
        <p style="color: #555; font-size: 14px; line-height: 1.6;">
          You can now log in to your portal to:
        </p>
        <ul style="color: #555; font-size: 14px; line-height: 1.8; padding-left: 20px;">
          <li>Apply for livelihood and financial assistance programs</li>
          <li>Track application statuses and upcoming schedules</li>
          <li>Access your unique QR code for officer verification</li>
          <li>View and download important documents</li>
        </ul>
        <div style="text-align: center; margin-top: 25px;">
          <p style="color: #B88A9A; font-weight: 700; font-size: 13px;">Your Beneficiary Code: BEN-${userId}</p>
        </div>
      </div>
      <div style="background: #fbf6f8; padding: 20px 30px; text-align: center; border-top: 1px solid #F0B6C6;">
        <p style="color: #999; font-size: 12px; margin: 0;">
          &copy; ${new Date().getFullYear()} City of Koronadal — PESO / CSWDO
        </p>
      </div>
    </div>
  `;

  const client = getResendClient();

  if (!client) {
    console.log(`[MAILER] 📧 WELCOME EMAIL (dev mode) — To: ${toEmail}, User: BEN-${userId}`);
    return { success: true, messageId: 'dev-mode-logged' };
  }

  try {
    const result = await client.emails.send({
      from: FROM_EMAIL,
      to: [toEmail],
      subject,
      html: htmlBody
    });

    console.log(`[MAILER] Welcome email sent to ${toEmail}, messageId: ${result.data?.id || 'unknown'}`);
    return { success: true, messageId: result.data?.id };
  } catch (err) {
    console.error('[MAILER] Failed to send welcome email:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendOtpEmail, sendWelcomeEmail };
