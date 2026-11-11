# Implementation Plan
## Smart Restaurant Management and Customer Queue Optimization System

**Blueprint Target:** `Smart_Restaurant_Management_System_Complete_End_to_End_Blueprint_v3.pdf`  
**Execution Order:** Stage 1 to Stage 12 (Strict sequence)

---

### System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           5 WEBSITES (UI)                               │
│  [1. Main Website]      [2. Customer Web]      [3. Staff Web]           │
│  Public Showcase & Info   Mobile OTP, Reserve,   Arrivals, Allocation,  │
│  "Book a Table" CTA       Queue, Menu, Bill      Orders, UPI Verify     │
│                                                                         │
│  [4. Kitchen Web]       [5. Admin Web]         [Website Switcher Bar]   │
│  Authorized Prep Queue,   Executive Reports,     Instant multi-portal   │
│  Stage Status Updates     Menu, Tables, Refunds  testing & simulation   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ JSON Request Envelope
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               CENTRAL REQUEST DISPATCHER (Code.gs)                      │
│  • Whitelisted Action Router        • Session & Ownership Validator     │
│  • Concurrency Locks (LockService) • Safe Standardized Error Boundary   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Modular Services
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      MODULAR BUSINESS SERVICES                          │
│  • AuthService        • PasswordService (PBKDF2) • Authorization        │
│  • CustomerService    • BookingService           • ReservationService   │
│  • QueueService       • TableService             • MenuService          │
│  • OrderService       • KitchenService           • BillingService       │
│  • PaymentService     • RefundService            • HistoryService       │
│  • ReportService      • EmailService (MailApp)   • Validation           │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Shared Database Layer
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               SHARED SPREADSHEET DATABASE (12 Tabs / 108 Cols)          │
│  1. Customers (10)       2. Bookings (14)       3. Tables (4)           │
│  4. Table_Reservations(7)5. Menu (9)            6. Orders (6)           │
│  7. Order_Items (10)     8. Bills (10)          9. Payments (22)        │
│ 10. Users (8)           11. Settings (2)       12. Order_Status_History │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Detailed Stage-by-Stage Plan

#### Stage 1 — Project Foundation
- Create project folder structure separating backend Apps Script files (`/src/backend/` and `/gas/`) and frontend interfaces (`/src/frontend/`).
- Define shared design tokens matching Section 15.1:
  - Background: `#FFF8F3`
  - Primary: `#650B20` (Burgundy)
  - Secondary: `#D9AA49` (Mustard / Gold)
  - Charcoal Text: `#292323`
  - Surfaces: `#E8D8C8`
- Establish the standardized backend request and response envelope contract:
  - Success: `{ "success": true, "data": { ... }, "message": "..." }`
  - Error: `{ "success": false, "error": { "code": "...", "message": "..." } }`

#### Stage 2 — Schema and Mock Database Engine
- Implement `DatabaseSchema.ts`:
  - Tab definitions for all 12 tabs with exact 108 column names in order.
  - Header validation and schema integrity checker.
- Implement `MockDatabase.ts`:
  - Thread-safe in-memory database with sheet rows, column-index mapping, and simulated ACID row locks.
  - Initial seed data fixtures: 6 demo accounts (1 Admin, 1 Staff, 1 Kitchen, 3 Customers), standard tables (T1-T10 with 2, 4, 6, 8 capacities), diverse menu items across categories, and restaurant settings.

#### Stage 3 — Database Connection & Verification Module
- Implement `Database.ts`:
  - `getDatabaseConnection()`, `isDatabaseConfigured()`, and `verifyDatabase()`.
  - Non-destructive `initializeMissingDatabaseTabs()` function that checks tab presence and exact headers without deleting existing data.
  - Google Sheets API bridge configuration for live Google Spreadsheet integration.

#### Stage 4 — Authentication, OTP, Password Hashing & Sessions
- Implement `PasswordService.ts`:
  - PBKDF2-HMAC-SHA256 password hashing with unique per-user cryptographically random salt (16 bytes).
- Implement `EmailService.ts`:
  - Generates 6-digit random OTP (100000–999999).
  - HMAC-SHA256 hash generation using `OTP_HMAC_SECRET`.
  - 5-minute expiry, 60-second resend cooldown, and 3-attempt limit tracking.
  - Simulation of MailApp email delivery with branded HTML template + real Gmail integration hook.
- Implement `AuthService.ts`:
  - Customer OTP request and verification with server session creation.
  - Staff / Admin / Kitchen username/password authentication with account status check (disabled accounts rejected).
  - Session validation, logout, and token expiry.
- Implement `Authorization.ts`:
  - Role-based permissions (`Customer`, `Staff`, `Kitchen`, `Admin`).
  - Customer record ownership validation (customers can only access their own bookings, orders, and bills).

#### Stage 5 — Customer Profiles and Booking Lifecycle
- Implement `CustomerService.ts`:
  - Lookup by mobile number, profile creation/updates, customer visit history.
- Implement `BookingService.ts`:
  - Server-side unique ID generation: `BK-YYYYMMDD-XXXX`.
  - `Visit_Type`: `Online` or `Walk-in`.
  - Party size validation and booking lifecycle state machine (`Confirmed`, `Arrived`, `Seated`, `Completed`, `Cancelled`, `No_Show`).

