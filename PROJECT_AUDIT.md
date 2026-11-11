# Smart Restaurant Management & Customer Queue Optimization System
## Project Audit Report

**Date:** 2026-11-10  
**Blueprint Reference:** `Smart_Restaurant_Management_System_Complete_End_to_End_Blueprint_v3.pdf` (19 pages)  
**Author:** Full-Stack & Google Apps Script Architect

---

### 1. Executive Summary

This audit assesses the initial workspace against the complete 19-page blueprint specification for the **Smart Restaurant Management and Customer Queue Optimization System**. 

The system is a dedicated **dine-in restaurant platform** consisting of:
- **Five independent web interfaces**: Main Website, Customer Website, Staff Website, Kitchen Website, and Admin Website.
- **One centralized Google Apps Script (V8) modular backend** (`Code.gs` coordinator with 20+ specialized service modules).
- **One shared Google Spreadsheet database** containing exactly **12 tabs and 108 defined columns**.
- **Cryptographically secure authentication**: Customer Email OTP (HMAC-SHA256, 5-minute expiry, 60s cooldown, max 3 attempts) and Staff/Admin/Kitchen username/email + password (PBKDF2-HMAC-SHA256 with unique per-user salt and server sessions).
- **Hardened operational workflows**: 10-minute arrival grace, 15-minute staff verification window, 90-minute dining + 15-minute cleaning (105-minute blocking window), FIFO capacity-fit queue optimization, staff-authorized kitchen preparation, duplicate bill prevention, manual UPI verification, and owner/admin-approved refund management.

---

### 2. Workspace & Environment Audit

| File / Component | Initial State | Assessment | Action Required |
|---|---|---|---|
| `package.json` | React 19, Tailwind CSS v4, Vite 8, Express 4, Motion, tsx, Lucide icons | Fully provisioned for Vite SPA, local execution, and Node test runner (`node:test` via `tsx`). | Maintain setup; run unit tests and browser tests locally. |
| `index.html` | Starter HTML template | Updated metadata and title to match blueprint specification. | Integrate design palette `#FFF8F3`, typography, and responsive meta tags. |
| `metadata.json` | Blank placeholders | Updated with app title, description, and permissions. | Compliant. |
| `src/App.tsx` | Empty placeholder component | Needs full 5-website multi-view runtime with role switcher, reactive state, and live backend connection. | Implement complete client-side shells and full interactive workflows for all 5 roles. |
| `src/index.css` | Tailwind v4 import | Raw starter | Define CSS custom tokens: `#FFF8F3` (warm bg), `#650B20` (burgundy primary), `#D9AA49` (mustard secondary), `#292323` (charcoal text), `#E8D8C8` (soft beige surfaces). |
| Apps Script Backend | Not yet implemented | Empty | Implement complete modular Apps Script backend files ready for live deployment and local simulator. |
| Database Adapter | Not yet implemented | Empty | Implement `DatabaseSchema.js`, `Database.js`, `DatabaseSetup.js`, and `MockDatabase.js` with exact 12 tabs and 108 columns. |

---

### 3. Blueprint Specification Analysis

#### 3.1 Technology Constraints (Section 1 & 2)
- **Frontend**: HTML, CSS, JavaScript (English UI only; no Tamil Unicode; responsive desktop, tablet, mobile).
- **Backend**: Google Apps Script V8 runtime.
- **Database**: Single Google Spreadsheet, exactly 12 tabs, 108 columns. No Firebase, Supabase, MySQL, MongoDB, or external database.
- **Delivery & Integrations**: Google Apps Script `MailApp` for OTP; manual UPI for payments (no payment gateways).
- **Security Boundaries**: Server-side role enforcement, server-calculated prices, no sensitive hashes or session tokens exposed to client.

#### 3.2 Five Separate Websites (Section 3)
1. **Main Website (Public)**: Restaurant overview, ambiance/highlights, menu showcase with search/filter, hours/contact, "Book a Table" link to Customer portal.
2. **Customer Website**:
   - Mobile lookup & email OTP verification (returning customer detection & profile update).
   - Booking creation (`Visit_Type`: `Online` or `Walk-in`).
   - Table reservation (party size, slot selection, capacity verification).
   - Menu browsing, category filtering, cart, order submission.
   - "I'm Arrived" arrival confirmation button (10-minute grace window).
   - Queue position indicator and call status.
   - Live order preparation tracker.
   - Bill view, UPI payment QR and UTR reference submission.
   - Visit history and 1–5 star rating with optional comment.
3. **Staff Website**:
   - Live operational dashboard: upcoming bookings, arrivals, walk-in queue, table layout.
   - Arrival verification (within 15-minute window).
   - Table allocation with double-allocation prevention and called-table protection.
   - Seating confirmation (updates physical status to `Occupied`).
   - Order authorization for kitchen preparation.
   - Extra item additions and item status management.
   - Bill generation and duplicate prevention.
   - Manual UPI payment verification (checking bank receipt vs UTR).
   - Customer departure and table turnover (15-min cleaning lock).
   - Refund request initiation.
