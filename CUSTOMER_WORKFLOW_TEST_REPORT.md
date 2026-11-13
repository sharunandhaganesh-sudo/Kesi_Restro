# Customer Workflow Test Report — Treat & Taste

**Test Scope**: Part 1 (Registration, Login, Persistent Session, Customer Dashboard), Part 2 (Arrival Confirmation), Part 3 (Add Extra Items After Ordering), Part 6 (Online & Walk-In Journeys, Single Feedback in Bookings)  
**Execution Timestamp**: `2026-11-12T15:58:12Z` (Local: `21:28:12 IST`)  
**Engine**: Automated Node.js Test Runner (`tsx src/backend/system.test.ts`), Headless Chrome CDP, and Google Apps Script Live API

---

## 1. Test Execution Summary

| Test Case | Blueprint / Prompt Ref | Status | Actual Observed Evidence |
|---|---|---|---|
| **CW-01**: First-Time Registration Validation | Part 1.1, PDF §7.1 | **COMPLETED AND VERIFIED** | Requires only Name, 10-digit Mobile & Email. Enforces format, non-empty name, and rejects duplicate email (`Test 19`: duplicate email returns `success: false`, `code: DUPLICATE_EMAIL`). |
| **CW-02**: Email OTP Verification & Limits | Part 1.1, PDF §7.1 | **COMPLETED AND VERIFIED** | Generates 6-digit OTP, expires in 5 min, blocks after 3 failed attempts, enforces 60-second cooldown, invalidates old OTPs (`Tests 3, 3b, 4`). |
| **CW-03**: Persistent Trusted Customer Session | Part 1.2, PDF §7.1 | **COMPLETED AND VERIFIED** | Established after OTP verification, encoded with 24h sliding expiry (`CUSTOMER_SESSION_HOURS`), stored in `localStorage` (`treat_taste_trusted_session_v1`), survives page reloads and browser restart via `validateSession` (`Test 19` + Browser UI Audit). |
| **CW-04**: Logout Session Revocation | Part 1.2, PDF §7.2 | **COMPLETED AND VERIFIED** | Calling `logout` invalidates the server-side session and clears `localStorage` token (`Test 19`). Old token fails `validateSession` immediately. |
| **CW-05**: Customer Dashboard & Profile Edit | Part 1.3, PDF §8 | **COMPLETED AND VERIFIED** | Displays Customer Name, mobile, email, Customer ID, active visit, order history, and feedback history. Supports inline profile editing with email duplicate checks (`Test 19` + `CustomerWebsite.tsx`). |
| **CW-06**: Online Booking & Reservation | Part 2, PDF §8 | **COMPLETED AND VERIFIED** | Creates unique `Booking_ID` (`BK-YYYYMMDD-XXXX`), sets `Visit_Type: Online`, checks 105-minute blocking window, assigns `Table_Reservations` with 10-minute grace deadline (`Tests 6, 8, 16`). |
| **CW-07**: "I'm Arrived" Arrival Confirmation | Part 2, PDF §8, §10.2 | **COMPLETED AND VERIFIED** | Concurrency-locked (`arrival_<Booking_ID>`). Checks customer ownership; validates 10-min grace deadline. If on time, marks `Arrival_Status: Arrived` in `Table_Reservations` & `Bookings`. If late, records `No_Show` and releases reservation allocation without modifying physically occupied tables (`Test 16` + `ReservationService.ts`). |
| **CW-08**: Customer First Order Placement | Part 3, PDF §11.1–11.2 | **COMPLETED AND VERIFIED** | Fetches prices from `Menu`, rejects browser-supplied prices, creates `Orders` in `Submitted` status (`Item_Status: Pending_Authorization`). Not shown in Kitchen until staff authorizes (`Tests 8, 16`). |
| **CW-09**: Customer "Add More Items" to Active Visit | Part 3, PDF §12 | **COMPLETED AND VERIFIED** | Allows customer to return to their active visit, open "+ Add More Items", select new dishes and quantities, and submit subsequent orders under the same `Booking_ID`. Separate `Order_ID`s are tracked independently (`Test 17`). |
| **CW-10**: Walk-In QR Scan & Queue Join | Part 6.F, PDF §9 | **COMPLETED AND VERIFIED** | QR token identifies table/source without auto-allocating. Customer joins FIFO queue with dynamic position and capacity-fit matching (`Tests 7, 13, 15`). |
| **CW-11**: Single Feedback Stored in Bookings | Part 6.C, PDF §14.1 | **COMPLETED AND VERIFIED** | Only allowed after order is `Served` or visit is `Completed`. Validates ownership; prevents duplicate submissions; saves to `Bookings.Feedback_Rating`, `Feedback_Comment`, `Feedback_Submitted_At` (`Tests 12, 18`). |
