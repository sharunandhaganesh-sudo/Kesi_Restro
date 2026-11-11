# Requirements Checklist
## Smart Restaurant Management and Customer Queue Optimization System

**Based on:** `Smart_Restaurant_Management_System_Complete_End_to_End_Blueprint_v3.pdf`  
**Status Key:** [x] Planned & Specified | [ ] Pending Implementation

---

### Section 1: Project Overview & Core Goals
- [x] Dine-in restaurant scope strictly enforced (no food delivery partner/tracking/fees).
- [x] Manual UPI payment flow with staff verification (no external payment gateway required in baseline).
- [x] No external relational or NoSQL database (Postgres, Firebase, Supabase, MongoDB prohibited).
- [x] Pure Google Apps Script (V8) + Google Sheets database architecture.
- [x] Core Principle: Every visit has exactly one `Booking_ID` (Online or Walk-in).
- [x] A visit can contain multiple `Order_ID`s, but has exactly one final `Bill_ID`.
- [x] `Bookings.Visit_Type` is the authoritative source of truth for Online vs Walk-in.

---

### Section 2: Fixed Technology & Architecture
- [x] Frontend: HTML, CSS, JavaScript; 5 separate website interfaces.
- [x] Backend: Google Apps Script (V8 runtime) request coordinator pattern.
- [x] Database: 1 shared Google Spreadsheet with 12 tabs and 108 columns.
- [x] Security: Server-side role authorization, session management, and price verification.
- [x] Local development with deterministic mock database adapter first, live Sheets on integration.

---

### Section 3: Five Separate Websites & Role Boundaries
- [x] **Main Website (Public)**:
  - [x] Restaurant profile, address, operating hours, contact info.
  - [x] Menu highlights and category browsing without requiring sign-in.
  - [x] Prominent "Book a Table" call-to-action directing to Customer portal.
  - [x] Zero exposure of internal staff/admin dashboards or private customer records.
- [x] **Customer Website**:
  - [x] Customer mobile identification & Email OTP verification.
  - [x] Profile view and updates.
  - [x] Table reservation with date/time and party size.
  - [x] Real-time queue view, position tracking, and call status.
  - [x] Digital arrival confirmation ("I'm Arrived" with 10-min countdown).
  - [x] Interactive menu browsing, search, category filters, cart, and order submission.
  - [x] Live order preparation status tracking.
  - [x] Final bill review and manual UPI reference (UTR) submission.
  - [x] Visit history and single feedback submission (1–5 stars + optional comment).
- [x] **Staff Website**:
  - [x] Operational overview: upcoming bookings, arrivals, walk-in queue, table layout.
  - [x] Arrival verification action within 15-minute window.
  - [x] Table allocation and call protection against double-booking.
  - [x] Physical seating action updating table status to `Occupied`.
  - [x] Order authorization before dispatch to kitchen.
  - [x] Extra items and item adjustments/cancellations.
  - [x] Single final bill generation and duplicate prevention.
  - [x] Manual UPI payment verification (reconciling bank receipt with UTR).
  - [x] Customer departure and table turnover with 15-minute cleaning lock.
  - [x] Refund request creation.
- [x] **Kitchen Website**:
  - [x] Dedicated view displaying ONLY staff-authorized orders.
  - [x] Item preparation details, quantities, notes, and timers.
  - [x] Preparation status updates (`Authorized` → `In_Preparation` → `Ready_For_Serving` → `Served`).
  - [x] Audit trail recording in `Order_Status_History`.
  - [x] Strict capability boundaries: cannot modify tables, arrivals, bills, or refunds.
- [x] **Admin Website**:
  - [x] Executive dashboard with operational & financial analytics.
  - [x] User management: staff/kitchen account provisioning, roles, status toggles.
  - [x] Menu management: CRUD items, prices, categories, availability.
  - [x] Table management: table numbering, seating capacities, maintenance toggles.
  - [x] Full bookings and reservations oversight.
  - [x] Refund management: review, approve, or reject refund requests with reason and refund reference.
  - [x] Restaurant settings configuration.

