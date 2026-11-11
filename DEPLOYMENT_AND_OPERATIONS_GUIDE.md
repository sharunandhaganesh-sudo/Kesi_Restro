# Smart Restaurant Management System
## Deployment, Configuration & Operations Guide

**System Type:** Dine-In Restaurant Management & Customer Queue Optimization  
**Architecture:** Google Apps Script (V8 runtime) + 1 Shared Google Spreadsheet (12 tabs, 108 columns) + 5 Web Interfaces  
**Security Standard:** PBKDF2-HMAC-SHA256 (Staff/Admin/Kitchen) & HMAC-SHA256 (Customer OTP)  

---

### Table of Contents
1. [Google Spreadsheet Setup](#1-google-spreadsheet-setup)
2. [Google Apps Script Project Setup](#2-google-apps-script-project-setup)
3. [Secret Configuration (`OTP_HMAC_SECRET`)](#3-secret-configuration)
4. [Email Authorization & MailApp OTP Testing](#4-email-authorization--mailapp-otp-testing)
5. [Owner Initial Administrator Provisioning](#5-owner-initial-administrator-provisioning)
6. [Web App Deployment](#6-web-app-deployment)
7. [Daily Restaurant Operations Manual](#7-daily-restaurant-operations-manual)

---

### 1. Google Spreadsheet Setup

1. Log into your designated restaurant Google Workspace or Gmail account.
2. Open [Google Sheets](https://sheets.new) and create a **new blank spreadsheet**.
3. Name the spreadsheet: `Savor Restaurant Database - Production`.
4. Copy the **Spreadsheet ID** from the browser URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
   ```
5. You do not need to create all 108 columns manually! The included script `DatabaseSetup.js` will automatically create all 12 tabs with exact headers and frozen rows in one click without modifying or deleting data.

---

### 2. Google Apps Script Project Setup

1. Open [Google Apps Script](https://script.google.com/home).
2. Click **New Project** and name it `Savor Restaurant Backend`.
3. In the left file tree, add the modular files from the `/gas/` directory in this codebase:
   - `Code.gs` (Central request entry point & dispatcher)
   - `Config.js` (Copied from `Config.template.js`)
   - `DatabaseSchema.js` (Exact 12 tabs and 108 column definitions)
   - `Database.js` (Spreadsheet connection & verification)
   - `DatabaseSetup.js` (Non-destructive tab initializer)
4. In `Config.js`, set your Spreadsheet ID:
   ```javascript
   var APP_CONFIG = {
     SPREADSHEET_ID: "YOUR_COPIED_SPREADSHEET_ID_HERE",
     DEFAULT_TAX_RATE_PERCENT: 5,
     GRACE_PERIOD_MINUTES: 10,
     STAFF_VERIFICATION_MINUTES: 15,
     DINING_DURATION_MINUTES: 90,
     CLEANING_TURNOVER_MINUTES: 15,
     BLOCKING_WINDOW_MINUTES: 105,
     OTP_SECRET_PROPERTY_KEY: "OTP_HMAC_SECRET"
   };
   ```
5. In the Apps Script toolbar, select the function `initializeMissingDatabaseTabs` and click **Run**.
6. Review your Google Sheet: all 12 tabs (`Customers`, `Bookings`, `Tables`, `Table_Reservations`, `Menu`, `Orders`, `Order_Items`, `Bills`, `Payments`, `Users`, `Restaurant_Settings`, `Order_Status_History`) are now created with exact columns and beige header styling!

---

### 3. Secret Configuration

Per Blueprint Section 5.4, the only approved secret is `OTP_HMAC_SECRET`.

1. Generate a random 32-byte secret locally in your terminal or browser:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. In Google Apps Script, navigate to:
   **Project Settings (Gear icon ⚙️)** → **Script Properties**.
3. Click **Add script property**:
   - **Property:** `OTP_HMAC_SECRET`
   - **Value:** `<Your 64-character random hex string>`
4. Click **Save script properties**.
5. *Security Rule:* Never paste this secret in source code, chat, or commits.

---

### 4. Email Authorization & MailApp OTP Testing

Customer authentication uses `MailApp.sendEmail()` to deliver 6-digit verification codes.

1. In Google Apps Script, run any function (or a test email helper) to trigger Google's OAuth consent prompt.
2. Click **Review Permissions**, choose your restaurant Google account, and grant access to **Send email on your behalf**.
3. Test delivery:
   - In the Customer Website, enter your real 10-digit mobile number and email.
   - Click **Send Verification OTP**.
   - Check your inbox for the branded email: `Your Savor Restaurant Verification Code`.
   - Verify that entering the 6-digit code logs you into the Customer portal.

---

### 5. Owner Initial Administrator Provisioning

Per Blueprint Section 3 & 7.2:
- Never hardcode default administrator credentials into production code.
- Provide a secure one-time bootstrap script for the restaurant owner.

To create the first Administrator account:
1. In `DatabaseSetup.js`, run `provisionInitialAdministrator`:
   ```javascript
   function provisionInitialAdministrator(adminEmail, strongPassword) {
     var ss = getDatabaseConnection();
     var usersSheet = ss.getSheetByName("Users");
     
     // Generates unique salt and PBKDF2-HMAC-SHA256 hash
     var salt = Utilities.getUuid().replace(/-/g, '').slice(0, 32);
     var hash = computePbkdf2Hash(strongPassword, salt);
     
     usersSheet.appendRow([
       "USR-ADMIN-01",
       "admin",
       adminEmail,
       "Admin",
       "Active",
       hash,
       salt,
       "[]"
     ]);
   }
   ```
2. Run this function once with the owner's email and strong password.
3. Delete or disable the bootstrap function after creation.
4. The Owner can now log into the **Admin Website** (`5. Admin Web`) and provision Staff and Kitchen accounts directly from the UI.

---

### 6. Web App Deployment

1. In Google Apps Script, click **Deploy** → **New Deployment**.
2. Select type: **Web app**.
3. Description: `Savor Production v3.0`.
4. Execute as: **Me** (`your-restaurant@gmail.com`).
5. Who has access: **Anyone**.
6. Click **Deploy** and copy the **Web App URL**.
7. In the frontend application, requests route to this Web App URL, connecting all five websites to your live Google Spreadsheet!

---

### 7. Daily Restaurant Operations Manual

#### Host & Waitstaff (Staff Website)
1. **Arrivals & Verification:** When an online reservation party arrives, customer taps "I'm Arrived" on their phone within the 10-minute grace period. Staff sees the alert in the **Arrivals** tab and clicks **Verify Arrival** within 15 minutes.
2. **Walk-In Queue:** When walk-in parties arrive, the system calculates capacity-fit tables. Staff clicks **Call to Table** to hold the table (atomically protected from double-allocation) and clicks **Seat Guests** once seated.
3. **Order Authorization:** Staff reviews incoming customer orders in the **Order Authorization** tab and clicks **Authorize for Kitchen** to send tickets to the kitchen display.
4. **Billing:** When dining is finished, staff generates the single final bill (with optional discount and mandatory reason).
5. **Manual UPI Verification:** Customer scans the UPI QR and enters their UTR number. Staff checks the restaurant's actual bank account or UPI soundbox/app. Once confirmed, staff clicks **Verify & Mark Paid**.
6. **Departure & Table Release:** Staff clicks **Depart & Clean**. The table is sanitized and released after the 15-minute turnover allowance.

#### Kitchen Chefs (Kitchen Website)
1. Chefs view only staff-authorized order tickets on their dedicated screen.
2. Click **Start Cooking** when preparation begins (`In_Preparation`).
3. Click **Mark Ready for Server** once dishes are plated (`Ready_For_Serving`).
4. Click **Delivered to Customer Table** when food is served (`Served`).
5. *Isolation rule:* Kitchen cannot modify table statuses, generate bills, or approve refunds.

#### Management (Admin Website)
1. View executive analytics: gross bill totals, verified cashflow, pending UPI references, and refunds.
2. Add or update menu items and pricing (server-side price authority).
3. Review and approve or reject customer refund requests.
4. Provision new staff accounts with secure PBKDF2 password hashing.
