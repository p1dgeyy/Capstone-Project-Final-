// QR Code Generation Utility for Beneficiary Accounts
// Generates a unique QR code ID (UUID-based) and a QR code image (base64 data URL)
//
// The QR payload contains a JSON object with:
//   - type: "BENEFICIARY"
//   - qr_code_id: the beneficiary's unique QR code identifier
//   - name: beneficiary's full name
//
// The qr_code_id serves as the beneficiary's primary key in the database

const QRCode = require('qrcode');
const crypto = require('crypto');

/**
 * Generate a unique QR code ID for a beneficiary.
 * Format: BEN-<uuid-v4>
 *
 * @returns {string} — unique QR code identifier
 */
function generateQrCodeId() {
  const uuid = crypto.randomUUID();
  return `BEN-${uuid}`;
}

/**
 * Generate a QR code image (base64 data URL) for a beneficiary account.
 *
 * @param {string} qrCodeId  — the beneficiary's unique QR code identifier
 * @param {string} firstName — beneficiary's first name
 * @param {string} lastName  — beneficiary's last name
 * @returns {Promise<string>} — base64 data URL string (image/png)
 */
async function generateBeneficiaryQR(qrCodeId, firstName, lastName) {
  const payload = JSON.stringify({
    type: 'BENEFICIARY',
    qr_code_id: qrCodeId,
    name: `${firstName} ${lastName}`,
    portal: 'Koronadal City Assistance Portal',
    generated: new Date().toISOString()
  });

  try {
    // Generate QR code as a PNG base64 data URL
    const dataUrl = await QRCode.toDataURL(payload, {
      type: 'image/png',
      width: 300,
      margin: 2,
      color: {
        dark: '#0F172A',   // Navy slate (matches portal design)
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });

    console.log(`[QR] Generated QR code for beneficiary ${qrCodeId} (${firstName} ${lastName})`);
    return dataUrl;
  } catch (err) {
    console.error(`[QR] Failed to generate QR code for ${qrCodeId}:`, err.message);
    throw err;
  }
}

module.exports = { generateQrCodeId, generateBeneficiaryQR };