---

### Section 4 & 5: Backend Modular Architecture & Database Connection
- [x] `Code.gs` request dispatcher routing requests to modular services.
- [x] Action whitelisting: never execute arbitrary client-supplied function names.
- [x] `Config.js` & `Config.template.js` configuration management.
- [x] `Database.js` shared `getDatabaseConnection()` helper.
- [x] `isDatabaseConfigured()` and live connection testing.
- [x] Read-only `verifyDatabase()` checking 12 tabs and 108 exact column names.
- [x] Non-destructive `initializeMissingDatabaseTabs()` (never deletes existing data).
- [x] `LockService` concurrency control for table allocation, queue calls, bill generation, and refunds.
- [x] Only approved `ScriptProperties` key: `OTP_HMAC_SECRET` (32 bytes).

---

### Section 6: Exact Database Schema (12 Tabs / 108 Columns)
- [x] `Customers` (10 cols): `Customer_ID`, `Customer_Name`, `Mobile_Number`, `Email`, `Created_At`, `OTP_Hash`, `OTP_Expiry`, `OTP_Attempts`, `OTP_Last_Sent_At`, `OTP_Session_ID`
- [x] `Bookings` (14 cols): `Booking_ID`, `Customer_ID`, `Visit_Type`, `Booking_Date`, `Reservation_Date`, `Reservation_Time`, `Booking_Status`, `Party_Size`, `Queue_Status`, `Queue_Joined_At`, `Status_History_JSON`, `Feedback_Rating`, `Feedback_Comment`, `Feedback_Submitted_At`
- [x] `Tables` (4 cols): `Table_ID`, `Table_Number`, `Seating_Capacity`, `Table_Status`
- [x] `Table_Reservations` (7 cols): `Reservation_ID`, `Booking_ID`, `Table_ID`, `Reservation_DateTime`, `Grace_Deadline`, `Arrival_Status`, `Reservation_Status`
- [x] `Menu` (9 cols): `Food_ID`, `Food_Name`, `Category`, `Description`, `Price`, `Image_URL`, `Availability`, `Prep_Time_Minutes`, `Is_Active`
- [x] `Orders` (6 cols): `Order_ID`, `Booking_ID`, `Order_DateTime`, `Order_Status`, `Authorized_At`, `Authorized_By`
- [x] `Order_Items` (10 cols): `Order_Item_ID`, `Order_ID`, `Food_ID`, `Quantity`, `Unit_Price`, `Subtotal`, `Item_Status`, `Cancellation_Reason`, `Replacement_Food_ID`, `Price_Difference`
- [x] `Bills` (10 cols): `Bill_ID`, `Booking_ID`, `Bill_DateTime`, `Subtotal`, `Tax_Amount`, `Discount`, `Grand_Total`, `Payment_Status`, `Discount_Reason`, `Adjustments_JSON`
- [x] `Payments` (22 cols): `Payment_ID`, `Bill_ID`, `Payment_DateTime`, `Payment_Method`, `Amount_Paid`, `Payment_Status`, `Transaction_Type`, `Transaction_Reference`, `Received_By`, `Related_Payment_ID`, `Refund_Status`, `Requested_Amount`, `Completed_Refund_Amount`, `Refund_Reason`, `Rejection_Reason`, `Requested_By`, `Requested_At`, `Reviewed_By`, `Reviewed_At`, `Completed_By`, `Completed_At`, `Refund_Reference`
- [x] `Users` (8 cols): `User_ID`, `User_Name`, `Email`, `Role`, `Account_Status`, `Password_Hash`, `Salt`, `Active_Sessions_JSON`
- [x] `Restaurant_Settings` (2 cols): `Setting_Key`, `Setting_Value`
- [x] `Order_Status_History` (6 cols): `History_ID`, `Order_ID`, `Order_Status`, `Changed_At`, `Changed_By`, `Change_Reason`

