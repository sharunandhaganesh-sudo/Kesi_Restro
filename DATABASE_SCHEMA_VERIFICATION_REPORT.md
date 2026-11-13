# Database Schema Verification Report — Treat & Taste

**Specification Authority**: `Smart_Restaurant_Management_System_Complete_End_to_End_Blueprint_v3.pdf` (Section 6 & 14.1)  
**Schema Definition**: Exactly **12 Tabs** and **108 Defined Columns**  
**Verification Date**: `2026-11-12`

---

## 1. Schema Definition Matrix (12 Tabs / 108 Columns)

| # | Sheet / Tab Name | Expected Columns | Actual Columns in Code & Mock | Status |
|---|---|---|---|---|
| 1 | `Customers` | 10 | 10 (`Customer_ID`, `Customer_Name`, `Mobile_Number`, `Email`, `Created_At`, `OTP_Hash`, `OTP_Expiry`, `OTP_Attempts`, `OTP_Last_Sent_At`, `OTP_Session_ID`) | **COMPLETED AND VERIFIED** |
| 2 | `Bookings` | 14 | 14 (`Booking_ID`, `Customer_ID`, `Visit_Type`, `Booking_Date`, `Reservation_Date`, `Reservation_Time`, `Booking_Status`, `Party_Size`, `Queue_Status`, `Queue_Joined_At`, `Status_History_JSON`, `Feedback_Rating`, `Feedback_Comment`, `Feedback_Submitted_At`) | **COMPLETED AND VERIFIED** |
| 3 | `Tables` | 4 | 4 (`Table_ID`, `Table_Number`, `Seating_Capacity`, `Table_Status`) | **COMPLETED AND VERIFIED** |
| 4 | `Table_Reservations` | 7 | 7 (`Reservation_ID`, `Booking_ID`, `Table_ID`, `Reservation_DateTime`, `Grace_Deadline`, `Arrival_Status`, `Reservation_Status`) | **COMPLETED AND VERIFIED** |
| 5 | `Menu` | 9 | 9 (`Food_ID`, `Food_Name`, `Category`, `Description`, `Price`, `Image_URL`, `Availability`, `Prep_Time_Minutes`, `Is_Active`) | **COMPLETED AND VERIFIED** |
| 6 | `Orders` | 6 | 6 (`Order_ID`, `Booking_ID`, `Order_DateTime`, `Order_Status`, `Authorized_At`, `Authorized_By`) | **COMPLETED AND VERIFIED** |
| 7 | `Order_Items` | 10 | 10 (`Order_Item_ID`, `Order_ID`, `Food_ID`, `Quantity`, `Unit_Price`, `Subtotal`, `Item_Status`, `Cancellation_Reason`, `Replacement_Food_ID`, `Price_Difference`) | **COMPLETED AND VERIFIED** |
| 8 | `Bills` | 10 | 10 (`Bill_ID`, `Booking_ID`, `Bill_DateTime`, `Subtotal`, `Tax_Amount`, `Discount`, `Grand_Total`, `Payment_Status`, `Discount_Reason`, `Adjustments_JSON`) | **COMPLETED AND VERIFIED** |
| 9 | `Payments` | 22 | 22 (`Payment_ID`, `Bill_ID`, `Payment_DateTime`, `Payment_Method`, `Amount_Paid`, `Payment_Status`, `Transaction_Type`, `Transaction_Reference`, `Received_By`, `Related_Payment_ID`, `Refund_Status`, `Requested_Amount`, `Completed_Refund_Amount`, `Refund_Reason`, `Rejection_Reason`, `Requested_By`, `Requested_At`, `Reviewed_By`, `Reviewed_At`, `Completed_By`, `Completed_At`, `Refund_Reference`) | **COMPLETED AND VERIFIED** |
| 10 | `Users` | 8 | 8 (`User_ID`, `User_Name`, `Email`, `Role`, `Account_Status`, `Password_Hash`, `Salt`, `Active_Sessions_JSON`) | **COMPLETED AND VERIFIED** |
| 11 | `Restaurant_Settings` | 2 | 2 (`Setting_Key`, `Setting_Value`) | **COMPLETED AND VERIFIED** |
| 12 | `Order_Status_History` | 6 | 6 (`History_ID`, `Order_ID`, `Order_Status`, `Changed_At`, `Changed_By`, `Change_Reason`) | **COMPLETED AND VERIFIED** |
| **TOTAL** | **12 Tabs** | **108 Columns** | **108 Columns** | **PERFECT MATCH** |

---

## 2. Feedback Schema Correction & Tab Migration Policy

- **Requirement**: Blueprint Section 6 states:  
  *“The database contains 12 tabs and 108 columns in total. Do not add a separate Feedback tab; feedback fields are stored in Bookings.”*
- **Action Taken**:
  1. `src/backend/schema.ts` and `src/backend/mockDb.ts` were updated to remove `FEEDBACK_SHEET_DEFINITION` as a 13th tab and now strictly enforce 12 tabs and 108 columns.
  2. `src/backend/schema.ts` `verifySchemaIntegrity()` was enhanced to detect any unexpected extra sheets.
  3. `FeedbackService.ts` and `ReportService.ts` read and write feedback directly to `Bookings.Feedback_Rating`, `Bookings.Feedback_Comment`, and `Bookings.Feedback_Submitted_At`.
  4. Added `migrateLegacyFeedbackTab_()` in `gas/Code.gs` to safely copy any legacy reviews from the temporary `Feedback` tab into their corresponding `Bookings` rows before the tab is retired. No records are deleted blindly.
