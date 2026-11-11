/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Database.js - Shared Google Sheets connection helper and schema verifier
 * Compatible with Google Apps Script V8 runtime
 */

/**
 * Returns single shared Spreadsheet connection
 */
function getDatabaseConnection() {
  var spreadsheetId = getApprovedSpreadsheetIdFromConfig();
  if (!spreadsheetId || spreadsheetId === "YOUR_GOOGLE_SPREADSHEET_ID_HERE") {
    throw new Error("Database is not configured. Please set SPREADSHEET_ID in Config.js.");
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

/**
 * Checks whether database configuration exists and is syntactically usable
 */
function isDatabaseConfigured() {
  var id = getApprovedSpreadsheetIdFromConfig();
  return Boolean(id && id.length > 10 && id !== "YOUR_GOOGLE_SPREADSHEET_ID_HERE");
}

/**
 * Read-only schema verification: checks required 12 tabs, exact 108 headers,
 * and reports any missing/extra columns without modifying any data.
 */
function verifyDatabase() {
  var ss = getDatabaseConnection();
  var sheets = ss.getSheets();
  var sheetNames = sheets.map(function(s) { return s.getName(); });
  
  var errors = [];
  var matchedTabs = 0;
  var matchedColumns = 0;
  
  for (var tabName in DATABASE_SCHEMA) {
    var expectedCols = DATABASE_SCHEMA[tabName].columns;
    var targetSheet = ss.getSheetByName(tabName);
    
    if (!targetSheet) {
      errors.push("Missing required tab: '" + tabName + "'");
      continue;
    }
    
    matchedTabs++;
    var lastCol = targetSheet.getLastColumn();
    var actualHeaders = lastCol > 0 ? targetSheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    
    if (actualHeaders.length !== expectedCols.length) {
      errors.push("Tab '" + tabName + "' column count mismatch: expected " + expectedCols.length + ", found " + actualHeaders.length);
    }
    
    for (var i = 0; i < expectedCols.length; i++) {
      if (actualHeaders[i] !== expectedCols[i]) {
        errors.push("Tab '" + tabName + "' column " + (i + 1) + " mismatch: expected '" + expectedCols[i] + "', found '" + (actualHeaders[i] || 'EMPTY') + "'");
      } else {
        matchedColumns++;
      }
    }
  }
  
  return {
    isFullyValid: errors.length === 0,
    matchedTabs: matchedTabs,
    totalExpectedTabs: Object.keys(DATABASE_SCHEMA).length,
    matchedColumns: matchedColumns,
    totalExpectedColumns: getTotalColumnsCount(),
    errors: errors
  };
}
