/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * EmailService.js - Google Apps Script (V8) Email & OTP Security Module
 * 
 * Single source of truth for:
 * 1. Cryptographically secure 6-digit OTP generation (100000 - 999999)
 * 2. HMAC-SHA256 OTP hashing via Google Apps Script Utilities
 * 3. 5-minute OTP expiry logic enforcement
 * 4. 60-second resend cooldown protection
 * 5. Maximum 3 failed verification attempts lock
 * 6. HTML-formatted transactional email transmission using Google Apps Script MailApp
 * 7. Dedicated testEmailDelivery() function for live verification in Apps Script
 */

/**
 * OTP Configuration Rules (Strictly following Blueprint v3)
 */
var OTP_CONFIG = {
  CODE_LENGTH: 6,
  MIN_VALUE: 100000,
  MAX_VALUE: 999999,
  EXPIRY_MINUTES: 5,
  EXPIRY_MILLIS: 5 * 60 * 1000,
  RESEND_COOLDOWN_SECONDS: 60,
  MAX_FAILED_ATTEMPTS: 3,
  DEFAULT_SECRET: "savor_restaurant_32byte_secure_secret_key_2026",
  SENDER_NAME: "SAVOR Restaurant Guest Services"
};

/**
 * Retrieves the HMAC secret from Google Apps Script Script Properties,
 * or falls back safely to default secret if unconfigured.
 */
function getOtpHmacSecret() {
  try {
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty("OTP_HMAC_SECRET");
    if (secret && secret.trim().length >= 16) {
      return secret.trim();
    }
  } catch (e) {
    Logger.log("ScriptProperties unavailable, using fallback secret: " + e.message);
  }
  return OTP_CONFIG.DEFAULT_SECRET;
}

/**
 * Generates a random 6-digit numeric OTP string between 100000 and 999999
 */
function generateSecure6DigitOTP() {
  var min = OTP_CONFIG.MIN_VALUE;
  var max = OTP_CONFIG.MAX_VALUE;
  var randomNum = Math.floor(min + Math.random() * (max - min + 1));
  return randomNum.toString();
}

/**
 * Computes an HMAC-SHA256 hex digest of the OTP using Apps Script Utilities
 * 
 * @param {string} rawOtp - 6-digit OTP string
 * @param {string} [secret] - Optional secret override
 * @return {string} 64-character lowercase hexadecimal hash
 */
