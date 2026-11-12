/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * DatabaseSetup.js - Complete Google Sheets 12-Tab & 108-Column Database Initializer & Seeder
 * Compatible with Google Apps Script V8 runtime.
 * 
 * INSTRUCTIONS FOR USER:
 * If your Google Sheet ("Restro Manage") is currently empty with only "Sheet1":
 * 1. In your Google Sheet, click Extensions > Apps Script.
 * 2. Copy the contents of this project (Code.gs, DatabaseSchema.js, DatabaseSetup.js, EmailService.js) into Apps Script.
 * 3. In the function dropdown at top, select "setupAndSeedCompleteDatabase" and click "Run".
 * 4. All 12 tabs and 108 columns will be created instantly and seeded with your real UPI details (Kesika M / kesikam2006@oksbi),
 *    tables, menu, settings, and demo accounts!
 */

/**
 * Gets active spreadsheet or falls back to Config.js SPREADSHEET_ID
 */
function getTargetSpreadsheet() {
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {
    // Not container-bound
  }
  return getDatabaseConnection();
}

/**
 * Initializes missing tabs and exact headers on a confirmed fresh spreadsheet.
 * Strictly non-destructive: never clears, overwrites, or deletes existing data rows.
 */
function initializeMissingDatabaseTabs() {
  var ss = getTargetSpreadsheet();
  var createdTabs = [];
  var existingTabs = [];
  
  for (var tabName in DATABASE_SCHEMA) {
    var def = DATABASE_SCHEMA[tabName];
    var sheet = ss.getSheetByName(tabName);
    
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
      sheet.getRange(1, 1, 1, def.columns.length).setValues([def.columns]);
      sheet.getRange(1, 1, 1, def.columns.length).setFontWeight("bold").setBackground("#F5F5F7").setFontColor("#1D1D1F");
      sheet.setFrozenRows(1);
      createdTabs.push(tabName);
    } else {
      existingTabs.push(tabName);
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, def.columns.length).setValues([def.columns]);
        sheet.getRange(1, 1, 1, def.columns.length).setFontWeight("bold").setBackground("#F5F5F7").setFontColor("#1D1D1F");
        sheet.setFrozenRows(1);
      }
    }
  }
  
  // Clean up default "Sheet1" if newly created and empty
  var defaultSheet1 = ss.getSheetByName("Sheet1");
  if (defaultSheet1 && ss.getSheets().length > 1 && defaultSheet1.getLastRow() === 0) {
    try {
      ss.deleteSheet(defaultSheet1);
    } catch (e) {
      // Ignore if cannot delete
    }
  }
  
  return {
    success: true,
    createdTabs: createdTabs,
    existingTabs: existingTabs,
    message: "Database tabs verified/initialized successfully."
  };
}

/**
 * 1-Click Master Initializer & Seeder for Empty Google Sheets
 * Run this function once from the Apps Script editor toolbar.
 */
