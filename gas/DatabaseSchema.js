/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * DatabaseSchema.js - Single source of truth for the 12 tabs and 108 columns
 * Compatible with Google Apps Script V8 runtime
 */

var DATABASE_SCHEMA = {
  Customers: {
    columns: [
      'Customer_ID',
      'Customer_Name',
      'Mobile_Number',
      'Email',
      'Created_At',
      'OTP_Hash',
      'OTP_Expiry',
      'OTP_Attempts',
      'OTP_Last_Sent_At',
      'OTP_Session_ID'
    ]
  },
  Bookings: {
    columns: [
      'Booking_ID',
      'Customer_ID',
      'Visit_Type',
      'Booking_Date',
      'Reservation_Date',
      'Reservation_Time',
      'Booking_Status',
      'Party_Size',
      'Queue_Status',
      'Queue_Joined_At',
      'Status_History_JSON',
      'Feedback_Rating',
      'Feedback_Comment',
      'Feedback_Submitted_At'
    ]
  },
  Tables: {
    columns: [
      'Table_ID',
      'Table_Number',
      'Seating_Capacity',
      'Table_Status'
    ]
  },
  Table_Reservations: {
    columns: [
      'Reservation_ID',
      'Booking_ID',
      'Table_ID',
      'Reservation_DateTime',
      'Grace_Deadline',
      'Arrival_Status',
      'Reservation_Status'
    ]
  },
  Menu: {
    columns: [
      'Food_ID',
      'Food_Name',
      'Category',
      'Description',
      'Price',
      'Image_URL',
      'Availability',
      'Prep_Time_Minutes',
      'Is_Active'
    ]
  },
  Orders: {
    columns: [
      'Order_ID',
      'Booking_ID',
      'Order_DateTime',
      'Order_Status',
      'Authorized_At',
      'Authorized_By'
    ]
  },
  Order_Items: {
    columns: [
      'Order_Item_ID',
      'Order_ID',
      'Food_ID',
      'Quantity',
      'Unit_Price',
      'Subtotal',
      'Item_Status',
      'Cancellation_Reason',
      'Replacement_Food_ID',
      'Price_Difference'
    ]
  },
  Bills: {
    columns: [
      'Bill_ID',
      'Booking_ID',
      'Bill_DateTime',
      'Subtotal',
      'Tax_Amount',
      'Discount',
      'Grand_Total',
      'Payment_Status',
      'Discount_Reason',
      'Adjustments_JSON'
    ]
  },
  Payments: {
    columns: [
      'Payment_ID',
      'Bill_ID',
      'Payment_DateTime',
      'Payment_Method',
      'Amount_Paid',
      'Payment_Status',
      'Transaction_Type',
      'Transaction_Reference',
      'Received_By',
      'Related_Payment_ID',
      'Refund_Status',
      'Requested_Amount',
      'Completed_Refund_Amount',
      'Refund_Reason',
      'Rejection_Reason',
      'Requested_By',
      'Requested_At',
      'Reviewed_By',
      'Reviewed_At',
      'Completed_By',
      'Completed_At',
      'Refund_Reference'
    ]
  },
  Users: {
    columns: [
      'User_ID',
      'User_Name',
      'Email',
      'Role',
      'Account_Status',
      'Password_Hash',
      'Salt',
      'Active_Sessions_JSON'
    ]
  },
  Restaurant_Settings: {
    columns: [
      'Setting_Key',
      'Setting_Value'
    ]
  },
  Order_Status_History: {
    columns: [
      'History_ID',
      'Order_ID',
      'Order_Status',
      'Changed_At',
      'Changed_By',
      'Change_Reason'
    ]
  }
};

/**
 * Returns total column count across all 12 sheets (exactly 108)
 */
function getTotalColumnsCount() {
  var total = 0;
  for (var key in DATABASE_SCHEMA) {
    total += DATABASE_SCHEMA[key].columns.length;
  }
  return total;
}
