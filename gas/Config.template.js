/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Config.template.js - Safe example template for Google Apps Script deployment
 * Copy this to Config.js in your Google Apps Script project and set your spreadsheet ID.
 * Do NOT commit or expose real secrets.
 */

var APP_CONFIG = {
  // Replace with your fresh Google Spreadsheet ID from its URL
  SPREADSHEET_ID: "YOUR_GOOGLE_SPREADSHEET_ID_HERE",
  
  // Restaurant operational parameters
  DEFAULT_TAX_RATE_PERCENT: 5,
  GRACE_PERIOD_MINUTES: 10,
  STAFF_VERIFICATION_MINUTES: 15,
  DINING_DURATION_MINUTES: 90,
  CLEANING_TURNOVER_MINUTES: 15,
  BLOCKING_WINDOW_MINUTES: 105,
  
  // Script Properties secret key name:
  // Set in Apps Script Project Settings -> Script Properties:
  // Key: OTP_HMAC_SECRET
  // Value: <generate 32-byte random hex string locally>
  OTP_SECRET_PROPERTY_KEY: "OTP_HMAC_SECRET"
};

function getApprovedSpreadsheetIdFromConfig() {
  return APP_CONFIG.SPREADSHEET_ID;
}
