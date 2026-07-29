// Email Utility — OTP and Welcome Email Dispatcher
// Console-log fallback implementation (no external email service)
//
// OTP codes and welcome messages are logged to the server console.
// To add a real email provider later (e.g. nodemailer, SendGrid), replace
// the console.log calls with your email sending logic — the function
// signatures are preserved for easy drop-in replacement.

require('dotenv').config();

/**
 * Send a 6-digit OTP verification email to a beneficiary during registration.
 *
 * @param {string} toEmail  — recipient email address
 * @param {string} otpCode  — the 6-digit OTP code
 * @param {string} firstName — beneficiary's first name (for personalization)
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
async function sendOtpEmail(toEmail, otpCode, firstName) {
  console.log('═══════════════════════════════════════════════');
  console.log(`[MAILER] 📧 OTP EMAIL`);
  console.log(`[MAILER]   To:    ${toEmail}`);
  console.log(`[MAILER]   Name:  ${firstName}`);
  console.log(`[MAILER]   OTP:   ${otpCode}`);
  console.log('═══════════════════════════════════════════════');
  return { success: true, messageId: 'console-logged' };
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
  console.log(`[MAILER] 📧 WELCOME EMAIL — To: ${toEmail}, User: BEN-${userId}`);
  return { success: true, messageId: 'console-logged' };
}

module.exports = { sendOtpEmail, sendWelcomeEmail };
