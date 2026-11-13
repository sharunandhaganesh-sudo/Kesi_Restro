# Implementation Gap Report — Treat & Taste

**Blueprint**: `Smart_Restaurant_Management_System_Complete_End_to_End_Blueprint_v3.pdf` (19 pages)  
**Audit Date**: `2026-11-12`

## Executive Summary of Critical Gaps Found

1. **Returning Customer Persistent Trusted Session Missing (Part 1.2)**
   - `src/App.tsx` stores `session` only in React `useState`, causing complete session loss on browser refresh, tab close, or browser restart.
   - `AuthService.ts` / `gas/Code.gs` do not persist session expiry metadata or restore a trusted customer session via `validateSession` on reload, forcing returning customers to repeat Email OTP on the same trusted device.
   - `AuthService.requestCustomerOTP` only checks `Mobile_Number` uniqueness on registration, not `Email` uniqueness (PDF / Part 1.1 requires no duplicate customer accounts for the same mobile or email).

2. **Customer Profile Edit & Full History Incomplete (Part 1.3)**
   - No `updateCustomerProfile` backend action or UI edit form for Customer Name / Email with uniqueness validation.
   - Customer Dashboard lacks a complete, unified view of previous `Booking_ID`s with their associated `Order_ID`s, itemized food lines, bills, payment statuses, and `Bookings`-based feedback history.

3. **Customer Arrival Confirmation ("I'm Arrived") Broken in Live Mode (Part 2)**
   - `RequestDispatcher.dispatch('confirmArrival')` updates only local `mockDb` (`ReservationService.customerConfirmArrival`) and **never calls `GasAdapter.execute('confirmArrival', ...)`** and **never checks `booking.Customer_ID === customerId`**.
   - `gas/Code.gs` `handleCreateBooking` erroneously sets `Booking_Status = "Seated"` whenever `tableId` is passed on booking creation, and sets `Grace_Deadline = Date.now() + 10 min` instead of `scheduledReservationTime + 10 min` for future reservations.
   - `gas/Code.gs` `handleConfirmArrival` skips `LockService`, skips ownership validation, and skips the 10-minute grace deadline expiry (`No_Show` / `Expired`) check.
   - `gas/Code.gs` `handleAllocateTable` only sets `Table_Status: "Available"` without creating a `Table_Reservations` record, checking 105-min blocking, or protecting called tables.

4. **Order Authorization Bypassed (Part 3, 4.3, 5, 6.I, 11.2)**
   - `OrderService.createOrder()` and `gas/Code.gs` `handlePlaceOrder()` currently set `Order_Status: "New_Order"` and `Authorized_By: "Direct Customer Order"` immediately upon customer submission, bypassing Staff authorization and sending unauthorized customer orders straight to Kitchen.
   - PDF Section 11.2 & Part 4.3 strictly require: Customer order submission (`Submitted` / `Pending_Authorization`) and Staff authorization (`Authorized`) are **separate events**; Kitchen must **only** display authorized orders.

5. **Customer "Add More Items" & Staff Order Creation / Item Changes (Part 3 & 4)**
   - Customer Website hides or lacks a dedicated, friction-free **"Add More Items"** workflow during an active visit that creates additional `Order_ID`s under the same `Booking_ID` (awaiting staff authorization).
   - Staff Website lacks full **Add Items to Existing Visit**, **Create Order for Active Booking**, **Independent Order Authorization per Order_ID**, and **Item Quantity/Cancel/Replace with `Cancellation_Reason` & server-calculated `Price_Difference`** controls.

6. **Database Schema Conflict: Separate `Feedback` Tab vs. 12-Tab / 108-Column Spec (Part 6.C & 14.1)**
   - `src/backend/schema.ts` added `FEEDBACK_SHEET_DEFINITION` (13th tab) and `gas/Code.gs` created `Feedback` sheet (`ensureFeedbackSheet_()`), violating the PDF's strict **12 tabs / 108 columns** rule requiring feedback to live in `Bookings.Feedback_Rating`, `Bookings.Feedback_Comment`, and `Bookings.Feedback_Submitted_At`.
   - `verifySchemaIntegrity()` in `src/backend/schema.ts` checks for missing sheets/columns but does **not** flag extra unexpected tabs (PDF 18.2 #18).

7. **Google Apps Script Monolith & Missing Retry Resilience**
   - `gas/Code.gs` (1,536 lines) contains business logic inline instead of delegating to modular `.js` service files (PDF Section 4.2).
   - `src/backend/gasAdapter.ts` has no retry/backoff on transient `script.google.com` network failures.

8. **Decision Log Gaps (Part 7)**
   - `DECISION_LOG.md` was missing Item #11 (`Refund time policy`), had outdated `"Savor Restaurant"` text in Item #9, and invented a `50% waste cost` cancellation charge in Item #7 instead of flagging it as an open owner decision.
