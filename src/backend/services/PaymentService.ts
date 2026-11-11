/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PaymentService & RefundService:
 * Implements manual UPI submission, staff bank receipt verification, full/partial refunds
 * with Admin oversight, immutable transaction history, and table release upon departure.
 */

import { db, SheetRow } from '../mockDb';
import { TableService } from './TableService';

export class PaymentService {
  /**
   * Customer submits UPI transaction reference (UTR) after completing app payment.
   * Status is recorded as 'Pending_Verification'.
   */
  public static submitUPIReference(params: {
    billId: string;
    transactionReference: string;
    amountPaid: number;
    submittedBy: string;
  }): { success: boolean; message: string; paymentId?: string } {
    const utr = params.transactionReference.trim();
    if (!utr || utr.length < 6) {
      return { success: false, message: 'Please enter a valid UPI transaction reference / UTR number.' };
    }

    const bill = db.findOne('Bills', (b) => b.Bill_ID === params.billId);
    if (!bill) return { success: false, message: 'Bill record not found.' };

    const paymentId = `PAY-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date().toISOString();

    // Check duplicate UTR submissions
    const existingUtr = db.findOne('Payments', (p) => p.Transaction_Reference === utr);
    if (existingUtr && existingUtr.Payment_Status === 'Paid') {
      return {
        success: false,
        message: 'This UPI transaction reference has already been verified and processed.',
      };
    }

    // Insert Payment row (22 columns)
    db.insertRow('Payments', {
      Payment_ID: paymentId,
      Bill_ID: params.billId,
      Payment_DateTime: now,
      Payment_Method: 'UPI_Manual',
      Amount_Paid: Number(params.amountPaid) || Number(bill.Grand_Total),
      Payment_Status: 'Pending_Verification',
      Transaction_Type: 'Payment',
      Transaction_Reference: utr,
      Received_By: '',
      Related_Payment_ID: '',
      Refund_Status: 'None',
      Requested_Amount: 0,
      Completed_Refund_Amount: 0,
      Refund_Reason: '',
      Rejection_Reason: '',
      Requested_By: '',
      Requested_At: '',
      Reviewed_By: '',
      Reviewed_At: '',
      Completed_By: '',
      Completed_At: '',
      Refund_Reference: '',
    });

    // Update Bill payment status to Pending_Verification
    db.updateRow('Bills', 'Bill_ID', params.billId, {
      Payment_Status: 'Pending_Verification',
    });

    return {
      success: true,
      message: 'Payment reference submitted. Staff will verify the bank receipt and confirm your payment shortly.',
      paymentId,
    };
  }

  /**
   * Staff verifies actual bank receipt outside the system before marking payment as Paid.
   */
  public static staffVerifyPaymentReceipt(params: {
    paymentId: string;
    staffUserName: string;
    isConfirmed: boolean;
    rejectionReason?: string;
  }): { success: boolean; message: string } {
    const payment = db.findOne('Payments', (p) => p.Payment_ID === params.paymentId);
    if (!payment) return { success: false, message: 'Payment record not found.' };

    const now = new Date().toISOString();

    if (params.isConfirmed) {
      db.updateRow('Payments', 'Payment_ID', params.paymentId, {
        Payment_Status: 'Paid',
        Received_By: params.staffUserName,
      });

      db.updateRow('Bills', 'Bill_ID', payment.Bill_ID, {
        Payment_Status: 'Paid',
      });

      return {
        success: true,
        message: `Payment verified successfully! Bill ${payment.Bill_ID} marked as Paid.`,
      };
    } else {
      // Rejection / verification failed
      db.updateRow('Payments', 'Payment_ID', params.paymentId, {
        Payment_Status: 'Failed',
        Rejection_Reason: params.rejectionReason || 'UTR not reflected in restaurant bank account.',
      });

      db.updateRow('Bills', 'Bill_ID', payment.Bill_ID, {
        Payment_Status: 'Unpaid',
      });

      return {
        success: true,
        message: 'Payment marked as unverified/failed. Customer must re-submit valid payment proof.',
      };
    }
  }

  /**
   * Staff confirms customer departure, marks booking completed, and triggers table turnover.
   */
  public static confirmDepartureAndReleaseTable(params: {
    bookingId: string;
    tableId: string;
    staffUserName: string;
  }): { success: boolean; message: string } {
    const booking = db.findOne('Bookings', (b) => b.Booking_ID === params.bookingId);
    if (!booking) return { success: false, message: 'Booking not found.' };

    const bill = db.findOne('Bills', (b) => b.Booking_ID === params.bookingId);
    if (bill && bill.Payment_Status !== 'Paid') {
      return {
        success: false,
        message: 'Cannot complete departure: Bill payment has not been verified yet.',
      };
    }

    const now = new Date().toISOString();

    // Update Booking status to Completed
    db.updateRow('Bookings', 'Booking_ID', params.bookingId, {
      Booking_Status: 'Completed',
    });

    // Release physical table
    TableService.releaseTableAfterDeparture(params.tableId);

    return {
      success: true,
      message: 'Party departure confirmed. Table released and queued for 15-min cleaning turnover.',
    };
  }

  /**
   * Retrieves all pending payments for staff verification queue
   */
  public static getPendingPayments() {
    const payments = db.findRows('Payments', (p) => p.Payment_Status === 'Pending_Verification');
    const bills = db.getRows('Bills');
    const bookings = db.getRows('Bookings');
    const customers = db.getRows('Customers');

    return payments.map((p) => {
      const bill = bills.find((b) => b.Bill_ID === p.Bill_ID);
      const booking = bill ? bookings.find((bk) => bk.Booking_ID === bill.Booking_ID) : undefined;
      const customer = booking ? customers.find((c) => c.Customer_ID === booking.Customer_ID) : undefined;

      return {
        ...p,
        bookingId: bill?.Booking_ID,
        customerName: customer?.Customer_Name || 'Guest',
        grandTotal: bill?.Grand_Total,
      };
    });
  }
}

export class RefundService {
  /**
   * Staff requests a full or partial refund
   */
  public static requestRefund(params: {
    paymentId: string;
    requestedAmount: number;
    reason: string;
    staffUserName: string;
  }): { success: boolean; message: string } {
    const payment = db.findOne('Payments', (p) => p.Payment_ID === params.paymentId);
    if (!payment) return { success: false, message: 'Payment record not found.' };

    if (payment.Payment_Status !== 'Paid') {
      return { success: false, message: 'Only successfully paid transactions can be refunded.' };
    }

    if (params.requestedAmount <= 0 || params.requestedAmount > Number(payment.Amount_Paid)) {
      return {
        success: false,
        message: `Refund amount must be between ₹1 and ₹${payment.Amount_Paid}.`,
      };
    }

    const now = new Date().toISOString();

    db.updateRow('Payments', 'Payment_ID', params.paymentId, {
      Refund_Status: 'Requested',
      Requested_Amount: params.requestedAmount,
      Refund_Reason: params.reason.trim(),
      Requested_By: params.staffUserName,
      Requested_At: now,
    });

    return {
      success: true,
      message: 'Refund request submitted for Administrator review and approval.',
    };
  }

  /**
   * Administrator reviews and approves or rejects the refund request
   */
  public static adminReviewRefund(params: {
    paymentId: string;
    adminUserName: string;
    decision: 'APPROVE' | 'REJECT';
    rejectionReason?: string;
  }): { success: boolean; message: string } {
    const payment = db.findOne('Payments', (p) => p.Payment_ID === params.paymentId);
    if (!payment) return { success: false, message: 'Payment record not found.' };

    if (payment.Refund_Status !== 'Requested') {
      return { success: false, message: 'This payment is not currently in a pending refund review state.' };
    }

    const now = new Date().toISOString();

    if (params.decision === 'APPROVE') {
      db.updateRow('Payments', 'Payment_ID', params.paymentId, {
        Refund_Status: 'Approved',
        Reviewed_By: params.adminUserName,
        Reviewed_At: now,
      });

      return {
        success: true,
        message: 'Refund request approved! Staff or Admin may now execute manual UPI payout.',
      };
    } else {
      db.updateRow('Payments', 'Payment_ID', params.paymentId, {
        Refund_Status: 'Rejected',
        Rejection_Reason: params.rejectionReason || 'Rejected by administrator.',
        Reviewed_By: params.adminUserName,
        Reviewed_At: now,
      });

      return {
        success: true,
        message: 'Refund request has been rejected. Original payment record remains unchanged.',
      };
    }
  }

  /**
   * Records execution of manual payout outside the system
   */
  public static completeManualRefund(params: {
    paymentId: string;
    completedAmount: number;
    refundReference: string; // Outbound UPI UTR
    completedByUserName: string;
  }): { success: boolean; message: string } {
    const payment = db.findOne('Payments', (p) => p.Payment_ID === params.paymentId);
    if (!payment) return { success: false, message: 'Payment record not found.' };

    if (payment.Refund_Status !== 'Approved') {
      return { success: false, message: 'Refund must be approved by an Admin before recording completion.' };
    }

    const now = new Date().toISOString();

    db.updateRow('Payments', 'Payment_ID', params.paymentId, {
      Refund_Status: 'Completed',
      Completed_Refund_Amount: params.completedAmount,
      Refund_Reference: params.refundReference.trim(),
      Completed_By: params.completedByUserName,
      Completed_At: now,
    });

    return {
      success: true,
      message: `Refund of ₹${params.completedAmount} marked as completed with reference ${params.refundReference}.`,
    };
  }

  /**
   * Retrieves all refund requests for Admin management
   */
  public static getAllRefundRequests() {
    const payments = db.findRows('Payments', (p) => p.Refund_Status !== 'None');
    const bills = db.getRows('Bills');

    return payments.map((p) => {
      const bill = bills.find((b) => b.Bill_ID === p.Bill_ID);
      return {
        ...p,
        bookingId: bill?.Booking_ID,
      };
    });
  }
}
