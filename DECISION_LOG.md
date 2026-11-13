# Decision Log
## Smart Restaurant Management and Customer Queue Optimization System

**Reference:** Section 20 of `Smart_Restaurant_Management_System_Complete_End_to_End_Blueprint_v3.pdf`  
*“These points were not fully fixed in the retained project requirements. The AI agent must keep them configurable or ask the owner before final implementation. Do not silently invent a business policy.”*

This document outlines all 10 unfinalized areas identified in Section 20, specifying the **configurable baseline implementation** used, the configuration setting key in `Restaurant_Settings` or `Config.js`, and the decision prompt for the restaurant owner.

---

### Non-Negotiable Fixed Baseline Rules (Do Not Change)
As confirmed in the blueprint:
- 10-minute arrival grace period
- 15-minute staff arrival verification window
- 90-minute dining + 15-minute cleaning block (105-minute total blocking window)
- FIFO capacity-fit queue rule
- Manual UPI payment verification with staff confirmation
- Admin-controlled refund approval and rejection

---

### Unresolved Items Log

| # | Topic | Blueprint Note | Baseline Implementation | Configuration Key | Owner Action / Questions |
|---|---|---|---|---|---|
| **1** | **Tax Rules** | Tax rate, whether prices include tax, rounding, and tax breakdown. | **Decision Confirmed by Owner**: Keep tax unconfigured until the owner explicitly provides the approved rate. Remove the hardcoded 5% GST assumption. Do not silently apply any tax rate or generate a final bill using an unapproved tax configuration. Bill finalization is strictly blocked until an approved tax rate is configured in `Restaurant_Settings` (`TAX_RATE_PERCENT`). | `TAX_RATE_PERCENT` (Owner confirmed: Kept unconfigured; bill finalization blocked until provided) | **Owner Decision Approved**: Unconfigured baseline maintained. Bill finalization blocked until approved rate provided. |
| **2** | **Discount Rules** | Who may apply discounts, permitted limits, approval needs, and stacking rules. | Staff can apply up to 10% discount with a mandatory reason; Admin can apply up to 50% discount. Stacking not allowed. | `MAX_STAFF_DISCOUNT_PERCENT` (Default: 10), `MAX_ADMIN_DISCOUNT_PERCENT` (Default: 50) | Confirm maximum discount percentages and whether staff requires admin approval for discounts above 10%. |
| **3** | **Reservation Deposit** | Whether any advance payment/deposit is required. | No deposit required in baseline. Bookings are confirmed upon OTP verification and slot selection. | `REQUIRE_RESERVATION_DEPOSIT` (Default: false) | Confirm if high-demand slots or large parties (e.g. > 6) will require an advance UPI deposit in the future. |
| **4** | **Exact Status Vocabulary** | Finalize allowed booking, reservation, queue, order, item, payment and refund statuses and transitions. | Standardized enum definitions across all services (see vocabulary below). | Internal schema constants | Review and approve the centralized status vocabulary. |
| **5** | **Staff Verification Timeout** | What happens after the 15-minute verification window: alert, retry, cancellation, or escalation. | Flags an alert on the Staff and Admin dashboards as `Verification_Overdue`; does not auto-cancel without staff intervention. | `STAFF_VERIFICATION_TIMEOUT_MINUTES` (Default: 15) | Confirm whether overdue arrivals should trigger automatic cancellation or remain flagged for supervisor action. |
| **6** | **Called-Table Expiry** | How long a table remains protected after Staff calls a customer, and how no-response is handled. | Table remains protected for 5 minutes after Staff calls the customer. If no response, staff can mark as `Call_Unanswered` and re-enter into queue or release. | `CALLED_TABLE_HOLD_MINUTES` (Default: 5) | Confirm preferred grace window for called customers to reach the host station. |
| **7** | **Cancellation Charging Policy** | How to charge for food already prepared or in progress when an item is cancelled. | **Open Decision (Not Invented)**: Items already `In_Preparation` / `Cooking` / `Ready` are blocked from free cancellation unless an owner-configured policy is enabled; no automatic percentage charge is invented. | `ALLOW_PREP_CANCEL` (Default: false), `PREPARED_ITEM_CANCEL_POLICY` (Default: "BLOCK_PENDING_OWNER_POLICY") | Confirm whether items already in preparation/ready may be cancelled and what exact charge/waiver rule applies. |
| **8** | **Session Duration** | Exact expiry duration and idle-session policy for customer and employee sessions. | **Decision Confirmed by Owner**: Approved 24-hour trusted-device customer session with sliding renewal on active interaction. Returning customers do not need OTP again while their trusted session remains valid. Expired or revoked sessions strictly require OTP verification. Only SHA-256 session token hashes are stored server-side. | `CUSTOMER_SESSION_HOURS` (Owner confirmed: 24h with sliding renewal), `STAFF_SESSION_HOURS` (Default: 12) | **Owner Decision Approved**: 24-hour persistent session with sliding renewal confirmed. |
| **9** | **Email Delivery Details** | Approved sender identity, email wording, and deliverability settings. | MailApp sends from the authenticated Google account with branded subject: `Your Treat & Taste Verification Code`. | `EMAIL_SENDER_NAME` (Default: "Treat & Taste") | Confirm approved sender identity/reply-to and email wording. |
| **10** | **Operating Hours & Horizon** | Operating hours, days closed, earliest/latest booking, and advance-booking limit. | Open daily 11:00 AM to 11:00 PM. Reservations allowed from 11:30 AM to 9:30 PM, up to 7 days in advance. | `OPENING_TIME` (Default: "11:00"), `CLOSING_TIME` (Default: "23:00"), `MAX_ADVANCE_DAYS` (Default: 7) | Confirm actual daily operating hours, closed days, and maximum advance booking window. |
| **11** | **Refund Time Policy** | Operational deadline for manual payout and customer communication. | Manual UPI/bank refund payout target is tracked in `Payments` (`Requested_At`, `Reviewed_At`, `Completed_At`); no automatic deadline/SLA penalty is invented. | `REFUND_PAYOUT_SLA_HOURS` (Default: "OWNER_CONFIRM_REQUIRED") | Confirm operational deadline (e.g., 24h / 3–5 business days) for manual refund payout and customer communication. |

