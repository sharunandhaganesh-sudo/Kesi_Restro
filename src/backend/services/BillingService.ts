/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BillingService: Generates single final bill per Booking_ID, server-side calculations,
 * and duplicate bill prevention.
 */

import { db, SheetRow } from '../mockDb';

export class BillingService {
  /**
   * Generates or fetches the single final bill for a Booking_ID.
   * Guarded against duplicate bills via concurrency lock.
   */
  public static generateFinalBill(params: {
    bookingId: string;
    discountPercent?: number;
    discountReason?: string;
    staffUserName: string;
  }): { success: boolean; message: string; bill?: SheetRow } {
    const lockKey = `bill_gen_${params.bookingId}`;
    if (!db.acquireLock(lockKey)) {
      return { success: false, message: 'Bill calculation already in progress for this booking.' };
    }

    try {
      // 1. Check if a final bill already exists (idempotency rule)
      const existingBill = db.findOne('Bills', (b) => b.Booking_ID === params.bookingId);
      if (existingBill) {
        return {
          success: true,
          message: 'Retrieved existing final bill for this booking.',
          bill: existingBill,
        };
      }

      const booking = db.findOne('Bookings', (b) => b.Booking_ID === params.bookingId);
      if (!booking) {
        return { success: false, message: 'Booking not found.' };
      }

      // 2. Fetch all orders for this booking
      const orders = db.findRows('Orders', (o) => o.Booking_ID === params.bookingId);
      if (orders.length === 0) {
        return { success: false, message: 'Cannot generate bill: No orders found for this visit.' };
      }

      // 3. Aggregate all non-cancelled order items
      const orderIds = orders.map((o) => o.Order_ID);
      const allItems = db.findRows(
        'Order_Items',
        (i) => orderIds.includes(i.Order_ID) && i.Item_Status !== 'Cancelled'
      );

      if (allItems.length === 0) {
        return { success: false, message: 'Cannot generate bill: No active food items to bill.' };
      }

      const subtotal = allItems.reduce((sum, item) => sum + Number(item.Subtotal), 0);

      // 4. Calculate Tax (5% GST standard restaurant rate)
      const taxRateSetting = db.findOne(
        'Restaurant_Settings',
        (s) => s.Setting_Key === 'TAX_RATE_PERCENT'
      );
      const taxRate = Number(taxRateSetting?.Setting_Value || 5) / 100;
      const taxAmount = Math.round(subtotal * taxRate * 100) / 100;

      // 5. Calculate Discount
      const discountPercent = Math.min(50, Math.max(0, Number(params.discountPercent) || 0));
      const discountAmount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;

      // 6. Grand Total
      const grandTotal = Math.max(0, Math.round((subtotal + taxAmount - discountAmount) * 100) / 100);

      const billId = `BILL-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
      const now = new Date().toISOString();

      // Record adjustments details
      const adjustments = [
        {
          subtotal,
          taxRatePercent: taxRate * 100,
          taxAmount,
          discountPercent,
          discountAmount,
          reason: params.discountReason || '',
          generatedBy: params.staffUserName,
        },
      ];

      // Insert Bill row
      // Bill_ID, Booking_ID, Bill_DateTime, Subtotal, Tax_Amount, Discount, Grand_Total, Payment_Status, Discount_Reason, Adjustments_JSON
      const billRow = db.insertRow('Bills', {
        Bill_ID: billId,
        Booking_ID: params.bookingId,
        Bill_DateTime: now,
        Subtotal: subtotal,
        Tax_Amount: taxAmount,
        Discount: discountAmount,
        Grand_Total: grandTotal,
        Payment_Status: 'Unpaid',
        Discount_Reason: params.discountReason || '',
        Adjustments_JSON: JSON.stringify(adjustments),
      });

      return {
        success: true,
        message: `Final bill ${billId} generated successfully.`,
        bill: billRow,
      };
    } finally {
      db.releaseLock(lockKey);
    }
  }

  /**
   * Retrieves final bill details by Booking_ID
   */
  public static getBillByBookingId(bookingId: string) {
    return db.findOne('Bills', (b) => b.Booking_ID === bookingId);
  }
}