function setupAndSeedCompleteDatabase() {
  Logger.log("=== STARTING FULL DATABASE INITIALIZATION & SEEDING ===");
  var ss = getTargetSpreadsheet();
  Logger.log("Target Spreadsheet Name: " + ss.getName() + " (ID: " + ss.getId() + ")");

  // Step 1: Create all 12 tabs with 108 columns
  var tabResult = initializeMissingDatabaseTabs();
  Logger.log("Tabs created: " + JSON.stringify(tabResult.createdTabs));

  // Step 2: Seed Restaurant Settings if empty
  var settingsSheet = ss.getSheetByName("Restaurant_Settings");
  if (settingsSheet && settingsSheet.getLastRow() <= 1) {
    var defaultSettings = [
      ["RESTAURANT_NAME", "Treat & Taste"],
      ["UPI_ID", "kesikam2006@oksbi"],
      ["UPI_PAYEE_NAME", "Kesika M"],
      ["TAX_RATE_PERCENT", "5"],
      ["MAX_STAFF_DISCOUNT_PERCENT", "10"],
      ["MAX_ADMIN_DISCOUNT_PERCENT", "50"],
      ["OPENING_TIME", "11:00"],
      ["CLOSING_TIME", "23:00"],
      ["GRACE_PERIOD_MINUTES", "10"],
      ["STAFF_VERIFICATION_TIMEOUT_MINUTES", "15"],
      ["DINING_DURATION_MINUTES", "90"],
      ["CLEANING_TURNOVER_MINUTES", "15"],
      ["TOTAL_BLOCKING_WINDOW_MINUTES", "105"]
    ];
    settingsSheet.getRange(2, 1, defaultSettings.length, 2).setValues(defaultSettings);
    Logger.log("Seeded " + defaultSettings.length + " Restaurant Settings.");
  }

  // Step 3: Seed Physical Tables (TBL-01 to TBL-10)
  var tablesSheet = ss.getSheetByName("Tables");
  if (tablesSheet && tablesSheet.getLastRow() <= 1) {
    var tables = [
      ["TBL-01", "T1", 2, "Available"],
      ["TBL-02", "T2", 2, "Available"],
      ["TBL-03", "T3", 4, "Available"],
      ["TBL-04", "T4", 4, "Available"],
      ["TBL-05", "T5", 4, "Available"],
      ["TBL-06", "T6", 6, "Available"],
      ["TBL-07", "T7", 6, "Available"],
      ["TBL-08", "T8", 8, "Available"],
      ["TBL-09", "T9", 2, "Available"],
      ["TBL-10", "T10", 4, "Available"]
    ];
    tablesSheet.getRange(2, 1, tables.length, 4).setValues(tables);
    Logger.log("Seeded " + tables.length + " Dining Tables.");
  }

  // Step 4: Seed Menu Items (10 culinary items)
  var menuSheet = ss.getSheetByName("Menu");
  if (menuSheet && menuSheet.getLastRow() <= 1) {
    var menu = [
      ["FOOD-01", "Crispy Truffle Fries", "Starters", "Golden hand-cut fries tossed in aromatic truffle oil, parmesan, and fresh rosemary.", 280, "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80", "Available", 12, "Active"],
      ["FOOD-02", "Paneer Tikka Herb Skewers", "Starters", "Char-grilled cottage cheese cubes marinated in Kashmiri chili and tandoori spices.", 340, "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80", "Available", 18, "Active"],
      ["FOOD-03", "Smoked Chicken Bruschetta", "Starters", "Artisan sourdough topped with smoked pulled chicken, sun-dried tomatoes, and basil pesto.", 360, "https://images.unsplash.com/photo-1541529086526-db283c563270?auto=format&fit=crop&w=600&q=80", "Available", 15, "Active"],
      ["FOOD-04", "Wild Mushroom Risotto", "Mains", "Creamy Arborio rice slow-cooked with porcini, shiitake mushrooms, white truffle oil, and aged parmesan.", 520, "https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?auto=format&fit=crop&w=600&q=80", "Available", 25, "Active"],
      ["FOOD-05", "Butter Chicken with Garlic Naan", "Mains", "Tender tandoori chicken simmered in rich velvety tomato-butter gravy, served with fresh clay-oven garlic naan.", 560, "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=600&q=80", "Available", 22, "Active"],
      ["FOOD-06", "Pan-Seared Herb Salmon", "Mains", "Atlantic salmon fillet seared with dill butter, garlic mashed potatoes, and sautéed asparagus.", 780, "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80", "Available", 24, "Active"],
      ["FOOD-07", "Molten Belgian Chocolate Lava Cake", "Desserts", "Warm 70% dark Belgian chocolate cake with a molten center, served with Madagascan vanilla bean gelato.", 310, "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80", "Available", 15, "Active"],
      ["FOOD-08", "Classic Tiramisu Cup", "Desserts", "Espresso-soaked savoiardi biscuits layered with mascarpone cream and dusted with Valrhona cocoa.", 290, "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=600&q=80", "Available", 8, "Active"],
      ["FOOD-09", "Saffron Mango Cardamom Lassi", "Beverages", "Chilled Alphonso mango blended with hung curd, infused with royal Kashmiri saffron strands.", 210, "https://images.unsplash.com/photo-1553787499-6f9133860278?auto=format&fit=crop&w=600&q=80", "Available", 5, "Active"],
      ["FOOD-10", "Artisan Cold Brew Hibiscus Tonic", "Beverages", "Single-origin Ethiopian cold brew coffee paired with organic wild hibiscus and craft tonic water.", 240, "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80", "Available", 6, "Active"]
    ];
    menuSheet.getRange(2, 1, menu.length, 9).setValues(menu);
    Logger.log("Seeded " + menu.length + " Menu items.");
  }

  // Step 5: Seed Demo Customers
  var custSheet = ss.getSheetByName("Customers");
  if (custSheet && custSheet.getLastRow() <= 1) {
    var nowIso = new Date().toISOString();
    var customers = [
      ["CUST-001", "Ananya Sharma", "9876543210", "ananya.sharma@example.com", nowIso, "", "", 0, "", ""],
      ["CUST-002", "Vikram Patel", "9876543211", "vikram.patel@example.com", nowIso, "", "", 0, "", ""],
      ["CUST-003", "Priya Sundaram", "9876543212", "priya.sundaram@example.com", nowIso, "", "", 0, "", ""]
    ];
    custSheet.getRange(2, 1, customers.length, 10).setValues(customers);
    Logger.log("Seeded demo Customers.");
  }

  Logger.log("=== SETUP COMPLETED SUCCESSFULLY! All 12 tabs and 108 columns are ready. ===");
  return {
    success: true,
    message: "Google Sheets Database initialized with 12 tabs and 108 columns successfully!"
  };
}