4. **Kitchen Website**:
   - Real-time kitchen display showing only staff-authorized orders.
   - Order & item preparation details (prep time, special instructions).
   - Preparation state transitions (`Authorized` → `In_Preparation` → `Ready_For_Serving` → `Served`).
   - Full status history logging (`Order_Status_History`).
   - Strict capability boundary: NO table management, NO arrival verification, NO billing/payments.
5. **Admin Website**:
   - Executive dashboard (metrics: bookings, online vs walk-in, revenue, unverified vs verified UPI, refunds, table utilization).
   - User & staff account management (Staff/Kitchen provisioning, password reset, account status toggle).
   - Menu management (CRUD items, prices, categories, availability toggle).
   - Table management (table numbers, seating capacities, maintenance status).
   - Bookings and reservations oversight.
   - Refund management (approve/reject requests with reason and manual refund reference tracking).
   - Restaurant settings and operational controls.

#### 3.3 Database Audit: Exactly 12 Tabs & 108 Columns (Section 6)
All 12 tabs verified against specification:
1. `Customers` (10 cols): `Customer_ID`, `Customer_Name`, `Mobile_Number`, `Email`, `Created_At`, `OTP_Hash`, `OTP_Expiry`, `OTP_Attempts`, `OTP_Last_Sent_At`, `OTP_Session_ID`
2. `Bookings` (14 cols): `Booking_ID`, `Customer_ID`, `Visit_Type`, `Booking_Date`, `Reservation_Date`, `Reservation_Time`, `Booking_Status`, `Party_Size`, `Queue_Status`, `Queue_Joined_At`, `Status_History_JSON`, `Feedback_Rating`, `Feedback_Comment`, `Feedback_Submitted_At`
3. `Tables` (4 cols): `Table_ID`, `Table_Number`, `Seating_Capacity`, `Table_Status`
4. `Table_Reservations` (7 cols): `Reservation_ID`, `Booking_ID`, `Table_ID`, `Reservation_DateTime`, `Grace_Deadline`, `Arrival_Status`, `Reservation_Status`
5. `Menu` (9 cols): `Food_ID`, `Food_Name`, `Category`, `Description`, `Price`, `Image_URL`, `Availability`, `Prep_Time_Minutes`, `Is_Active`
6. `Orders` (6 cols): `Order_ID`, `Booking_ID`, `Order_DateTime`, `Order_Status`, `Authorized_At`, `Authorized_By`
7. `Order_Items` (10 cols): `Order_Item_ID`, `Order_ID`, `Food_ID`, `Quantity`, `Unit_Price`, `Subtotal`, `Item_Status`, `Cancellation_Reason`, `Replacement_Food_ID`, `Price_Difference`
8. `Bills` (10 cols): `Bill_ID`, `Booking_ID`, `Bill_DateTime`, `Subtotal`, `Tax_Amount`, `Discount`, `Grand_Total`, `Payment_Status`, `Discount_Reason`, `Adjustments_JSON`
9. `Payments` (22 cols): `Payment_ID`, `Bill_ID`, `Payment_DateTime`, `Payment_Method`, `Amount_Paid`, `Payment_Status`, `Transaction_Type`, `Transaction_Reference`, `Received_By`, `Related_Payment_ID`, `Refund_Status`, `Requested_Amount`, `Completed_Refund_Amount`, `Refund_Reason`, `Rejection_Reason`, `Requested_By`, `Requested_At`, `Reviewed_By`, `Reviewed_At`, `Completed_By`, `Completed_At`, `Refund_Reference`
10. `Users` (8 cols): `User_ID`, `User_Name`, `Email`, `Role`, `Account_Status`, `Password_Hash`, `Salt`, `Active_Sessions_JSON`
11. `Restaurant_Settings` (2 cols): `Setting_Key`, `Setting_Value`
12. `Order_Status_History` (6 cols): `History_ID`, `Order_ID`, `Order_Status`, `Changed_At`, `Changed_By`, `Change_Reason`

**Total columns count:** 10 + 14 + 4 + 7 + 9 + 6 + 10 + 10 + 22 + 8 + 2 + 6 = **108 columns**. Exactly matches specification.

---

### 4. Implementation Strategy

To satisfy all blueprint requirements within the local development and preview environment:
1. **Apps Script Backend Modules**: Write pristine, production-ready `.gs`/`.js` files mirroring the required folder structure (`/gas/` or `/backend/`) so the owner can copy-paste or clasp-push them directly to Google Apps Script.
2. **Deterministic Shared Engine (`MockDatabase.ts` / `GasEngine.ts`)**: Implement an in-memory Google Sheets V8 emulation layer using standard Node crypto (HMAC-SHA256, PBKDF2) and the exact 12-sheet/108-column schema.
3. **Five Role-Specific Websites**: Build a rich, highly polished, responsive interface supporting all 5 websites, seamless role-switching for verification, real-time reactive updates, and complete business flows.
4. **End-to-End Test Suite**: Write automated tests covering customer registration, OTP, password hashing, session management, booking, capacity-fit queue, table allocation, order authorization, billing, manual UPI, refunds, and schema verification.