---

### Standardized Status Vocabulary (Section 20 - Topic 4)

#### `Bookings.Booking_Status`
- `Confirmed`: Booking created and verified.
- `Arrived`: Customer confirmed digital arrival at the restaurant.
- `Seated`: Customer physically seated at allocated table.
- `Completed`: Meal finished, bill paid, and party departed.
- `Cancelled`: Customer or staff cancelled prior to arrival.
- `No_Show`: Customer failed to arrive within 10-minute grace period.

#### `Table_Reservations.Reservation_Status`
- `Active`: Reserved for an upcoming slot.
- `Claimed`: Customer arrived and verified.
- `Released`: Table released after meal or turnover.
- `Expired`: Grace period elapsed without arrival.
- `Cancelled`: Reservation cancelled.

#### `Tables.Table_Status`
- `Available`: Physically ready for allocation (subject to 105-min blocking).
- `Occupied`: Customers currently seated at the table.
- `Unavailable`: Under maintenance or out of service.
*(Note: Per Section 10.1, `Reserved` is never stored in `Tables.Table_Status`).*

#### `Bookings.Queue_Status`
- `None`: Not currently in walk-in queue.
- `Waiting`: In walk-in queue awaiting table call.
- `Called`: Table ready; customer called to host stand (protected hold).
- `Seated`: Seated from queue.
- `Left`: Customer departed without dining.

#### `Orders.Order_Status`
- `Submitted`: Order placed by customer; awaiting staff authorization.
- `Authorized`: Staff approved order for kitchen preparation.
- `In_Preparation`: Kitchen actively preparing dishes.
- `Ready_For_Serving`: All items prepared; ready for waitstaff pickup.
- `Served`: Delivered to customer table.
- `Cancelled`: Cancelled before preparation.

#### `Order_Items.Item_Status`
- `Pending_Authorization`: Waiting for staff approval.
- `Authorized`: Sent to kitchen.
- `Cooking`: In kitchen prep.
- `Ready`: Cooked and plated.
- `Served`: Delivered to table.
- `Cancelled`: Cancelled with reason.
- `Replaced`: Replaced with another item.

#### `Bills.Payment_Status` & `Payments.Payment_Status`
- `Unpaid`: Bill generated, awaiting payment.
- `Pending_Verification`: Customer submitted UPI UTR reference; awaiting staff bank check.
- `Paid`: Staff confirmed receipt in restaurant bank account.
- `Refund_Requested`: Refund initiated.
- `Refunded`: Refund approved and completed.
- `Failed`: UPI transaction rejected or invalid UTR.

#### `Payments.Refund_Status`
- `None`: No refund requested.
- `Requested`: Staff initiated refund request.
- `Approved`: Admin approved refund.
- `Rejected`: Admin rejected refund with reason.
- `Completed`: Offline manual payment executed and reference recorded.