#### Stage 6 — Reservations, Queue & Table Allocation
- Implement `ReservationService.ts`:
  - Reservation slot validation.
  - 105-minute blocking window (90-min dining + 15-min turnover).
  - 10-minute grace period calculation from reservation time (future) or allocation time (immediate).
  - "I'm Arrived" confirmation and 15-minute staff verification window.
  - Automatic no-show / expiry handling releasing reservation allocation without touching physical table state.
- Implement `QueueService.ts`:
  - FIFO queue ordering by `Queue_Joined_At`.
  - Capacity-fit selection logic: smaller party can be allocated a smaller suitable table while larger parties retain priority for large tables.
- Implement `TableService.ts`:
  - Strict table statuses: `Available`, `Occupied`, `Unavailable` (no `Reserved` status in Tables tab).
  - Atomic table calling and call-protection against double allocation.
  - Physical seating action updating table status to `Occupied`.
  - Multi-table allocation support for large parties.

#### Stage 7 — Menu, Cart, Orders & Kitchen Workflow
- Implement `MenuService.ts`:
  - Category filtering, search, and availability checks.
  - Server-side price authority (ignores browser unit prices).
- Implement `OrderService.ts`:
  - Order creation linked to `Booking_ID`.
  - Multiple orders per booking supported.
  - Freezing unit price into `Order_Items`.
  - Staff authorization prerequisite: online orders authorized after arrival verification; walk-in orders authorized after seating.
  - Recording `Authorized_At` and `Authorized_By`.
- Implement `KitchenService.ts`:
  - Real-time kitchen view filtered strictly to authorized orders.
  - Allowed status transitions: `Authorized` → `In_Preparation` → `Ready_For_Serving` → `Served`.
  - Audit logging to `Order_Status_History`.
  - Enforced isolation: Kitchen cannot access billing, payment, or table allocation.

#### Stage 8 — Extra Items, Adjustments & Billing
- Implement extra item workflow during active dining.
- Cancellation and replacement handling with reason and price difference calculation.
- Implement `BillingService.ts`:
  - Unique final `Bill_ID` per `Booking_ID`.
  - Idempotency and concurrency lock to prevent duplicate bills.
  - Server-side calculation of Subtotal, Tax (e.g., 5% GST), Discount, and Grand Total.
  - Recording `Adjustments_JSON` and `Discount_Reason`.

#### Stage 9 — Manual UPI Payments, Receipt Verification & Refunds
- Implement `PaymentService.ts`:
  - Bill summary presentation with restaurant UPI QR and VPA instructions.
  - Customer UTR reference submission.
  - Initial state: `Pending_Verification` (UTR submission is NOT proof of receipt).
  - Staff verification action: marks payment `Paid` only after external bank check.
- Implement `RefundService.ts`:
  - Full and partial refund requests initiated by Staff with reason.
  - Admin review workflow: Approve or Reject with reason.
  - Offline manual payout tracking with `Refund_Reference`, completion actor, and timestamp.
  - Immutable original payment record with `Related_Payment_ID` linking.
- Implement Departure & Table Turnover:
  - Customer departure confirmation.
  - 15-minute cleaning lock before table becomes `Available`.

#### Stage 10 — Feedback, Reports & Complete UI
- Implement `HistoryService.ts` and feedback submission:
  - 1–5 star rating + optional comment stored directly in `Bookings` (no extra tab).
  - Exactly one feedback submission per completed `Booking_ID`.
- Implement `ReportService.ts`:
  - Daily/weekly visit counts, Online vs Walk-in breakdown, table utilization, item sales, and revenue (separating verified payments from pending UTRs and completed refunds).
- Complete all five responsive web interfaces with full polish, accessible controls, and interactive states.

#### Stage 11 — Google Apps Script Deployable Files
- Package all backend logic into clean, standalone Google Apps Script V8 `.gs`/`.js` files:
  - `Code.gs`, `Config.js`, `Config.template.js`, `DatabaseSchema.js`, `Database.js`, `DatabaseSetup.js`, `AuthService.js`, `PasswordService.js`, `Authorization.js`, `CustomerService.js`, `BookingService.js`, `ReservationService.js`, `QueueService.js`, `TableService.js`, `MenuService.js`, `OrderService.js`, `KitchenService.js`, `BillingService.js`, `PaymentService.js`, `RefundService.js`, `HistoryService.js`, `ReportService.js`, `EmailService.js`, `Validation.js`, `LockHelpers.js`, `Utils.js`.
- Provide step-by-step owner deployment guide for Google Sheets & Apps Script.

#### Stage 12 — Final Verification & Automated Testing
- Unit tests via `tsx --test` verifying:
  - Database schema 12-tab/108-col verifier.
  - Password hashing PBKDF2 with salt.
  - Customer OTP generation, HMAC hashing, expiry, cooldown, and attempt limits.
  - Capacity-fit queue algorithm and FIFO ordering.
  - 105-minute blocking and table double-allocation protection.
  - Server-side billing and tax calculations.
  - Duplicate bill prevention and refund transitions.
- Interactive browser verification of all 5 interfaces and critical customer/staff journeys.