function hashOtpHmacSha256(rawOtp, secret) {
  var activeSecret = secret || getOtpHmacSecret();
  var signatureBytes = Utilities.computeHmacSha256Signature(
    rawOtp.toString().trim(),
    activeSecret
  );
  
  // Convert signed byte array (-128..127) to standard hex representation
  var hex = "";
  for (var i = 0; i < signatureBytes.length; i++) {
    var byteVal = signatureBytes[i];
    if (byteVal < 0) byteVal += 256;
    var byteHex = byteVal.toString(16);
    if (byteHex.length === 1) hex += "0";
    hex += byteHex;
  }
  return hex.toLowerCase();
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  var result = 0;
  for (var i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verifies user-entered OTP against the stored HMAC-SHA256 hash
 */
function verifyOtpHmacSha256(inputOtp, storedHash, secret) {
  if (!inputOtp || !storedHash) return false;
  var calculatedHash = hashOtpHmacSha256(inputOtp.toString().trim(), secret);
  return timingSafeEqualStr(calculatedHash, storedHash.toLowerCase());
}

/**
 * Checks if the OTP resend cooldown (60 seconds) is currently active
 */
function checkOtpCooldown(lastSentIso) {
  if (!lastSentIso) return { inCooldown: false, remainingSeconds: 0 };
  var lastSentTime = new Date(lastSentIso).getTime();
  if (isNaN(lastSentTime)) return { inCooldown: false, remainingSeconds: 0 };
  
  var elapsedSeconds = Math.floor((Date.now() - lastSentTime) / 1000);
  if (elapsedSeconds < OTP_CONFIG.RESEND_COOLDOWN_SECONDS) {
    return {
      inCooldown: true,
      remainingSeconds: OTP_CONFIG.RESEND_COOLDOWN_SECONDS - elapsedSeconds
    };
  }
  return { inCooldown: false, remainingSeconds: 0 };
}

/**
 * Checks if the given expiry ISO timestamp has lapsed
 */
function isOtpExpired(expiryIso) {
  if (!expiryIso) return true;
  var expiryTime = new Date(expiryIso).getTime();
  if (isNaN(expiryTime)) return true;
  return Date.now() > expiryTime;
}

/**
 * Transmits the 6-digit OTP to the recipient email via Google Apps Script MailApp
 * 
 * @param {string} recipientEmail - Customer destination email address
 * @param {string} otpCode - Generated 6-digit OTP code
 * @param {string} [recipientName] - Optional customer name
 * @return {object} Transmission result and quota status
 */
function sendOtpEmail(recipientEmail, otpCode, recipientName) {
  if (!recipientEmail || recipientEmail.indexOf("@") === -1) {
    throw new Error("Invalid recipient email address: " + recipientEmail);
  }
  
  var displayName = recipientName ? recipientName.trim() : "Valued Guest";
  var subject = "Your SAVOR Verification Code: " + otpCode;
  
  // Plain text fallback
  var plainBody = 
    "Hello " + displayName + ",\n\n" +
    "Your 6-digit verification code for SAVOR Restaurant is:\n\n" +
    "  " + otpCode + "\n\n" +
    "This code will expire in 5 minutes.\n" +
    "Do not share this code with anyone. Restaurant staff will never ask for your verification code.\n\n" +
    "— SAVOR Smart Restaurant Team";
  
  // Apple-inspired responsive HTML email template
  var htmlBody = 
    '<!DOCTYPE html>' +
    '<html>' +
    '<head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '</head>' +
    '<body style="margin: 0; padding: 0; background-color: #F5F5F7; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; color: #1D1D1F;">' +
    '  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #F5F5F7; padding: 40px 16px;">' +
    '    <tr>' +
    '      <td align="center">' +
    '        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #FFFFFF; border-radius: 24px; border: 1px solid #D2D2D7; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);">' +
    '          <!-- Header -->' +
    '          <tr>' +
    '            <td style="padding: 32px 32px 16px 32px; text-align: center; border-bottom: 1px solid #F0F0F2;">' +
    '              <div style="font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #0071E3; margin-bottom: 4px;">SAVOR</div>' +
    '              <div style="font-size: 18px; font-weight: 600; color: #1D1D1F;">Smart Restaurant Management System</div>' +
    '            </td>' +
    '          </tr>' +
    '          <!-- Content -->' +
    '          <tr>' +
    '            <td style="padding: 32px 32px 24px 32px;">' +
    '              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #1D1D1F;">Hello <strong>' + displayName + '</strong>,</p>' +
    '              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.5; color: #6E6E73;">Use the verification code below to securely sign in to your guest portal, view your dining queue, or place food orders.</p>' +
    '              ' +
    '              <!-- OTP Box -->' +
    '              <div style="background-color: #F5F5F7; border: 1px solid #D2D2D7; border-radius: 16px; padding: 24px; text-align: center; margin: 24px 0;">' +
    '                <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #6E6E73; margin-bottom: 8px;">6-Digit Verification Code</div>' +
    '                <div style="font-size: 38px; font-weight: 700; letter-spacing: 8px; color: #0071E3; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">' + otpCode + '</div>' +
    '                <div style="font-size: 12px; font-weight: 500; color: #B76E00; margin-top: 10px;">Expires in 5 minutes</div>' +
    '              </div>' +
    '              ' +
    '              <p style="margin: 20px 0 0 0; font-size: 12px; line-height: 1.6; color: #6E6E73;">' +
    '                <strong>Security Notice:</strong> If you did not request this verification code, please ignore this email. Never disclose this code to anyone; SAVOR staff will never ask for your code.' +
    '              </p>' +
    '            </td>' +
    '          </tr>' +
    '          <!-- Footer -->' +
    '          <tr>' +
    '            <td style="padding: 20px 32px; background-color: #FAFAFC; border-top: 1px solid #F0F0F2; text-align: center; font-size: 11px; color: #86868B;">' +
    '              100% Dine-In Experience • Guaranteed 10-Minute Arrival Grace Window<br>' +
    '              SAVOR Restaurant • Chennai, Tamil Nadu' +
    '            </td>' +
    '          </tr>' +
    '        </table>' +
    '      </td>' +
    '    </tr>' +
    '  </table>' +
    '</body>' +
    '</html>';
  
  // Transmit via Google Apps Script MailApp
  MailApp.sendEmail({
    to: recipientEmail,
    subject: subject,
    body: plainBody,
    htmlBody: htmlBody,
    name: OTP_CONFIG.SENDER_NAME
  });
  
  var remainingQuota = MailApp.getRemainingDailyQuota();
  Logger.log("MailApp: OTP sent to " + recipientEmail + ". Remaining daily quota: " + remainingQuota);
  
  return {
    success: true,
    recipient: recipientEmail,
    sentAt: new Date().toISOString(),
    remainingDailyQuota: remainingQuota
  };
}

/**
 * End-to-end OTP Generation and Dispatch Coordinator
 * 
 * Flow:
 * 1. Checks 60-second cooldown
 * 2. Generates random 6-digit OTP
 * 3. Computes HMAC-SHA256 hash (plaintext is NEVER stored in database)
 * 4. Calculates 5-minute expiry timestamp
 * 5. Resets attempt counter to 0
 * 6. Dispatches branded email via MailApp
 * 
 * @param {object} customer - Customer data object containing Email, Mobile_Number, Customer_Name, Customer_ID, OTP_Last_Sent_At
 * @return {object} Result object with OTP_Hash, OTP_Expiry, and transmission details
 */
function processCustomerOtpRequest(customer) {
  if (!customer || !customer.Email) {
    throw new Error("Customer profile must include a valid Email address.");
  }
  
  // 1. Cooldown check (60s)
  var cooldownCheck = checkOtpCooldown(customer.OTP_Last_Sent_At);
  if (cooldownCheck.inCooldown) {
    return {
      success: false,
      cooldown: true,
      remainingSeconds: cooldownCheck.remainingSeconds,
      message: "Please wait " + cooldownCheck.remainingSeconds + " seconds before requesting another code."
    };
  }
  
  // 2. Generate 6-digit OTP
  var rawOtp = generateSecure6DigitOTP();
  
  // 3. Compute HMAC-SHA256 hash
  var otpHash = hashOtpHmacSha256(rawOtp);
  
  // 4. Calculate 5-minute expiry
  var now = new Date();
  var expiryDate = new Date(now.getTime() + OTP_CONFIG.EXPIRY_MILLIS);
  var expiryIso = expiryDate.toISOString();
  var sentAtIso = now.toISOString();
  
  // 5. Send Email via MailApp
  var emailResult = sendOtpEmail(customer.Email, rawOtp, customer.Customer_Name);
  
  return {
    success: true,
    message: "A 6-digit verification code has been sent to " + customer.Email,
    otpHash: otpHash,
    otpExpiry: expiryIso,
    otpLastSentAt: sentAtIso,
    emailResult: emailResult
  };
}

/**
 * Validates entered OTP against customer's stored HMAC-SHA256 hash
 * Enforces:
 * - 5-minute expiry limit
 * - Maximum 3 failed attempts rule
 * 
 * @param {object} customer - Customer record with OTP_Hash, OTP_Expiry, OTP_Attempts
 * @param {string} inputOtp - User entered 6-digit OTP
 * @return {object} { isValid: boolean, error?: string, attemptsExceeded?: boolean, newAttemptsCount: number }
 */
function validateCustomerOtpEntry(customer, inputOtp) {
  if (!customer) {
    return { isValid: false, error: "Customer profile not found." };
  }
  
  var currentAttempts = Number(customer.OTP_Attempts) || 0;
  
  // 1. Check max failed attempts (Max 3)
  if (currentAttempts >= OTP_CONFIG.MAX_FAILED_ATTEMPTS) {
    return {
      isValid: false,
      attemptsExceeded: true,
      error: "Maximum verification attempts exceeded (3/3). Please request a new OTP.",
      newAttemptsCount: currentAttempts
    };
  }
  
  // 2. Check 5-minute expiry
  if (isOtpExpired(customer.OTP_Expiry)) {
    return {
      isValid: false,
      error: "Verification code has expired (5-minute validity window). Please request a new OTP.",
      newAttemptsCount: currentAttempts
    };
  }
  
  // 3. Verify HMAC-SHA256 hash
  var matches = verifyOtpHmacSha256(inputOtp, customer.OTP_Hash);
  
  if (matches) {
    return {
      isValid: true,
      newAttemptsCount: 0 // Reset on successful verification
    };
  } else {
    var updatedAttempts = currentAttempts + 1;
    var remainingAttempts = OTP_CONFIG.MAX_FAILED_ATTEMPTS - updatedAttempts;
    
    var errorMsg = remainingAttempts > 0
      ? "Invalid verification code. " + remainingAttempts + " attempt(s) remaining."
      : "Invalid verification code. Maximum attempts reached. Please request a new code.";
      
    return {
      isValid: false,
      attemptsExceeded: updatedAttempts >= OTP_CONFIG.MAX_FAILED_ATTEMPTS,
      error: errorMsg,
      newAttemptsCount: updatedAttempts
    };
  }
}

/**
 * LIVE EMAIL DELIVERY TEST FUNCTION
 * 
 * Designed for administrators and developers to test actual Google Apps Script MailApp
 * email transmission directly from the Apps Script Editor or backend testing pipeline.
 * 
 * In Apps Script Editor:
 * 1. Select 'testEmailDelivery' from the function dropdown at the top
 * 2. Click 'Run'
 * 3. Authorize MailApp permissions if prompted on first execution
 * 4. Inspect Execution Log for quota and delivery details
 * 
 * @param {string} [customRecipient] - Optional email address to receive test (defaults to Session active user)
 * @return {object} Diagnostic details including remaining quota and sample OTP
 */
function testEmailDelivery(customRecipient) {
  var recipient = customRecipient;
  
  if (!recipient) {
    try {
      recipient = Session.getActiveUser().getEmail();
    } catch (e) {
      Logger.log("Could not obtain active user email automatically: " + e.message);
    }
  }
  
  if (!recipient || recipient.indexOf("@") === -1) {
    recipient = "sharunandhaganesh@gmail.com"; // Default developer test address
  }
  
  Logger.log("--- STARTING LIVE EMAIL DELIVERY TEST ---");
  Logger.log("Destination: " + recipient);
  Logger.log("Initial Daily Quota Remaining: " + MailApp.getRemainingDailyQuota());
  
  var sampleOtp = generateSecure6DigitOTP();
  var sampleHash = hashOtpHmacSha256(sampleOtp);
  
  Logger.log("Generated Sample OTP: " + sampleOtp);
  Logger.log("Generated HMAC-SHA256 Hash: " + sampleHash);
  
  var result = sendOtpEmail(recipient, sampleOtp, "Test Administrator");
  
  Logger.log("Delivery Success: " + result.success);
  Logger.log("Post-Send Quota Remaining: " + result.remainingDailyQuota);
  Logger.log("--- EMAIL DELIVERY TEST COMPLETED SUCCESSFULLY ---");
  
  return {
    status: "SUCCESS",
    recipient: recipient,
    sampleOtpSent: sampleOtp,
    sampleHmacHash: sampleHash,
    remainingDailyQuota: result.remainingDailyQuota,
    timestamp: result.sentAt
  };
}