---

### Section 7: Authentication & Access Rules
- [x] Customer: Mobile number as identifier (never proof of identity).
- [x] Customer: 6-digit email OTP (100000–999999).
- [x] Customer: 5-minute expiry, max 3 failed attempts, 60s resend cooldown.
- [x] Customer: HMAC-SHA256 OTP hash storage; new OTP invalidates previous.
- [x] Staff/Admin/Kitchen: Email/username + password login.
- [x] Staff/Admin/Kitchen: PBKDF2-HMAC-SHA256 with unique random salt.
- [x] Staff/Admin/Kitchen: Server-side session tokens in `Active_Sessions_JSON`.
- [x] Disabled accounts blocked immediately from authentication and protected actions.
- [x] Strict customer record ownership enforcement.

---

### Section 8 & 9: Online & Walk-in Customer Journeys
- [x] Online: Reservation selection with 105-minute blocking window.
- [x] Online: 10-minute grace window for "I'm Arrived" confirmation.
- [x] Online: 15-minute staff verification window after arrival.
- [x] Online: Order preparation withheld until staff arrival verification.
- [x] Walk-in: Scan QR (`?source=walkin`), start visit without future reservation barrier.
- [x] Walk-in: Instant table allocation if available, or queue entry if at capacity.
- [x] Walk-in: Dynamic queue position calculation (FIFO + capacity fit).
- [x] Seating action updates `Tables.Table_Status` to `Occupied`.

---

### Section 10: Table Allocation & Capacity-Fit Queue
- [x] `Tables.Table_Status` allowed values: `Available`, `Occupied`, `Unavailable` (no `Reserved` status here; reservation tracked in `Table_Reservations`).
- [x] 105-minute blocking window (90-minute dining + 15-minute turnover).
- [x] Capacity-fit FIFO queue: smaller party can be seated at small table without depriving large party of only suitable table.
- [x] Called table protection: table held during call is locked from concurrent allocation.
- [x] Multi-table allocation support for large parties.

---

### Section 11 & 12: Ordering, Kitchen & Item Lifecycle
- [x] Authoritative menu prices calculated server-side; client prices ignored.
- [x] Accepted price frozen in `Order_Items.Unit_Price`.
- [x] Staff order authorization records `Authorized_At` and `Authorized_By`.
- [x] Kitchen view displays only staff-authorized orders.
- [x] Strict status transitions logged in `Order_Status_History`.
- [x] Extra items added as new orders or items linked to same `Booking_ID`.
- [x] Item cancellations/replacements recorded with reason and price difference.

---

### Section 13 & 14: Billing, Payments, Refunds & Feedback
- [x] Exactly one final bill per `Booking_ID` with duplicate prevention lock.
- [x] Subtotal, Tax, Discount, and Grand Total calculated server-side.
- [x] Manual UPI reference (UTR) capture; stays in `Pending_Verification`.
- [x] Staff verifies actual bank receipt before transitioning payment to `Paid`.
- [x] Full or partial refund requests created by Staff, approved/rejected by Admin.
- [x] Rejection reason and manual payout reference tracked; original payment immutable.
- [x] Table release only after customer departure + 15-minute cleaning allowance.
- [x] Single feedback submission per completed `Booking_ID` (1–5 stars + comment).
- [x] Admin reports: visit counts, online vs walk-in, revenue vs pending, table utilization.

---

### Section 15: UI & Design Requirements
- [x] Palette: `#FFF8F3` (warm bg), `#650B20` (burgundy primary), `#D9AA49` (mustard secondary), `#292323` (charcoal text), `#E8D8C8` (soft beige surfaces).
- [x] No green as primary brand color.
- [x] 100% English UI (no Tamil Unicode in UI).
- [x] Responsive layouts: Desktop, tablet, mobile.
- [x] Loading, empty, success, and error states across all screens.
