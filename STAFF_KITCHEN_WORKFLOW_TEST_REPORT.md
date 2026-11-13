# Staff & Kitchen Workflow Test Report — Treat & Taste

**Test Scope**: Part 4 (Staff Add Items, Create Order, Authorization, Cancellations/Replacements), Part 5 (Staff & Kitchen Synchronization, KDS Lifecycle), Part 6 (Table Allocation, 105-Min Blocking Window, Billing, UPI Payments, Refunds)  
**Execution Timestamp**: `2026-11-12T15:58:12Z` (Local: `21:28:12 IST`)  
**Engine**: Automated Node.js Test Runner (`tsx src/backend/system.test.ts`), Headless Chrome CDP, and Google Apps Script Live API

---

## 1. Test Execution Summary

| Test Case | Blueprint / Prompt Ref | Status | Actual Observed Evidence |
|---|---|---|---|
| **SK-01**: Staff Arrival Verification & Call Protection | Part 2, PDF §10.3 | **COMPLETED AND VERIFIED** | Staff verifies customer arrival within 15 minutes (`Arrival_Status: Verified`). Staff call protects table from being double-allocated until seated or expired (`Tests 6, 8, 16`). |
| **SK-02**: Seating Updates Physical Table State | Part 2, PDF §10.1 | **COMPLETED AND VERIFIED** | `Tables.Table_Status` transitions to `Occupied` ONLY upon actual seating. `Reserved` is never stored in `Table_Status` (`Tests 6, 11`). |
| **SK-03**: Staff Authorization Gate for Kitchen Orders | Part 4.3, PDF §11.2 | **COMPLETED AND VERIFIED** | Unauthorized orders (`Submitted` / `Pending_Authorization`) are strictly hidden from Kitchen Display. Online orders can only be authorized after arrival verification; walk-in orders after seating (`Tests 8, 16`). |
| **SK-04**: Staff Creates Order for Customer | Part 4.2, PDF §11.2 | **COMPLETED AND VERIFIED** | Staff selects active booking, adds items from current menu, verifies prices and subtotal, and creates `Orders` record linked to the customer's existing `Booking_ID` without duplicate bookings (`Test 17` + `StaffWebsite.tsx`). |
| **SK-05**: Staff Adds Extra Items to Existing Visit | Part 4.1, PDF §12 | **COMPLETED AND VERIFIED** | Staff adds extra food items to an existing customer visit. Each batch forms an independent `Order_ID` linked to the same `Booking_ID`, awaiting independent authorization (`Test 17`). |
| **SK-06**: Pre-Authorization Item Quantity Adjustments | Part 4.4, PDF §12 | **COMPLETED AND VERIFIED** | Staff can increase or decrease quantities on `Pending_Authorization` order items. Subtotal and audit history are updated automatically (`Test 16`: item quantity updated to 3, subtotal recomputed from authoritative unit price). |
| **SK-07**: Item Cancellation & Replacement Handling | Part 4.4, PDF §12, §20 (#7) | **COMPLETED AND VERIFIED** | Items cannot be silently erased. Mandatory cancellation reason is recorded. Replacing an item recalculates price difference on the server. Prepared/cooking items are blocked from cancellation unless owner policy is configured (`OrderService.ts`, `DECISION_LOG #7`). |
| **SK-08**: Kitchen Display Status Progression | Part 5, PDF §11.3 | **COMPLETED AND VERIFIED** | Kitchen receives authorized tickets with table number, guest name, itemized food lines, quantities, and special cooking instructions. Tickets progress `Accepted → Preparing → Ready → Served` with automatic per-item status synchronization (`Test 16`). |
| **SK-09**: Deduplicated Kitchen Tickets | Part 5, PDF §11.3 | **COMPLETED AND VERIFIED** | Kitchen queue deduplicates tickets by `Order_ID` across polling intervals (`KitchenService.getKitchenQueue` + `KitchenWebsite.tsx`). |
| **SK-10**: Single Final Bill Aggregating All Orders | Part 3, PDF §13.1 | **COMPLETED AND VERIFIED** | Exactly one final `Bill_ID` per `Booking_ID`. Includes all accepted original, extra, and staff-created orders. Idempotent and locked against duplicate bills (`Test 17`: aggregates all 3 orders to ₹1560 subtotal). |
| **SK-11**: Manual UPI Payment Verification | Part 6.J, PDF §13.2 | **COMPLETED AND VERIFIED** | Customer-entered UTR is set to `Pending_Verification`. Payment is marked `Paid` ONLY when staff confirms actual bank receipt outside the system. Fake/duplicate UTRs cannot mark bills as paid (`Test 10`). |
| **SK-12**: Staff Refund Request & Admin Approval | Part 6.K, PDF §13.3 | **COMPLETED AND VERIFIED** | Staff initiates full or partial refund request; Admin approves or rejects with reason; staff records manual payout reference. Original payment record remains immutable (`Test 10`). |
| **SK-13**: Customer Departure & Table Sanitization | Part 6.G, PDF §13.4 | **COMPLETED AND VERIFIED** | Departure requires verified paid bill. Releases physical table back to `Available` with 15-minute cleaning allowance (`Test 11`). |
