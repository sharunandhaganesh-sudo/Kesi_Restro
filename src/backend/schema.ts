/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Exact Database Schema: 12 Tabs and 108 Columns
 * Source of truth: Blueprint Section 6
 */

export interface SheetDefinition {
  name: string;
  columns: readonly string[];
  description: string;
}

export const DATABASE_SCHEMA: Record<string, SheetDefinition> = {
  Customers: {
    name: 'Customers',
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
      'OTP_Session_ID',
    ] as const,
    description: 'Registered customer profiles and OTP authentication state (10 columns)',
  },
  Bookings: {
    name: 'Bookings',
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
      'Feedback_Submitted_At',
    ] as const,
    description: 'Every customer visit lifecycle, online or walk-in, plus feedback (14 columns)',
  },
  Tables: {
    name: 'Tables',
    columns: [
      'Table_ID',
      'Table_Number',
      'Seating_Capacity',
      'Table_Status',
    ] as const,
    description: 'Physical restaurant tables. Status: Available, Occupied, Unavailable (4 columns)',
  },
  Table_Reservations: {
    name: 'Table_Reservations',
    columns: [
      'Reservation_ID',
      'Booking_ID',
      'Table_ID',
      'Reservation_DateTime',
      'Grace_Deadline',
      'Arrival_Status',
      'Reservation_Status',
    ] as const,
    description: 'Reserved table mappings, grace deadlines, arrival status (7 columns)',
  },
  Menu: {
    name: 'Menu',
    columns: [
      'Food_ID',
      'Food_Name',
      'Category',
      'Description',
      'Price',
      'Image_URL',
      'Availability',
      'Prep_Time_Minutes',
      'Is_Active',
    ] as const,
    description: 'Authoritative food catalog, pricing and availability (9 columns)',
  },
  Orders: {
    name: 'Orders',
    columns: [
      'Order_ID',
      'Booking_ID',
      'Order_DateTime',
      'Order_Status',
      'Authorized_At',
      'Authorized_By',
    ] as const,
    description: 'Customer orders and staff authorization timestamps (6 columns)',
  },
  Order_Items: {
    name: 'Order_Items',
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
      'Price_Difference',
    ] as const,
    description: 'Line items with frozen unit prices and adjustment states (10 columns)',
  },
  Bills: {
    name: 'Bills',
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
      'Adjustments_JSON',
    ] as const,
    description: 'Exactly one final bill per Booking_ID with server calculations (10 columns)',
  },
  Payments: {
    name: 'Payments',
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
      'Refund_Reference',
    ] as const,
    description: 'Manual UPI transactions, staff verification, and refund audit trail (22 columns)',
  },
  Users: {
    name: 'Users',
    columns: [
      'User_ID',
      'User_Name',
      'Email',
      'Role',
      'Account_Status',
      'Password_Hash',
      'Salt',
      'Active_Sessions_JSON',
    ] as const,
    description: 'Staff, Admin, and Kitchen accounts with PBKDF2 hashes & salts (8 columns)',
  },
  Restaurant_Settings: {
    name: 'Restaurant_Settings',
    columns: [
      'Setting_Key',
      'Setting_Value',
    ] as const,
    description: 'Operational key-value settings like tax rate, opening hours (2 columns)',
  },
  Order_Status_History: {
    name: 'Order_Status_History',
    columns: [
      'History_ID',
      'Order_ID',
      'Order_Status',
      'Changed_At',
      'Changed_By',
      'Change_Reason',
    ] as const,
    description: 'Audit log of all order status changes with actor and reason (6 columns)',
  },
};

/**
 * Validates that any given sheet data matches the exact schema
 */
export function verifySchemaIntegrity(
  sheetHeaders: Record<string, string[]>
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const expectedSheetNames = Object.keys(DATABASE_SCHEMA);

  for (const sheetName of expectedSheetNames) {
    if (!sheetHeaders[sheetName]) {
      errors.push(`Missing required sheet: ${sheetName}`);
      continue;
    }
    const expectedCols = DATABASE_SCHEMA[sheetName].columns;
    const actualCols = sheetHeaders[sheetName];

    if (actualCols.length !== expectedCols.length) {
      errors.push(
        `Sheet ${sheetName} column count mismatch: expected ${expectedCols.length}, got ${actualCols.length}`
      );
    }

    for (let i = 0; i < expectedCols.length; i++) {
      if (actualCols[i] !== expectedCols[i]) {
        errors.push(
          `Sheet ${sheetName} column ${i + 1} mismatch: expected '${expectedCols[i]}', got '${actualCols[i]}'`
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export const TOTAL_COLUMNS_COUNT = Object.values(DATABASE_SCHEMA).reduce(
  (sum, s) => sum + s.columns.length,
  0
); // 108
