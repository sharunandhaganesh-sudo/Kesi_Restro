/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Config.js - Live Runtime Configuration for Google Apps Script
 * Connects directly to Google Spreadsheet 1fdbI2ocFwJM3-RlYqegAWMRUEE0o2y-0Lh18HTOJ7Z8
 */

var APP_CONFIG = {
  // Configured Google Spreadsheet ID
  SPREADSHEET_ID: "1fdbI2ocFwJM3-RlYqegAWMRUEE0o2y-0Lh18HTOJ7Z8",
  
  // Restaurant operational parameters (Blueprint Section 10 & 20)
  // GST Tax rate is explicitly unconfigured until confirmed by the restaurant owner
  DEFAULT_TAX_RATE_PERCENT: null,
  GRACE_PERIOD_MINUTES: 10,
  STAFF_VERIFICATION_MINUTES: 15,
  DINING_DURATION_MINUTES: 90,
  CLEANING_TURNOVER_MINUTES: 15,
  BLOCKING_WINDOW_MINUTES: 105,
  
  // Script Properties secret key name:
  OTP_SECRET_PROPERTY_KEY: "OTP_HMAC_SECRET"
};

function getApprovedSpreadsheetIdFromConfig() {
  return APP_CONFIG.SPREADSHEET_ID;
}
